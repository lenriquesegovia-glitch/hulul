/**
 * Protocolo de reclamos de HULUL (lógica pura, sin Firebase; se prueba en
 * reclamos-core.test.js).
 *
 * 1. Abre el reclamo el cliente o el profesional, hasta 48 h después de la
 *    visita (o de la cancelación). Uno por reserva.
 * 2. La otra parte tiene 24 h para dar su versión (texto y fotos).
 * 3. HULUL resuelve en máximo 72 h desde que se abrió, con el expediente
 *    completo: línea de tiempo, ubicación de llegada, timbres, código, fotos,
 *    informe, chat (con los mensajes originales moderados) y las dos versiones.
 * 4. La decisión, con su motivo, se avisa a las dos partes y no se edita.
 * Si el cliente reclama, el pago al profesional queda retenido hasta la decisión.
 */

export const RESPONSE_HOURS = 24;
export const RESOLVE_HOURS = 72;
export const CLAIM_WINDOW_HOURS = 48;
export const REMIND_BEFORE_HOURS = 12;
export const MAX_CLAIM_PHOTOS = 6;
const H = 3_600_000;

export const CLIENT_KINDS = {
  si_estaba: 'El cliente sí estaba en casa',
  no_vino: 'No se realizó el servicio',
  incompleto: 'Se marcó como terminado, pero no se completó',
  cobro: 'El cobro no fue el acordado',
  trato: 'Trato irrespetuoso del profesional',
  dano: 'Daño en mi casa o mis cosas',
  otro: 'Otra cosa',
};

export const PRO_KINDS = {
  agresion: 'Trato irrespetuoso o agresivo del cliente',
  no_pago: 'El cliente no pagó lo acordado',
  dano: 'Daño a mis herramientas o equipo',
  adicional: 'Rechazó un cobro adicional justificado',
  no_dejo: 'No me dejó trabajar o no me abrió',
  otro: 'Otra cosa',
};

export const CLAIM_STATUS = {
  esperando_respuesta: 'Esperando la versión de la otra parte',
  en_revision: 'En revisión por HULUL',
  resuelto: 'Resuelto',
};

const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : typeof t === 'number' ? t : 0);

/**
 * ¿Puede esta parte abrir un reclamo sobre la reserva ahora?
 * Devuelve null si puede, o el motivo si no.
 */
export function claimBlocked(b, side, kind, now = Date.now()) {
  const kinds = side === 'cliente' ? CLIENT_KINDS : PRO_KINDS;
  if (!kinds[kind]) return 'Elige qué pasó.';
  if (b.dispute || b.claimId) return 'Ya hay un reclamo abierto en esta reserva. Lo estamos revisando.';
  const finished = ms(b.finishedAt);
  const cancelled = ms(b.cancelledAt);
  const recentFinish = finished && now - finished < CLAIM_WINDOW_HOURS * H;
  const recentCancel = cancelled && now - cancelled < CLAIM_WINDOW_HOURS * H;
  const absent = b.status === 'cancelada' && b.cancelledBy === 'cliente_ausente' && recentCancel;
  if (side === 'cliente') {
    if (kind === 'si_estaba' && !absent) return 'Esta opción es para cuando el profesional marcó que no te encontró (hasta 48 horas después).';
    const ok = absent || b.status === 'por_aprobar' || (b.status === 'completada' && recentFinish);
    return ok ? null : 'Los problemas se reportan hasta 48 horas después de terminada la visita.';
  }
  // Profesional: visita terminada, o cancelada por el cliente / cliente ausente.
  const byClient = b.status === 'cancelada' && ['cliente', 'cliente_ausente'].includes(b.cancelledBy) && recentCancel;
  const ok = byClient || b.status === 'por_aprobar' || (b.status === 'completada' && recentFinish);
  return ok ? null : 'Los problemas se reportan hasta 48 horas después de la visita o de la cancelación.';
}

