/**
 * Análisis de reclamos con Claude (API de Anthropic). La clave la guarda un socio
 * en el panel (adminConfig/ia, solo servidor). Se envían textos moderados, chat y
 * fotos del expediente; nunca teléfonos, correos ni direcciones.
 * buildClaimPrompt y parseAnalysis son puras (pruebas en ia-reclamos.test.js).
 */

export const IA_MODEL = 'claude-sonnet-5-5';
const MAX_PHOTOS = 8;

const SYSTEM = `Eres el asistente de reclamos de HULUL, una plataforma de servicios a domicilio en Ecuador (como Uber, pero para plomería, limpieza, belleza, etc.).
Tu trabajo: leer el expediente de un reclamo entre un cliente y un profesional y recomendar a HULUL una decisión justa, explicando por qué.
Reglas de HULUL:
- Decisión a favor del cliente: no se cobra la visita; puede haber crédito al cliente (máx. $500) y multa al profesional (máx. $200). Habitual: crédito $5; multa $10 si el profesional no llegó o marcó "cliente ausente" sin razón, $5 en otros casos.
- Decisión a favor del profesional: se cobra la visita y se le libera el pago.
- Faltas: al profesional (3 en 30 días = 7 días de suspensión) o al cliente (reclamo abusivo o mal trato).
- Evidencia fuerte: llegada con GPS a menos de 250 m, inicio con el código de 4 dígitos que solo tiene el cliente, 3 timbres antes de "cliente ausente", fotos del trabajo, lo que cada uno escribió en el chat y cuándo.
Sé imparcial, concreto y breve. Escribe en español neutro. Si la evidencia no alcanza, dilo y sugiere qué revisar.
Responde SOLO con un JSON válido con esta forma:
{"lado":"cliente"|"profesional"|"indeterminado","confianza":"alta"|"media"|"baja","resumen":"2-3 frases","version_cliente":"1 frase","version_profesional":"1 frase","hechos":["..."],"contradicciones":["..."],"riesgos":["posible abuso, patrón, etc."],"decision":{"multaPro":0,"creditoCliente":0,"faltaPro":false,"faltaCliente":false},"motivo":"texto para las dos partes, 2-4 frases, respetuoso"}`;

/** Tapa teléfonos, cédulas y correos que alguien haya escrito en textos libres. */
export const scrub = (t) => String(t ?? '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[correo oculto]').replace(/\+?\d[\d\s-]{6,}\d/g, '[número oculto]');
const when = (ms) => (ms ? new Date(ms - 5 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ') : '—');

/** Arma el mensaje para Claude con el expediente (sin datos de contacto). */
export function buildClaimPrompt(file) {
  const { claim: c, booking: b, messages = [], parties = {}, stats = {}, advice = null } = file;
  const lines = [
    `RECLAMO ${c.code ?? ''} · abierto por el ${c.openedBy} el ${when(c.openedAt)}`,
    `Motivo: ${c.kindLabel ?? c.kind}`,
    `Lo que escribió quien reclama: «${scrub(c.privado?.apertura ?? c.text ?? '')}»`,
    `Respuesta de la otra parte: ${c.response ? `«${scrub(c.privado?.respuesta ?? c.response.text ?? '')}»${c.response.late ? ' (fuera de plazo)' : ''}` : c.responseMissed ? 'no respondió en 24 h' : 'aún no responde'}`,
    '',
    `RESERVA: ${b.category} · ${b.date} ${b.slot} · estado ${b.status} · pago ${b.paymentMethod} · visita $${Number(b.visit ?? b.subtotal ?? 0).toFixed(2)}`,
    `Notas del cliente al reservar: ${b.notes ? `«${scrub(String(b.notes).slice(0, 400))}»` : '—'}`,
    `Aceptó: ${when(b.acceptedAt)} · En camino: ${when(b.enRouteAt)} · Llegó: ${when(b.arrivedAt)}${b.arrivedPos?.distance != null ? ` (GPS a ${Math.round(b.arrivedPos.distance)} m)` : ''} · Empezó con código: ${b.startedAt ? when(b.startedAt) : 'no'} · Terminó: ${when(b.finishedAt)}`,
    `Timbres antes de "cliente ausente": ${Array.isArray(b.rings) ? b.rings.length : 0} · Cancelada por: ${b.cancelledBy ?? '—'}`,
    `Informe del profesional: ${b.outcome ?? '—'}${b.diagnosis ? ` · «${scrub(String(b.diagnosis).slice(0, 600))}»` : ''}`,
    b.extra ? `Cobro adicional: $${Number(b.extra.amount ?? 0).toFixed(2)} (${b.extra.status}, ${b.extra.method ?? ''})` : '',
    b.delay ? `Aviso de retraso: ${b.delay.minutes} min (${b.delay.status})` : '',
    `Calificación del cliente al profesional: ${b.rating ?? '—'} · del profesional al cliente: ${b.clientRating?.stars ?? '—'}`,
    '',
    `ANTECEDENTES: cliente con ${parties.client?.reclamos ?? 0} reclamos y ${parties.client?.strikes ?? 0} faltas · profesional con ${parties.pro?.reclamos ?? 0} reclamos, ${parties.pro?.strikes ?? 0} faltas, calificación ${parties.pro?.rating ?? '—'}`,
    `Tiempos de respuesta en el chat: cliente ${stats.cliente?.avgMin ?? '—'} min promedio · profesional ${stats.profesional?.avgMin ?? '—'} min`,
    '',
    `CHAT COMPLETO (${messages.length} mensajes):`,
    ...messages.slice(-120).map((m) => `[${when(m.at)}] ${m.from}: ${m.kind === 'foto' ? '(envió una foto)' : m.kind === 'pedir_fotos' ? '(pidió fotos)' : scrub(m.original ?? m.text)}`),
    '',
    advice ? `Lectura automática por reglas (referencia, puede equivocarse): ${advice.summary}` : '',
  ].filter((l) => l !== '');
  const photos = [...(c.photos ?? []), ...(c.response?.photos ?? []), ...(b.diagnosisPhotos ?? []), ...messages.filter((m) => m.photo).map((m) => m.photo)]
    .filter((u) => typeof u === 'string' && u.startsWith('https://')).slice(0, MAX_PHOTOS);
  return { system: SYSTEM, text: lines.join('\n'), photos };
}

/** Lee el JSON de la respuesta (tolera texto alrededor) y lo limita a valores válidos. */
export function parseAnalysis(raw) {
  const m = String(raw ?? '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('La IA no devolvió un análisis válido.');
  const j = JSON.parse(m[0]);
  const num = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v || 0) * 100) / 100));
  const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x).slice(0, 300)).slice(0, 8) : []);
  const lado = ['cliente', 'profesional'].includes(j.lado) ? j.lado : 'indeterminado';
  return {
    lado, confianza: ['alta', 'media', 'baja'].includes(j.confianza) ? j.confianza : 'baja',
    resumen: String(j.resumen ?? '').slice(0, 800), version_cliente: String(j.version_cliente ?? '').slice(0, 400), version_profesional: String(j.version_profesional ?? '').slice(0, 400),
    hechos: arr(j.hechos), contradicciones: arr(j.contradicciones), riesgos: arr(j.riesgos),
    decision: {
      multaPro: lado === 'cliente' ? num(j.decision?.multaPro, 200) : 0,
      creditoCliente: lado === 'cliente' ? num(j.decision?.creditoCliente, 500) : 0,
      faltaPro: !!j.decision?.faltaPro, faltaCliente: !!j.decision?.faltaCliente,
    },
    motivo: String(j.motivo ?? '').slice(0, 1500),
  };
}

/** Llama a la API de Claude. */
export async function callClaude({ key, system, text, photos, fetchImpl = fetch }) {
  const content = [...photos.map((url) => ({ type: 'image', source: { type: 'url', url } })), { type: 'text', text }];
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: IA_MODEL, max_tokens: 1500, system, messages: [{ role: 'user', content }] }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    // Si una foto no se pudo leer, se reintenta solo con el texto.
    if (photos.length && /image|url/i.test(msg)) return callClaude({ key, system, text, photos: [], fetchImpl });
    throw new Error(res.status === 401 ? 'La clave de la API de Claude no es válida. Revísala en Administración.' : `La IA no respondió: ${msg}`);
  }
  return { text: (body.content ?? []).filter((p) => p.type === 'text').map((p) => p.text).join(''), usage: body.usage ?? null, photosSent: photos.length };
}