/** Plazos del caso a partir de su apertura. */
export function deadlines(openedAtMs) {
  return { responseDueAt: openedAtMs + RESPONSE_HOURS * H, resolveDueAt: openedAtMs + RESOLVE_HOURS * H };
}

/** Qué avisos de plazo tocan ahora (el servidor los marca para no repetirlos). */
export function dueActions(c, now = Date.now()) {
  const out = [];
  if (c.status === 'resuelto') return out;
  const alerts = c.alerts ?? {};
  if (c.status === 'esperando_respuesta' && now > Number(c.responseDueAt)) out.push('sin_respuesta');
  if (!alerts.porVencer && now > Number(c.resolveDueAt) - REMIND_BEFORE_HOURS * H && now <= Number(c.resolveDueAt)) out.push('por_vencer');
  if (!alerts.vencido && now > Number(c.resolveDueAt)) out.push('vencido');
  return out;
}

/** Fotos aceptadas: solo enlaces de nuestro Storage en la carpeta del autor. */
export function cleanClaimPhotos(list, uid, bookingId, bucket = 'hulul-59081.firebasestorage.app') {
  const prefix = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(`reclamos/${uid}/${bookingId}/`)}`;
  return (Array.isArray(list) ? list : [])
    .map((u) => String(u))
    .filter((u) => u.startsWith(prefix) && u.length < 600)
    .slice(0, MAX_CLAIM_PHOTOS);
}

/**
 * Cambios en la reserva al resolver. d = { outcome: 'cliente' | 'profesional',
 * multaPro, creditoCliente }. Solo un reclamo del cliente mueve dinero (la
 * reserva estaba retenida en "en_disputa"); el del profesional deja constancia
 * y faltas, y el dinero se ajusta aparte si hace falta.
 */
export function decisionPatch(b, claim, d) {
  const patch = { dispute: { ...(b.dispute ?? {}), status: 'resuelta', outcome: d.outcome } };
  if (claim.openedBy !== 'cliente' || b.status !== 'en_disputa') return patch;
  const prev = b.previousStatus;
  const multa = Math.max(0, Math.min(200, Number(d.multaPro || 0)));
  const credito = Math.max(0, Math.min(500, Number(d.creditoCliente || 0)));
  patch.previousStatus = 'en_disputa';
  if (d.outcome === 'profesional') {
    if (prev === 'cancelada') patch.status = 'cancelada';
    else { patch.status = 'completada'; patch.completedBy = 'reclamo'; }
    return patch;
  }
  // A favor del cliente: no se le cobra.
  patch.status = 'cancelada';
  patch.cancelFee = 0;
  if (prev !== 'cancelada') { patch.cancelledBy = 'reclamo'; patch.cancelReason = 'Reclamo resuelto a favor del cliente.'; }
  if (multa > 0) { patch.proFine = multa; patch.proFault = 'reclamo'; }
  if (credito > 0) patch.clientCredit = credito;
  return patch;
}

/**
 * Tiempos de respuesta en el chat: para cada parte, cuánto tardó en contestar
 * después de un mensaje de la otra (minutos).
 */
export function responseStats(messages) {
  const out = { cliente: { count: 0, replies: 0, avgMin: null, maxMin: null }, profesional: { count: 0, replies: 0, avgMin: null, maxMin: null } };
  const sorted = [...messages].filter((m) => ms(m.at ?? m.createdAt)).sort((a, b) => ms(a.at ?? a.createdAt) - ms(b.at ?? b.createdAt));
  const sums = { cliente: 0, profesional: 0 };
  let pending = null; // primer mensaje sin contestar: { from, at }
  for (const m of sorted) {
    const who = m.from === 'cliente' ? 'cliente' : 'profesional';
    const t = ms(m.at ?? m.createdAt);
    out[who].count += 1;
    if (pending && pending.from !== who) {
      const min = (t - pending.at) / 60_000;
      out[who].replies += 1; sums[who] += min;
      out[who].maxMin = Math.max(out[who].maxMin ?? 0, Math.round(min));
      pending = { from: who, at: t };
    } else if (!pending) pending = { from: who, at: t };
  }
  for (const k of ['cliente', 'profesional']) if (out[k].replies) out[k].avgMin = Math.round(sums[k] / out[k].replies);
  return out;
}

/** Línea de tiempo del expediente: todo lo que quedó registrado, en orden. */
export function timeline(b, claim, messages = []) {
  const ev = [];
  const add = (t, who, what, detail = '') => { const at = ms(t); if (at) ev.push({ at, who, what, detail }); };
  add(b.createdAt, 'cliente', 'Reservó', `${b.date ?? ''} ${b.slot ?? ''}`.trim());
  add(b.acceptedAt, 'profesional', 'Aceptó');
  if (b.delay?.at) add(b.delay.at, 'profesional', 'Avisó retraso', `${b.delay.minutes ?? '?'} min · ${b.delay.status ?? ''}`);
  add(b.enRouteAt, 'profesional', 'Salió en camino');
  add(b.arrivedAt, 'profesional', 'Marcó "Estoy en la dirección"', b.arrivedPos ? `a ${b.arrivedPos.distance ?? '?'} m de la dirección (precisión ${Math.round(b.arrivedPos.accuracy ?? 0)} m)` : 'sin GPS');
  (Array.isArray(b.rings) ? b.rings : []).forEach((t, i) => add(Number(t), 'profesional', `Timbró al cliente (${i + 1})`));
  add(b.startedAt, 'profesional', 'Empezó con el código de llegada del cliente');
  add(b.finishedAt, 'profesional', 'Terminó la visita', b.outcome ? String(b.outcome) : '');
  if (b.extra?.at) add(b.extra.at, 'profesional', 'Propuso cobro adicional', `${b.extra.amount ?? ''} · ${b.extra.status ?? ''}`);
  add(b.cancelledAt, b.cancelledBy === 'cliente' ? 'cliente' : b.cancelledBy === 'sistema' ? 'hulul' : 'profesional', 'Canceló', `${b.cancelledBy ?? ''}${b.cancelReason ? ` · ${b.cancelReason}` : ''}`);
  add(b.completedAt, b.completedBy === 'automatico' ? 'hulul' : 'cliente', 'Se cerró la visita', b.completedBy ?? '');
  for (const m of messages) add(m.at ?? m.createdAt, m.from === 'cliente' ? 'cliente' : 'profesional', m.kind === 'foto' ? 'Envió una foto (chat)' : 'Escribió en el chat', m.kind === 'foto' ? '' : String(m.text ?? '').slice(0, 140));
  if (claim) {
    add(claim.openedAt, claim.openedBy, 'Abrió el reclamo', claim.kindLabel ?? '');
    if (claim.response) add(claim.response.at, claim.openedBy === 'cliente' ? 'profesional' : 'cliente', 'Dio su versión');
    if (claim.decision) add(claim.decision.at, 'hulul', 'Decisión de HULUL', claim.decision.outcome === 'cliente' ? 'A favor del cliente' : 'A favor del profesional');
  }
  return ev.sort((a, b2) => a.at - b2.at);
}

/** Correo, celular: se muestran a medias salvo que el administrador pida verlos (queda registrado). */
export function maskContact(v) {
  const s = String(v ?? '');
  if (!s) return '';
  if (s.includes('@')) { const [u, d] = s.split('@'); return `${u.slice(0, 2)}•••@${d}`; }
  const digits = s.replace(/\D/g, '');
  return digits.length > 4 ? `•••• ${digits.slice(-4)}` : '••••';
}

/** Lista de correos de administradores (variable ADMIN_EMAILS, separados por coma). */
export function isAdminToken(token, adminEmails) {
  const email = String(token?.email ?? '').toLowerCase();
  if (!email || token?.email_verified !== true) return false;
  return String(adminEmails ?? '').toLowerCase().split(/[,;\s]+/).filter(Boolean).includes(email);
}
