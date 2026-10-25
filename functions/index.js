/**
 * Funciones de HULUL en Firebase.
 *
 * Cada vez que se guarda una reserva o una solicitud de profesional:
 *  - te llega un correo con los datos y un botón para escribir al cliente por WhatsApp;
 *  - el cliente recibe la confirmación de su reserva por correo.
 *
 * Los correos salen por Gmail (una cuenta propia de HULUL) o, cuando exista el
 * dominio, por Resend desde reservas@hululec.com. Cambiar de uno a otro es
 * cambiar MAIL_PROVIDER y FROM_EMAIL. La contraseña se guarda como secreto en
 * Google (MAIL_PASSWORD), nunca en el código.
 */
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import nodemailer from 'nodemailer';
import { randomInt, createHash } from 'node:crypto';
import { canReadClientSummary, clientSummary } from './client-summary.js';
import homeCatalog from './home-catalog.js';
import { buildRanking } from './home-ranking-core.js';
import { normalizeRankingBooking } from './home-ranking.js';
import { hasProfanity, maskProfanity, PROFANITY_MESSAGE } from './profanity.js';
import { safeMessage } from './mail-safety.js';
import { CLAIM_STATUS, CLIENT_KINDS, PRO_KINDS, RESOLVE_HOURS, RESPONSE_HOURS, REMIND_BEFORE_HOURS, claimBlocked, cleanClaimPhotos, decisionPatch, deadlines, dueActions, isAdminToken, maskContact, responseStats, timeline } from './reclamos-core.js';
import { chargesVat, extraOf, IVA_RATE, ledgerDiff, ledgerEntriesFor, PAYOUT_HOLD_HOURS, payoutWeek, PLATFORM_FEE, priceOf, r2, regimeOf, reversalOf, weeklyPayout } from './money.js';

/** Debe coincidir con la ubicación de la base de datos Firestore. */
const REGION = 'southamerica-east1';
const PROJECT = 'hulul-59081';

initializeApp();
const db = () => getFirestore();

/** Read-only ranking, isolated from all booking mutations and financial functions. */
export const refreshHomeDiscovery = onSchedule({ region: REGION, schedule: '0 4 * * *', timeZone: 'America/Guayaquil', maxInstances: 1 }, async () => {
  const now = Date.now();
  const reservations = await db().collection('bookings').where('acceptedAt', '>=', new Date(now - 7 * 86400000)).get();
  const providers = new Map();
  const ids = [...new Set(reservations.docs.map(d => d.data().professionalId).filter(id => typeof id === 'string' && id && !id.includes('/')))];
  for (let i = 0; i < ids.length; i += 100) {
    const docs = await db().getAll(...ids.slice(i, i + 100).map(id => db().doc(`providers/${id}`)));
    for (const doc of docs) providers.set(doc.id, doc.exists ? doc.data() : null);
  }
  const events = reservations.docs.map(doc => normalizeRankingBooking(doc.id, doc.data(), providers.get(doc.data().professionalId), homeCatalog));
  const fallback = ['limpieza', 'climatizacion', 'plomeria'].map(slug => homeCatalog.find(s => s.categoryId === slug)?.id).filter(Boolean);
  const snapshot = buildRanking(events, homeCatalog, fallback, now);
  const ref = db().doc('homeDiscovery/current');
  await db().runTransaction(async tx => {
    const old = await tx.get(ref);
    if ((old.data()?.generatedAtMs ?? 0) <= now) tx.set(ref, snapshot);
  });
});

/** Public response contains only known catalog IDs/labels, never raw booking data. */
export const homeDiscovery = onCall({ region: REGION, maxInstances: 5 }, async () => {
  const data = (await db().doc('homeDiscovery/current').get()).data();
  if (!data || data.mode !== 'popular' || !Number.isFinite(data.expiresAtMs) || data.expiresAtMs <= Date.now()) return { mode: 'featured', items: [] };
  const items = [...new Set((Array.isArray(data.items) ? data.items : []).map(item => item?.id))]
    .map(id => homeCatalog.find(service => service.id === id)).filter(Boolean).slice(0, 10);
  return { mode: 'popular', items, generatedAtMs: data.generatedAtMs, expiresAtMs: data.expiresAtMs };
});

const MAIL_PASSWORD = defineSecret('MAIL_PASSWORD');
const MAIL_PROVIDER = defineString('MAIL_PROVIDER', { default: 'gmail', description: 'gmail o resend' });
const FROM_EMAIL = defineString('FROM_EMAIL', { description: 'Correo de HULUL que envía los avisos' });
const NOTIFY_TO = defineString('NOTIFY_TO', { description: 'Correo donde recibes los avisos de reservas' });

const CATEGORIES = {
  climatizacion: 'Climatización', plomeria: 'Plomería', electricidad: 'Electricidad',
  electrodomesticos: 'Electrodomésticos', limpieza: 'Limpieza', belleza: 'Belleza',
  mascotas: 'Mascotas', clases: 'Clases', jardineria: 'Jardinería', piscinas: 'Piscinas',
  pintura: 'Pintura', salud: 'Salud', cerrajeria: 'Cerrajería', carpinteria: 'Carpintería',
  albanileria: 'Albañilería', fumigacion: 'Fumigación', mudanzas: 'Mudanzas', tecnologia: 'Tecnología',
};
const PAYMENTS = { tarjeta: 'Tarjeta', transferencia: 'Transferencia', deuna: 'DeUna' };

// Precio, impuestos y libro de movimientos: money.js (misma fórmula que packages/shared).

const BUCKET = 'hulul-59081.firebasestorage.app';

// Misma lista que packages/shared/src/provider.ts (CATEGORY_PRICING.suggested).
const SUGGESTED = {
  climatizacion: 25, plomeria: 20, electricidad: 20, electrodomesticos: 20, limpieza: 25, jardineria: 20,
  piscinas: 20, pintura: 25, belleza: 15, mascotas: 12, clases: 12, salud: 20, cerrajeria: 20, carpinteria: 20,
  albanileria: 25, fumigacion: 30, mudanzas: 40, tecnologia: 20,
};
const MIN_VISIT_RATE = 5;
const MAX_VISIT_RATE = 1000;
// Banda de tarifas alrededor de la sugerida (igual que RATE_BAND en provider.ts).
const RATE_BAND = { below: 0.25, above: 0.25 };
const rateRange = (c) => {
  const s = SUGGESTED[c] ?? 20;
  return { min: Math.max(MIN_VISIT_RATE, Math.floor(s * (1 - RATE_BAND.below))), max: Math.ceil(s * (1 + RATE_BAND.above)) };
};
const clampRate = (c, r) => { const { min, max } = rateRange(c); return Math.min(max, Math.max(min, r)); };

// Fuera de horario y feriados (igual que packages/shared/src/schedule.ts).
// Horario normal 08:00–18:00. Fuera de él y en feriados atiende solo quien lo
// activa, con su recargo en monto fijo (sin tope comercial).
const NORMAL_START = 8;
const NORMAL_END = 18;
const MAX_SURCHARGE = 500;
const OFF_HOURS = [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7];
const HOLIDAYS = {
  '2026-11-02': 'Día de los Difuntos', '2026-11-03': 'Independencia de Cuenca', '2026-12-25': 'Navidad',
  '2027-01-01': 'Año Nuevo', '2027-02-08': 'Carnaval', '2027-02-09': 'Carnaval', '2027-03-26': 'Viernes Santo',
  '2027-07-25': 'Fundación de Guayaquil',
};
const SURCHARGE_NAMES = { nocturno: 'Recargo nocturno', feriado: 'Recargo de feriado' };
const isOffHour = (slot) => { const h = Number(String(slot).split(':')[0]); return h < NORMAL_START || h >= NORMAL_END; };
const validSurcharge = (n) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= MAX_SURCHARGE ? Math.round(n * 100) / 100 : null);
/** Recargo de una reserva según el perfil del profesional: el mayor entre nocturno y feriado. */
function surchargeOf(p, date, slot) {
  const night = isOffHour(slot) ? (validSurcharge(p?.surcharges?.nocturno) ?? 0) : -1;
  const holiday = HOLIDAYS[date] ? (validSurcharge(p?.surcharges?.feriado) ?? 0) : -1;
  if (night < 0 && holiday < 0) return { kind: null, amount: 0 };
  return holiday > night ? { kind: 'feriado', amount: holiday } : { kind: 'nocturno', amount: night };
}
/** ¿El profesional atiende esa fecha y hora fuera de horario? '' si sí; si no, el motivo. */
function offHoursRefusal(p, date, slot) {
  const h = Number(String(slot).split(':')[0]);
  if (isOffHour(slot) && !(Array.isArray(p?.offHours) && p.offHours.includes(h))) return `El profesional no atiende a las ${slot}.`;
  if (HOLIDAYS[date] && p?.holidays !== true) return `${HOLIDAYS[date]} es feriado y el profesional no atiende feriados.`;
  return '';
}

// Mismos textos que packages/shared/src/policy.ts y copy.ts.
const TECNICO = ['climatizacion', 'plomeria', 'electricidad', 'electrodomesticos', 'piscinas', 'pintura', 'cerrajeria', 'carpinteria', 'albanileria', 'fumigacion', 'tecnologia'];
const isTech = (cat) => TECNICO.includes(cat);
const OUTCOMES = { resuelto: 'Listo', parcial: 'Falta completar', no_resuelto: 'Requiere otra solución' };
const OUTCOMES_SERVICE = { resuelto: 'Servicio completo', parcial: 'Completado en parte', no_resuelto: 'No se pudo realizar' };
const outcomeText = (o, cat) => (isTech(cat) ? OUTCOMES : OUTCOMES_SERVICE)[o] ?? '—';
const reportName = (cat) => (isTech(cat) ? 'Informe' : 'Resumen');
const AFTER_VISIT_NOTE = 'Si hace falta algo más (más tiempo, materiales u otro servicio), el profesional te lo propone en la app y tú decides. Págalo por la app para que quede registrado, y califica al profesional para que otros sepan cómo trabajó.';
const HOME_SAFETY_NOTICE = [
  'Que haya alguien mayor de edad en casa para recibir al profesional y acompañar el servicio, como con cualquier visita.',
  'Guarda dinero, joyas y objetos de valor: así todos trabajan tranquilos.',
  'Cada profesional de HULUL pasa por una verificación de identidad y antecedentes. El cuidado de los objetos personales es de cada hogar.',
];
const safetyHtml = () => `<div style="background:#FFF6E5;border:1px solid #E9C98B;border-radius:10px;padding:12px 14px;margin-top:16px;font-size:14px;color:#3F3A37"><strong>Para que tu servicio fluya</strong><ul style="margin:8px 0 0;padding-left:18px">${HOME_SAFETY_NOTICE.map((t) => `<li style="margin:4px 0">${esc(t)}</li>`).join('')}</ul></div>`;

/** Tarifa por visita válida, o null. */
const validRate = (n) => (typeof n === 'number' && Number.isFinite(n) && n >= MIN_VISIT_RATE && n <= MAX_VISIT_RATE ? Math.round(n * 100) / 100 : null);

/** Categorías aprobadas. Sin catStatus (registros anteriores al 18-oct): todas. */
function approvedCats(p) {
  const cats = p.categories ?? [];
  if (!p.catStatus) return cats;
  return cats.filter((c) => (p.catStatus[c] ?? 'aprobado') === 'aprobado');
}
// Lo que se publica siempre queda dentro de la banda de la categoría.
const visitRateOf = (p, c) => clampRate(c, validRate(p.visitRates?.[c]) ?? SUGGESTED[c] ?? 20);
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const usd = (n) => `$${Number(n ?? 0).toFixed(2)}`;
const code = (id) => id.slice(0, 8).toUpperCase();

/** "2026-10-15" → "jueves 15 de octubre" */
function longDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAYS[dt.getUTCDay()]} ${d} de ${MONTHS[m - 1]}`;
}

/** 0994872149 → 593994872149 */
function waNumber(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('593')) return digits;
  return '593' + digits.replace(/^0/, '');
}

/**
 * Transporte de correo con filtro de destinatarios (mail-safety.js): cada aviso
 * a clientes o profesionales sale a un único correo válido. Los avisos internos
 * (a notifyTo, configurado por HULUL) se envían tal cual.
 */
function transport() {
  const t = rawTransport();
  const send = t.sendMail.bind(t);
  t.sendMail = (m) => {
    const safe = safeMessage({ ...m, trusted: !!m && m.to === senders().notifyTo });
    if (!safe) {
      logger.warn('Correo no enviado: destinatario no válido', { subject: String(m?.subject ?? '').slice(0, 80) });
      return Promise.resolve(null);
    }
    return send(safe);
  };
  return t;
}

function rawTransport() {
  if (MAIL_PROVIDER.value() === 'resend') {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: { user: 'resend', pass: MAIL_PASSWORD.value().trim() },
    });
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: FROM_EMAIL.value(), pass: MAIL_PASSWORD.value().trim() },
  });
}

function layout(title, body) {
  return `<!doctype html><html><body style="margin:0;background:#FAF7F2;font-family:Arial,Helvetica,sans-serif;color:#1C1A1A">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="font-size:22px;font-weight:800;color:#7A1E2C;letter-spacing:1px">HULUL</div>
  <div style="background:#fff;border:1px solid #E7DFD5;border-radius:14px;padding:24px;margin-top:16px">
    <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
    ${body}
  </div>
  <p style="font-size:12px;color:#6B6560;margin-top:16px">HULUL · Servicios del hogar · hululec.com</p>
</div></body></html>`;
}

function rows(pairs) {
  return `<table style="width:100%;border-collapse:collapse;font-size:15px">${pairs
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:#6B6560;width:38%;vertical-align:top">${esc(k)}</td><td style="padding:6px 0">${v}</td></tr>`)
    .join('')}</table>`;
}

const button = (href, label, bg = '#7A1E2C') =>
  `<a href="${esc(href)}" style="display:inline-block;background:${bg};color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;margin:16px 8px 0 0">${esc(label)}</a>`;

/** Enlace a Google Maps del punto marcado, o '' si no hay. */
function mapsUrl(loc) {
  const lat = Number(loc?.lat), lng = Number(loc?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Fila "Ubicación" con el enlace al mapa. */
function mapRow(loc) {
  const url = mapsUrl(loc);
  return url
    ? `<a href="${url}" style="color:#7A1E2C;font-weight:700">Ver en Google Maps</a>`
    : '<span style="color:#6B6560">No marcó el mapa</span>';
}

/** Correos de una reserva nueva: aviso para ti y confirmación para el cliente. */
export function bookingEmails(b, id, { from, notifyTo }) {
  const cat = CATEGORIES[b.category] ?? b.category;
  const when = `${longDate(b.date)} a las ${b.slot}`;
  const firstName = String(b.contactName ?? '').split(' ')[0];
  const waText = `Hola ${firstName}, te escribimos de HULUL por tu reserva ${code(id)} de ${cat} para el ${when}.`;
  const adminBody = rows([
    ['Código', `<strong>${code(id)}</strong>${b.demo ? ' <span style="color:#9A5B34">(prueba)</span>' : ''}`],
    ['Servicio', esc(cat)],
    ['Profesional', esc(b.professionalName)],
    ['Fecha', esc(when)],
    ['Visita', usd(b.visit ?? b.subtotal)],
    ...(Number(b.surcharge) > 0 ? [[SURCHARGE_NAMES[b.surchargeKind] ?? 'Recargo', usd(b.surcharge)]] : []),
    ...(b.noiseAccepted ? [['Ruido', 'El cliente aceptó responder ante vecinos y administración']] : []),
    ['Dirección', esc(b.address)],
    ['Ubicación', mapRow(b.location)],
    ['Descripción', esc(b.notes)],
    ['Cliente', esc(b.contactName)],
    ['Celular', esc(b.contactPhone)],
    ['Correo', esc(b.contactEmail)],
    ['Pago', esc(PAYMENTS[b.paymentMethod] ?? b.paymentMethod)],
    ['Total', `<strong>${usd(b.total)}</strong>`],
    ['Origen', b.source === 'app' ? 'App' : 'Web'],
  ]) +
    button(`https://wa.me/${waNumber(b.contactPhone)}?text=${encodeURIComponent(waText)}`, 'Escribir al cliente por WhatsApp', '#1F7A4A') +
    button(`https://console.firebase.google.com/project/${PROJECT}/firestore/databases/-default-/data/~2Fbookings~2F${id}`, 'Ver en Firebase', '#1C1A1A');

  const messages = [{
    from,
    to: notifyTo,
    replyTo: b.contactEmail || undefined,
    subject: `Nueva reserva ${code(id)} · ${cat} · ${when}`,
    html: layout('Nueva reserva', adminBody),
  }];

  if (b.contactEmail) {
    const clientBody = `<p style="font-size:15px;margin:0 0 12px">Hola ${esc(firstName)}, recibimos tu reserva.</p>` +
      rows([
        ['Código', `<strong>${code(id)}</strong>`],
        ['Servicio', esc(cat)],
        ['Profesional', esc(b.professionalName)],
        ['Fecha', esc(when)],
        ['Dirección', esc(b.address)],
        ...(mapsUrl(b.location) ? [['Ubicación', mapRow(b.location)]] : []),
        ['Visita', usd(b.visit ?? b.subtotal)],
        ...(Number(b.surcharge) > 0 ? [[SURCHARGE_NAMES[b.surchargeKind] ?? 'Recargo', usd(b.surcharge)]] : []),
        ['Total', `<strong>${usd(b.total)}</strong>`],
      ]) +
      `<p style="font-size:14px;color:#3F3A37;margin-top:16px">${esc(AFTER_VISIT_NOTE)}</p>` +
      safetyHtml() +
      `<p style="font-size:14px;color:#3F3A37;margin-top:16px">Te avisaremos cuando el profesional confirme.</p>` +
      `<p style="font-size:14px;color:#3F3A37">Puedes cancelar desde <a href="https://hululec.com/cuenta">Mi cuenta</a>: gratis hasta 2 horas antes de la cita; después, o con el profesional en camino, tiene un cargo de $3.</p>` +
      (b.demo ? `<p style="font-size:13px;color:#9A5B34">Versión de prueba: no se hizo ningún cobro.</p>` : '');
    messages.push({
      from,
      to: b.contactEmail,
      replyTo: notifyTo,
      subject: `Tu reserva ${code(id)} en HULUL`,
      html: layout('Reserva recibida', clientBody),
    });
  }
  return messages;
}

/** Correo de aviso por una solicitud de profesional. */
export function applicationEmail(a, { from, notifyTo }) {
  const firstName = String(a.name ?? '').split(' ')[0];
  const cat = CATEGORIES[a.category] ?? a.category;
  const waText = `Hola ${firstName}, te escribimos de HULUL por tu solicitud para trabajar con nosotros.`;
  const body = rows([
    ['Nombre', esc(a.name)],
    ['Celular', esc(a.phone)],
    ['Servicio', esc(cat)],
    ['Ciudad', esc(a.city)],
    ['Experiencia', esc(a.experience)],
    ['Promociones', a.consentMarketing ? 'Acepta' : 'No'],
  ]) + button(`https://wa.me/${waNumber(a.phone)}?text=${encodeURIComponent(waText)}`, 'Escribir por WhatsApp', '#1F7A4A');
  return { from, to: notifyTo, subject: `Nuevo profesional: ${a.name} · ${cat}`, html: layout('Nueva solicitud de profesional', body) };
}

const senders = () => ({ from: `HULUL <${FROM_EMAIL.value()}>`, notifyTo: NOTIFY_TO.value() });

/* ------------------------- Notificaciones al celular ------------------------- */

// Celulares registrados: colección pushTokens/{token} = { uid, platform, updatedAt }.
// Solo la escribe el servidor (registrarAviso); las reglas no la exponen.
const PUSH_RE = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,80}\]$/;
const tokenDocId = (t) => t.replace(/[^A-Za-z0-9_-]/g, '_');

/** El celular de la cuenta con sesión abierta se registra para recibir avisos. */
export const registrarAviso = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const token = String(req.data?.token ?? '');
  if (!PUSH_RE.test(token)) throw new HttpsError('invalid-argument', 'Aviso no válido.');
  await db().doc(`pushTokens/${tokenDocId(token)}`).set({
    token, uid, platform: String(req.data?.platform ?? '').slice(0, 10), updatedAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

/**
 * Notificación con sonido a todos los celulares de una cuenta (canal "pedidos"
 * de la app: importancia máxima y vibración larga). Nunca hace fallar la
 * operación que la llama.
 */
async function pushTo(uid, title, body, data = {}) {
  if (!uid) return;
  try {
    // Persist even without a device token. A stable key makes identical retries idempotent.
    const key = createHash('sha256').update(JSON.stringify([uid,title,body,data])).digest('hex');
    const ref = db().doc(`inboxes/${uid}/items/${key}`);
    try { await ref.create({title,body,data,read:false,createdAt:FieldValue.serverTimestamp()}); }
    catch(e) { if(e.code !== 6 && e.code !== 'already-exists') throw e; }
    data = {...data, notificationId:key};
    const snap = await db().collection('pushTokens').where('uid', '==', uid).get();
    if (snap.empty) return;
    const docs = snap.docs;
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(docs.map((d) => ({
        to: d.data().token, title, body, data, sound: 'default', priority: 'high', channelId: 'pedidos', ttl: 3600,
      }))),
    });
    const out = await res.json().catch(() => ({}));
    // Celulares que ya no existen (app desinstalada): se borran.
    const tickets = Array.isArray(out?.data) ? out.data : [];
    await Promise.all(tickets.map((t, i) => (t?.details?.error === 'DeviceNotRegistered' ? docs[i].ref.delete() : null)));
  } catch (e) {
    logger.warn('No se pudo enviar la notificación', { uid, e: String(e) });
  }
}

const AGENDA = 'https://hululec.com/profesionales/agenda';

/**
 * ¿El precio de la reserva coincide con la tarifa del profesional? Misma
 * fórmula que packages/shared/src/pricing.ts (quote). Las reservas con
 * profesionales de muestra (sin registro) no se revisan.
 */
async function checkPrice(b) {
  if (b.pricing !== 'visita') return { ok: true };
  const snap = await db().doc(`providers/${b.professionalId}`).get();
  if (!snap.exists) return { ok: true };
  const p = snap.data();
  const pubDoc = (await db().doc(`pros/${b.professionalId}`).get()).data();
  // Fuera de horario o feriado: solo si el profesional lo activó (los de prueba, libres).
  const tester = p.tester === true;
  const refusal = tester ? '' : offHoursRefusal(p, b.date, b.slot);
  if (refusal && offHoursRefusal(pubDoc, b.date, b.slot)) return { ok: false, total: 0, reason: refusal };
  const sc = tester ? { kind: null, amount: 0 } : surchargeOf(p, b.date, b.slot);
  const visit = r2(visitRateOf(p, b.category));
  const fee = PLATFORM_FEE;
  // Régimen del profesional: define si la visita lleva IVA.
  const regime = regimeOf(p.taxRegime);
  const total = priceOf(sc.amount > 0 ? sc.amount : visit, 0, regime).total;
  if (b.pricingVersion !== 2 && sc.amount > 0 && !(b.createdAt?.toMillis?.() < Date.parse('2026-10-24T14:17:23Z'))) return { ok: false, total, reason: 'Actualiza HULUL para reservar con la tarifa especial completa, sin recargos acumulados.' };
  const near = (x, y) => Math.abs(Number(x ?? 0) - y) < 0.02;
  // También vale la tarifa publicada en el directorio (por si cambió hace segundos).
  const pub = pubDoc?.visitRates?.[b.category];
  const pubSc = tester ? sc : surchargeOf(pubDoc, b.date, b.slot);
  const okFor = (v, s) => {
    const appliedVisit = b.pricingVersion === 2 && s.amount > 0 ? s.amount : v;
    const extra = b.pricingVersion === 2 ? 0 : s.amount;
    const q = priceOf(appliedVisit, extra, regime);
    // Apps anteriores calculaban el IVA sobre (visita + cargo) en un solo paso: también vale.
    const legacyIva = r2((q.subtotal + fee) * IVA_RATE);
    const ivaOk = near(b.iva, q.iva) || (chargesVat(regime) && near(b.iva, legacyIva));
    const totalOk = near(b.total, q.total) || (chargesVat(regime) && near(b.total, r2(q.subtotal + fee + legacyIva)));
    return near(b.visit, appliedVisit) && near(b.surcharge, extra) && (s.amount === 0 || b.surchargeKind === s.kind)
      && near(b.subtotal, q.subtotal) && near(b.fee, fee) && ivaOk && totalOk;
  };
  const pubOk = Number.isFinite(Number(pub)) && (okFor(r2(Number(pub)), sc) || okFor(r2(Number(pub)), pubSc));
  return { ok: okFor(visit, sc) || okFor(visit, pubSc) || pubOk, total, regime };
}

export const avisoReserva = onDocumentCreated(
  { document: 'bookings/{id}', region: REGION, secrets: [MAIL_PASSWORD] },
  async (event) => {
    const b = event.data?.data();
    if (!b) return;
    const mail = transport();
    // Malas palabras en la descripción: se tapan antes de que la lea el profesional.
    if (b.notes && hasProfanity(b.notes)) {
      b.notes = maskProfanity(b.notes);
      await event.data.ref.update({ notes: b.notes }).catch(() => {});
    }
    // El precio lo vuelve a calcular el servidor con la tarifa real del
    // profesional: si alguien lo alteró desde el celular, la reserva se anula.
    try {
      // Una hora que ya pasó no se reserva (la app y la web ya lo impiden; esto cubre llamadas directas).
      const past = appointmentMs(b.date, b.slot) < Date.now() - 10 * 60_000;
      const priced = past ? { ok: false, total: Number(b.total ?? 0), reason: 'La hora elegida ya pasó.' } : await checkPrice(b);
      if (!priced.ok) {
        await event.data.ref.update({ status: 'cancelada', cancelledBy: 'sistema', cancelledAt: FieldValue.serverTimestamp(), cancelFee: 0,
          cancelReason: priced.reason ? `${priced.reason} Elige otra hora: no se te cobró nada.` : 'El precio de la reserva no coincide con la tarifa del profesional. Vuelve a reservar para ver el precio correcto.', expectedTotal: priced.total });
        await pushTo(b.clientId, 'Revisa tu reserva', priced.reason ? `${priced.reason} Vuelve a reservar: no se te cobró nada.` : 'El precio no coincidía con la tarifa actual del profesional. Vuelve a reservar: no se te cobró nada.', { bookingId: event.params.id, to: 'cliente' }).catch(() => {});
        const { from, notifyTo } = senders();
        await mail.sendMail({ from, to: notifyTo, subject: `Reserva anulada ${past ? '(hora pasada)' : 'por precio'} ${code(event.params.id)}`,
          html: layout('Precio alterado o desactualizado', rows([['Código', code(event.params.id)], ['Cliente', esc(b.contactName)], ['Profesional', esc(b.professionalName)], ['Enviado', usd(b.total)], ['Correcto', usd(priced.total)]])) }).catch(() => {});
        logger.warn('Reserva anulada: precio no coincide', { id: event.params.id, sent: b.total, expected: priced.total });
        return;
      }
      // El régimen y el IVA de la visita los fija el servidor (facturas y libro de movimientos).
      if (priced.regime) {
        const q = priceOf(Number(b.visit ?? 0), Number(b.surcharge ?? 0), priced.regime);
        b.taxRegime = priced.regime;
        b.visitIva = q.proInvoice.iva;
        await event.data.ref.update({ taxRegime: priced.regime, visitIva: q.proInvoice.iva }).catch(() => {});
      }
    } catch (e) {
      logger.warn('No se pudo validar el precio', { id: event.params.id, e: String(e) });
    }
    // Código de llegada: solo lo ve el cliente; el profesional lo pide para empezar.
    await db().doc(`bookings/${event.params.id}/private/llegada`).set({ code: String(randomInt(1000, 10000)), createdAt: FieldValue.serverTimestamp() });
    // Aviso al profesional real (si es uno registrado y aprobado): primero la
    // notificación al celular, para que no dependa del correo.
    try {
      const pro = await db().doc(`providers/${b.professionalId}`).get();
      const p = pro.exists ? pro.data() : null;
      if (p?.status === 'aprobado') {
        await pushTo(b.professionalId, `Nueva reserva · ${CATEGORIES[b.category] ?? b.category}`,
          `${longDate(b.date)} a las ${b.slot}. ${String(b.notes ?? '').slice(0, 80)} Acéptala o recházala en tu agenda.`,
          { url: AGENDA, bookingId: event.params.id, to: 'pro' });
      }
      if (p?.email && p.status === 'aprobado') await mail.sendMail(proBookingEmail(b, event.params.id, p, senders()));
    } catch (e) {
      logger.warn('No se pudo avisar al profesional', { id: event.params.id, e: String(e) });
    }
    for (const m of bookingEmails(b, event.params.id, senders())) await mail.sendMail(m);
    logger.info('Avisos de reserva enviados', { id: event.params.id });
  },
);

export const avisoProfesional = onDocumentCreated(
  { document: 'applications/{id}', region: REGION, secrets: [MAIL_PASSWORD] },
  async (event) => {
    const a = event.data?.data();
    if (!a) return;
    await transport().sendMail(applicationEmail(a, senders()));
    logger.info('Aviso de profesional enviado', { id: event.params.id });
  },
);

const EVIDENCE = { certificado: 'Certificado o título', experiencia: 'Experiencia' };
/** "Experiencia: 8 años en taller… · Ref.: Juan 099… · 3 archivos" */
function evidenceText(e) {
  if (!e) return 'Sin validación';
  return [`${EVIDENCE[e.kind] ?? e.kind}: ${esc(e.note)}`, e.reference ? `Ref.: ${esc(e.reference)}` : '', `${(e.files ?? []).length} archivo(s)`].filter(Boolean).join(' · ');
}

/** Correos cuando un profesional envía su registro a revisión. */
export function providerEmails(p, uid, { from, notifyTo }) {
  const name = p.kind === 'empresa' ? `${p.businessName} (${p.firstName} ${p.lastName})` : `${p.firstName} ${p.lastName}`;
  const cats = (p.categories ?? []).map((c) => `${CATEGORIES[c] ?? c} · ${usd(visitRateOf(p, c))} por visita<br><span style="color:#6B6560;font-size:13px">${evidenceText(p.catEvidence?.[c])}</span>`).join('<br>');
  const firstName = String(p.firstName ?? '').split(' ')[0];
  const waText = `Hola ${firstName}, te escribimos de HULUL por tu registro como profesional.`;
  const admin = rows([
    ['Nombre', esc(name)],
    ['Cédula', esc(p.cedula)],
    ['RUC', esc(p.ruc)],
    ['Celular', esc(p.phone)],
    ['Correo', esc(p.email)],
    ['Servicios', cats],
    ['Ciudades', esc((p.cities ?? []).join(', '))],
    ['Horario', esc(`${(p.days ?? []).length} días · ${p.from} a ${p.to}`)],
    ['Efectivo', p.acceptsCash ? 'Acepta' : 'No'],
    ['Documentos', esc(Object.keys(p.docs ?? {}).join(', '))],
  ]) +
    `<p style="font-size:13px;color:#6B6560;margin-top:12px">Para aprobar: en Firestore cambia <b>status</b> a <b>aprobado</b> (o <b>observado</b> si hay que corregir algo). Al aprobar, se aprueban todas las categorías en revisión; si alguna no la demostró, antes cambia <b>catStatus.&lt;categoría&gt;</b> a <b>rechazado</b> u <b>observado</b>. Los documentos están en Storage, carpeta providers/${esc(uid)}.</p>` +
    button(`https://console.firebase.google.com/project/${PROJECT}/firestore/databases/-default-/data/~2Fproviders~2F${uid}`, 'Revisar en Firebase') +
    button(`https://console.firebase.google.com/project/${PROJECT}/storage/hulul-59081.firebasestorage.app/files/~2Fproviders~2F${uid}`, 'Ver documentos', '#9A5B34') +
    button(`https://wa.me/${waNumber(p.phone)}?text=${encodeURIComponent(waText)}`, 'WhatsApp', '#1F7A4A');
  const out = [{ from, to: notifyTo, replyTo: p.email || undefined, subject: `Registro de profesional por revisar: ${name}`, html: layout('Nuevo profesional por revisar', admin) }];
  if (p.email) {
    out.push({
      from, to: p.email, replyTo: notifyTo,
      subject: 'Recibimos tu registro en HULUL',
      html: layout('Tu registro está en revisión', `<p style="font-size:15px">Hola ${esc(firstName)}, recibimos tus datos y documentos. Los revisamos en 1 a 3 días hábiles y te escribimos por WhatsApp y correo con el resultado.</p>`),
    });
  }
  return out;
}

export const avisoRegistroProfesional = onDocumentUpdated(
  { document: 'providers/{uid}', region: REGION, secrets: [MAIL_PASSWORD] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after || after.status !== 'en_revision' || before?.status === 'en_revision') return;
    // Cada categoría queda en revisión (las que HULUL ya aprobó o rechazó se conservan).
    const catStatus = { ...(after.catStatus ?? {}) };
    for (const c of after.categories ?? []) if (!['aprobado', 'rechazado'].includes(catStatus[c])) catStatus[c] = 'en_revision';
    await event.data.after.ref.set({ catStatus }, { merge: true });
    const mail = transport();
    for (const m of providerEmails(after, event.params.uid, senders())) await mail.sendMail(m);
    logger.info('Aviso de registro de profesional enviado', { uid: event.params.uid });
  },
);

/** Correo al profesional: tiene una reserva nueva. */
export function proBookingEmail(b, id, p, { from, notifyTo }) {
  const cat = CATEGORIES[b.category] ?? b.category;
  const when = `${longDate(b.date)} a las ${b.slot}`;
  const firstName = String(b.contactName ?? '').split(' ')[0];
  const body = `<p style="font-size:15px;margin:0 0 12px">Hola ${esc(p.firstName)}, tienes una reserva nueva en HULUL.</p>` +
    rows([
      ['Código', `<strong>${code(id)}</strong>${b.demo ? ' <span style="color:#9A5B34">(prueba)</span>' : ''}`],
      ['Servicio', esc(cat)],
      ['Fecha', esc(when)],
      ['Cliente', esc(firstName)],
      ['Dirección', esc(b.address)],
      ['Ubicación', mapRow(b.location)],
      ['Trabajo', esc(b.notes)],
      ...(Array.isArray(b.photos) && b.photos.length ? [['Fotos', b.photos.slice(0, 4).map((u, i) => `<a href="${esc(u)}" style="color:#7A1E2C">Foto ${i + 1}</a>`).join(' · ')]] : []),
      ['Pago', esc(PAYMENTS[b.paymentMethod] ?? b.paymentMethod)],
      ...(Number(b.surcharge) > 0 ? [[SURCHARGE_NAMES[b.surchargeKind] ?? 'Recargo', `${usd(b.surcharge)} (tu recargo)`]] : []),
      ...(b.noiseAccepted ? [['Ruido', 'El cliente aceptó responder ante vecinos y administración. Si no te dejan trabajar, marca "Cliente ausente".']] : []),
      ['Te queda', `<strong>${usd(((b.visit ?? b.subtotal ?? 0) + (Number(b.surcharge) || 0)) * 0.85)}</strong> por la visita${Number(b.surcharge) > 0 ? ' y el recargo' : ''} (menos la comisión)`],
    ]) +
    `<p style="font-size:14px;color:#3F3A37;margin-top:16px">Lee bien qué necesita el cliente y acepta solo si sabes hacerlo. Acéptala o recházala en tu agenda.</p>` +
    button('https://hululec.com/profesionales/agenda', 'Abrir mi agenda');
  return { from, to: p.email, replyTo: notifyTo, subject: `Reserva nueva ${code(id)} · ${cat} · ${when}`, html: layout('Tienes una reserva', body) };
}

/** Horas fuera de horario válidas, sin repetir. */
const cleanOffHours = (xs) => (Array.isArray(xs) ? [...new Set(xs.map(Number).filter((h) => OFF_HOURS.includes(h)))] : []);

/** Datos públicos de un profesional aprobado (nada de cédula, RUC, contacto ni banco). */
export function publicPro(p, uid) {
  const name = p.kind === 'empresa' ? String(p.businessName ?? '').trim() : `${String(p.firstName ?? '').trim()} ${String(p.lastName ?? '').trim()}`.trim();
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return {
    uid, name, initials, isCompany: p.kind === 'empresa',
    categories: approvedCats(p), services: p.services ?? {},
    visitRates: Object.fromEntries(approvedCats(p).map((c) => [c, visitRateOf(p, c)])),
    cities: p.cities ?? [], years: Number(p.years ?? 0), bio: String(p.bio ?? ''),
    days: p.days ?? [], from: p.from ?? '', to: p.to ?? '', acceptsCash: !!p.acceptsCash,
    // Fuera de horario y feriados: horas que activó y sus recargos (monto fijo).
    offHours: cleanOffHours(p.offHours), holidays: p.holidays === true,
    surcharges: { nocturno: validSurcharge(p.surcharges?.nocturno) ?? 0, feriado: validSurcharge(p.surcharges?.feriado) ?? 0 },
    // Profesional de pruebas (se marca a mano en la consola): horario libre en el periodo de prueba.
    tester: p.tester === true,
    // Régimen tributario: el cliente ve el precio con o sin IVA en la visita.
    taxRegime: regimeOf(p.taxRegime),
  };
}

/**
 * Al aprobar a un profesional (status "aprobado" en la consola), aparece en
 * HULUL; si se lo suspende, rechaza u observa, desaparece. Su calificación se
 * conserva.
 */
export const directorioProfesionales = onDocumentWritten(
  { document: 'providers/{uid}', region: REGION, secrets: [MAIL_PASSWORD] },
  async (event) => {
    const uid = event.params.uid;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const ref = db().doc(`pros/${uid}`);
    if (!after || after.status !== 'aprobado') {
      if (before?.status === 'aprobado') { await ref.delete(); logger.info('Profesional retirado del directorio', { uid }); }
      return;
    }
    // Al aprobar el registro, se aprueban las categorías que estaban en revisión.
    if (before?.status !== 'aprobado') {
      const pending = (after.categories ?? []).filter((c) => (after.catStatus ?? {})[c] === 'en_revision');
      if (pending.length) {
        await event.data.after.ref.set({ catStatus: Object.fromEntries(pending.map((c) => [c, 'aprobado'])) }, { merge: true });
        return; // Se vuelve a ejecutar con los datos actualizados.
      }
    }
    // Suspensión automática por faltas (vuelve a ejecutarse con los datos nuevos).
    const sus = strikeSuspension(after);
    if (sus) {
      await event.data.after.ref.set(sus, { merge: true });
      logger.warn('Profesional suspendido por faltas', { uid, until: sus.suspendedUntil });
      return;
    }
    if ((after.suspendedUntil ?? 0) > Date.now() && after.suspendedUntil !== before?.suspendedUntil) {
      const why = after.suspendedReason === 'calificacion'
        ? `tu calificación bajó de ${RATING_MIN} estrellas`
        : `acumulaste ${STRIKE_LIMIT} faltas en ${STRIKE_WINDOW_DAYS} días (llegar tarde, no ir o cancelar a última hora)`;
      const text = `Como ${why}, no recibirás reservas nuevas hasta el ${fmtDay(after.suspendedUntil)}. Los trabajos que ya aceptaste siguen en tu agenda.`;
      await pushTo(uid, 'Tu cuenta está pausada', text, { url: AGENDA, to: 'pro' }).catch(() => {});
      if (after.email) {
        const { from, notifyTo } = senders();
        await transport().sendMail({ from, to: after.email, replyTo: notifyTo, subject: 'Tu cuenta de HULUL está pausada',
          html: layout('Cuenta pausada', `<p style="font-size:15px">Hola ${esc(after.firstName)}. ${esc(text)}</p><p style="font-size:14px">Si crees que hay un error, responde a este correo.</p>`) }).catch(() => {});
        await transport().sendMail({ from, to: notifyTo, subject: `Profesional pausado: ${after.firstName ?? ''} ${after.lastName ?? ''}`, html: layout('Profesional pausado', `<p>${esc(uid)} · ${esc(why)} · hasta ${esc(fmtDay(after.suspendedUntil))}</p>`) }).catch(() => {});
      }
    }
    if (!approvedCats(after).length) {
      await ref.delete().catch(() => {});
      logger.warn('Profesional aprobado sin categorías aprobadas', { uid });
      return;
    }
    const cur = await ref.get();
    // Categorías recién aprobadas (agregadas después del registro).
    const newlyApproved = before?.status === 'aprobado'
      ? approvedCats(after).filter((c) => !approvedCats(before).includes(c))
      : [];
    if (newlyApproved.length && after.email) {
      const { from, notifyTo } = senders();
      await transport().sendMail({
        from, to: after.email, replyTo: notifyTo,
        subject: `Aprobamos ${newlyApproved.map((c) => CATEGORIES[c] ?? c).join(', ')} en tu perfil`,
        html: layout('Nueva categoría aprobada', `<p style="font-size:15px">Hola ${esc(after.firstName)}, ya puedes recibir trabajos de ${esc(newlyApproved.map((c) => CATEGORIES[c] ?? c).join(', '))}.</p>` + button('https://hululec.com/profesionales/agenda', 'Abrir mi agenda')),
      }).catch((e) => logger.warn('No se pudo avisar la categoría aprobada', { uid, e: String(e) }));
    }
    await ref.set({
      ...publicPro(after, uid),
      suspendedUntil: Number(after.suspendedUntil ?? 0),
      ...(cur.exists ? {} : { rating: 0, reviewCount: 0, jobsDone: 0, approvedAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    logger.info('Profesional publicado en el directorio', { uid });
    if (before?.status !== 'aprobado' && after.email) {
      const { from, notifyTo } = senders();
      await transport().sendMail({
        from, to: after.email, replyTo: notifyTo,
        subject: '¡Ya estás en HULUL!',
        html: layout('Tu perfil fue aprobado', `<p style="font-size:15px">Hola ${esc(after.firstName)}, revisamos tus datos y documentos. Tu perfil ya aparece en HULUL y los clientes pueden reservarte. Te llegará un correo por cada reserva.</p>` +
          button('https://hululec.com/profesionales/agenda', 'Abrir mi agenda') + button(`https://hululec.com/profesional/${uid}`, 'Ver mi perfil', '#9A5B34')),
      });
    }
  },
);

/* ------------------------------ Cancelación ------------------------------ */

// Misma regla que packages/shared/src/policy.ts (cancelTerms). Si cambias una, cambia la otra.
const FREE_CANCEL_HOURS = 2;
const LATE_CANCEL_FEE = 3;
const CANCELLABLE = ['pendiente', 'confirmada', 'en_camino'];

const EARLIEST_DEPART_MIN = 120;
const appointmentMs = (date, slot) => {
  const [y, m, d] = String(date).split('-').map(Number);
  const [h, min] = String(slot).split(':').map(Number);
  return Date.UTC(y, m - 1, d, h + 5, min); // Ecuador, UTC-5
};
/** Hora efectiva de la cita: la reservada más el retraso que el cliente aceptó. */
const effectiveMs = (b) => appointmentMs(b.date, b.slot) + (b.delay?.status === 'aceptado' ? Number(b.delay.minutes || 0) * 60_000 : 0);

/**
 * ¿Choca un horario con otro trabajo confirmado del mismo profesional ese día?
 * Deja al menos TRAVEL_GAP_MIN de traslado. Devuelve la reserva que choca o null.
 * La usan aceptar una reserva y aceptar un cambio de hora.
 */
async function findClash(tx, proId, id, date, startMs, hours) {
  const mine = await tx.get(db().collection('bookings').where('professionalId', '==', proId).where('date', '==', date));
  const end = startMs + Number(hours ?? 1) * 3_600_000;
  const gap = TRAVEL_GAP_MIN * 60_000;
  const hit = mine.docs.find((d) => {
    if (d.id === id) return false;
    const o = d.data();
    if (!['confirmada', 'en_camino', 'en_curso'].includes(o.status)) return false;
    const os = effectiveMs(o);
    const oe = os + Number(o.hours ?? 1) * 3_600_000;
    return startMs < oe + gap && os < end + gap;
  });
  return hit ? hit.data() : null;
}
const hhmm = (ms) => { const e = new Date(ms - 5 * 3_600_000); return `${String(e.getUTCHours()).padStart(2, '0')}:${String(e.getUTCMinutes()).padStart(2, '0')}`; };

export function cancelFee(b, now = new Date()) {
  if (!CANCELLABLE.includes(b.status)) return null;
  if (b.status === 'en_camino') return LATE_CANCEL_FEE;
  if (b.status === 'pendiente') return 0;
  const [y, m, d] = String(b.date).split('-').map(Number);
  const [h, min] = String(b.slot).split(':').map(Number);
  const at = Date.UTC(y, m - 1, d, h + 5, min); // Ecuador, UTC-5
  return now.getTime() < at - FREE_CANCEL_HOURS * 3_600_000 ? 0 : LATE_CANCEL_FEE;
}

// Mismos valores que POLICY (policy.ts).
const LATE_TOLERANCE_MIN = 15;
const VERY_LATE_MIN = 30;
const CLIENT_WAIT_MIN = 10;
// Antes de marcar "cliente ausente", el profesional timbra 3 veces (cada 3 min como mínimo).
const RINGS_BEFORE_ABSENT = 3;
const RING_GAP_MIN = 3;
const PRO_LATE_FINE = 5;
const PRO_NOSHOW_FINE = 10;
const LATE_CREDIT = 5;

/* ------------------------- Faltas y suspensiones ------------------------- */

// 3 faltas en 30 días: 7 días sin recibir trabajos. Calificación menor a 3.5
// con 5 o más reseñas: 14 días. Las faltas anteriores a una suspensión no se
// vuelven a contar. Lo revisa el servidor; el profesional no puede cambiarlo.
const STRIKE_LIMIT = 3;
const STRIKE_WINDOW_DAYS = 30;
const STRIKE_SUSPEND_DAYS = 7;
const RATING_MIN = 3.5;
const RATING_MIN_REVIEWS = 5;
const RATING_SUSPEND_DAYS = 14;
const DAY_MS = 86_400_000;

/** Datos para sumar una falta (con fecha, para contar las de los últimos 30 días). */
const strikeData = (extra = {}) => ({ strikes: FieldValue.increment(1), strikeLog: FieldValue.arrayUnion(Date.now() + randomInt(1000) / 1000), ...extra });

/** Si con sus faltas recientes corresponde suspenderlo, lo que hay que guardar. */
function strikeSuspension(p, now = Date.now()) {
  if ((p.suspendedUntil ?? 0) > now) return null;
  const since = Math.max(now - STRIKE_WINDOW_DAYS * DAY_MS, Number(p.strikesResetAt ?? 0));
  const recent = (p.strikeLog ?? []).filter((t) => Number(t) > since).length;
  if (recent < STRIKE_LIMIT) return null;
  return { suspendedUntil: now + STRIKE_SUSPEND_DAYS * DAY_MS, suspendedReason: 'faltas', suspendedAt: now, strikesResetAt: now, suspensions: FieldValue.increment(1) };
}

const fmtDay = (ms) => { const d = new Date(ms - 5 * 3_600_000); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} a las ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

/**
 * Lo que cuesta al cliente cancelar ahora y si la culpa es del profesional:
 * - confirmada y pasaron 15 min de la hora sin que salga: gratis, falta del profesional ($10).
 * - en camino con más de 30 min de retraso: gratis, falta del profesional ($5).
 * - si no, la regla normal (cancelFee).
 */
export function clientCancel(b, now = new Date()) {
  const fee = cancelFee(b, now);
  if (fee === null) return null;
  // Con un retraso aceptado por el cliente, se cuenta desde la nueva hora.
  const late = (now.getTime() - effectiveMs(b)) / 60_000;
  if (b.status === 'confirmada' && late >= LATE_TOLERANCE_MIN) return { fee: 0, proFault: 'no_salio', proFine: PRO_NOSHOW_FINE };
  if (b.status === 'en_camino' && late >= VERY_LATE_MIN) return { fee: 0, proFault: 'muy_tarde', proFine: PRO_LATE_FINE };
  // El profesional ya está en la puerta (y llegó a tiempo): se cobra la visita completa.
  const arrived = b.arrivedAt?.toMillis?.() ?? 0;
  if (b.status === 'en_camino' && arrived && arrived <= effectiveMs(b) + LATE_TOLERANCE_MIN * 60_000) {
    return { fee: Number(b.visit ?? b.subtotal ?? fee), atDoor: true };
  }
  return { fee };
}

/**
 * El cliente cancela su reserva. El cargo lo calcula el servidor (no la web
 * ni la app) y queda registrado en la reserva y como saldo del cliente.
 */
export const cancelarReserva = onCall(
  { region: REGION, secrets: [MAIL_PASSWORD] },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión para cancelar.');
    const id = String(req.data?.id ?? '');
    const reason = String(req.data?.reason ?? '').slice(0, 300);
    if (!/^[A-Za-z0-9]{10,40}$/.test(id)) throw new HttpsError('invalid-argument', 'Reserva no válida.');
    if (hasProfanity(reason)) throw new HttpsError('invalid-argument', PROFANITY_MESSAGE);
    const ref = db().doc(`bookings/${id}`);

    const result = await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'No encontramos esa reserva.');
      const b = snap.data();
      if (b.clientId !== uid) throw new HttpsError('permission-denied', 'Esta reserva no es tuya.');
      const terms = clientCancel(b);
      if (terms === null) throw new HttpsError('failed-precondition', b.status === 'cancelada' ? 'Esta reserva ya está cancelada.' : 'El servicio ya empezó o terminó; no se puede cancelar.');
      const fee = terms.fee;
      tx.update(ref, {
        status: 'cancelada', cancelledBy: 'cliente', cancelledAt: FieldValue.serverTimestamp(),
        cancelFee: fee, cancelReason: reason, previousStatus: b.status, ...(terms.atDoor ? { cancelledAtDoor: true } : {}),
        ...(terms.proFault ? { proFault: terms.proFault, proFine: terms.proFine, clientCredit: LATE_CREDIT } : {}),
      });
      // Falta del profesional: multa, falta y crédito para el cliente.
      if (terms.proFault && !b.demo) {
        tx.set(db().doc(`providers/${b.professionalId}`), strikeData({ fines: FieldValue.increment(terms.proFine) }), { merge: true });
        tx.set(db().doc(`clients/${uid}`), { credit: FieldValue.increment(LATE_CREDIT) }, { merge: true });
      }
      // Con tarjeta se descontará del monto retenido; sin tarjeta queda como saldo pendiente.
      if (fee > 0 && !b.demo) tx.set(db().doc(`clients/${uid}`), { balance: FieldValue.increment(fee) }, { merge: true });
      return { b, fee };
    });

    const { b, fee } = result;
    try {
      const { from, notifyTo } = senders();
      const mail = transport();
      const cat = CATEGORIES[b.category] ?? b.category;
      const when = `${longDate(b.date)} a las ${b.slot}`;
      const feeText = fee > 0 ? `Cargo por cancelación tardía: <strong>${usd(fee)}</strong>${b.demo ? ' (versión de prueba: no se cobra)' : ''}.` : 'Sin costo.';
      const info = rows([['Código', `<strong>${code(id)}</strong>`], ['Servicio', esc(cat)], ['Profesional', esc(b.professionalName)], ['Fecha', esc(when)], ['Cancelación', feeText], ...(reason ? [['Motivo', esc(reason)]] : [])]);
      await mail.sendMail({ from, to: notifyTo, subject: `Reserva cancelada ${code(id)} · ${cat}${fee > 0 ? ` · cargo ${usd(fee)}` : ''}`, html: layout('El cliente canceló una reserva', info) });
      if (b.contactEmail) await mail.sendMail({ from, to: b.contactEmail, replyTo: notifyTo, subject: `Cancelaste tu reserva ${code(id)}`, html: layout('Reserva cancelada', info) });
      const pro = await db().doc(`providers/${b.professionalId}`).get();
      const p = pro.exists ? pro.data() : null;
      await pushTo(b.professionalId, 'Reserva cancelada', `El cliente canceló ${cat} del ${when}. Ya no tienes que ir.`, { url: AGENDA, bookingId: id, to: 'pro' });
      if (p?.email && p.status === 'aprobado') {
        await mail.sendMail({ from, to: p.email, replyTo: notifyTo, subject: `Se canceló la reserva ${code(id)} del ${when}`,
          html: layout('Reserva cancelada', `<p style="font-size:15px">Hola ${esc(p.firstName)}, el cliente canceló esta reserva. Ya no tienes que ir.</p>` + rows([['Código', code(id)], ['Servicio', esc(cat)], ['Fecha', esc(when)]]) +
            (fee > 0 ? `<p style="font-size:14px">Por cancelar tarde, el cliente paga ${usd(fee)}; el 80 % es para ti.</p>` : '')) });
      }
    } catch (e) {
      logger.warn('No se pudieron enviar los correos de cancelación', { id, e: String(e) });
    }
    logger.info('Reserva cancelada por el cliente', { id, fee });
    return { fee };
  },
);

/* --------------------------- Agenda del profesional --------------------------- */

/** Distancia máxima para marcar "Estoy en la dirección" (más el margen del GPS). */
const ARRIVAL_RADIUS_M = 250;
/** Traslado mínimo entre dos trabajos aceptados el mismo día. */
const TRAVEL_GAP_MIN = 30;
/** Distancia en metros entre dos puntos. */
function meters(a, b) {
  const R = 6_371_000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Qué puede hacer el profesional en cada estado. */
const PRO_ACTIONS = {
  aceptar: { from: ['pendiente'], to: 'confirmada', stamp: 'acceptedAt' },
  rechazar: { from: ['pendiente'], to: 'cancelada', stamp: 'cancelledAt' },
  en_camino: { from: ['confirmada'], to: 'en_camino', stamp: 'enRouteAt' },
  // "Estoy en la dirección": marca la llegada (el cliente recibe aviso) sin empezar.
  en_puerta: { from: ['en_camino'], to: 'en_camino', stamp: 'arrivedAt' },
  // Empezar: con el código de 4 dígitos que le da el cliente.
  llegue: { from: ['en_camino'], to: 'en_curso', stamp: 'startedAt' },
  terminar: { from: ['en_curso'], to: 'por_aprobar', stamp: 'finishedAt' },
  no_puedo: { from: ['confirmada', 'en_camino'], to: 'cancelada', stamp: 'cancelledAt' },
  // Llegó, esperó 10 minutos y el cliente no está ni responde.
  cliente_ausente: { from: ['en_camino'], to: 'cancelada', stamp: 'cancelledAt' },
};

/**
 * El profesional acepta, rechaza, sale, llega o termina un servicio. Lo
 * valida el servidor: solo el profesional asignado y aprobado, y solo en el
 * orden correcto. El cliente ve el cambio al instante en su seguimiento.
 */
export const gestionarReserva = onCall(
  { region: REGION, secrets: [MAIL_PASSWORD] },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión.');
    const id = String(req.data?.id ?? '');
    const action = String(req.data?.action ?? '');
    const reason = String(req.data?.reason ?? '').slice(0, 300);
    if (hasProfanity(reason)) throw new HttpsError('invalid-argument', PROFANITY_MESSAGE);
    const rule = PRO_ACTIONS[action];
    if (!rule || !/^[A-Za-z0-9]{10,40}$/.test(id)) throw new HttpsError('invalid-argument', 'Acción no válida.');
    // Al terminar: resultado, diagnóstico escrito y fotos (respaldo para ambos).
    let report = null;
    if (action === 'terminar') {
      const outcome = String(req.data?.outcome ?? '');
      const diagnosis = String(req.data?.diagnosis ?? '').trim().slice(0, 1500);
      const photos = Array.isArray(req.data?.photos) ? req.data.photos.map(String) : [];
      if (!OUTCOMES[outcome]) throw new HttpsError('invalid-argument', 'Elige cómo quedó el servicio.');
      if (outcome !== 'resuelto' && diagnosis.length < 20) throw new HttpsError('invalid-argument', 'Cuéntale al cliente qué pasó y qué recomiendas (mínimo 20 caracteres).');
      if (hasProfanity(diagnosis)) throw new HttpsError('invalid-argument', PROFANITY_MESSAGE);
      if (photos.length < 1) throw new HttpsError('invalid-argument', 'Sube al menos una foto del trabajo, haya quedado resuelto o no.');
      if (photos.length > 6) throw new HttpsError('invalid-argument', 'Máximo 6 fotos.');
      const prefix = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(`diagnosticos/${uid}/${id}/`)}`;
      if (photos.some((u) => !u.startsWith(prefix))) throw new HttpsError('invalid-argument', 'Fotos no válidas.');
      report = { outcome, diagnosis, diagnosisPhotos: photos };
    }
    const proSnap = await db().doc(`providers/${uid}`).get();
    const pro = proSnap.data();
    if (!pro || pro.status !== 'aprobado') throw new HttpsError('permission-denied', 'Tu cuenta de profesional no está activa.');
    if (action === 'aceptar' && (pro.suspendedUntil ?? 0) > Date.now()) {
      throw new HttpsError('permission-denied', `Tu cuenta está pausada hasta el ${fmtDay(pro.suspendedUntil)}: no puedes aceptar trabajos nuevos.`);
    }
    // "Estoy en la dirección": se comprueba con el GPS del celular.
    let pos = null;
    if (action === 'en_puerta') {
      const q = req.data?.pos;
      const lat = Number(q?.lat), lng = Number(q?.lng), acc = Number(q?.accuracy ?? 0);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) pos = { lat, lng, accuracy: Number.isFinite(acc) ? Math.round(acc) : null };
    }
    const testing = pro.tester === true && Date.now() < Date.UTC(2026, 10, 1, 5);
    const ref = db().doc(`bookings/${id}`);

    const b = await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'No encontramos esa reserva.');
      const cur = snap.data();
      if (cur.professionalId !== uid) throw new HttpsError('permission-denied', 'Esta reserva no es tuya.');
      if (!rule.from.includes(cur.status)) throw new HttpsError('failed-precondition', 'La reserva cambió de estado. Actualiza la página.');
      if (action === 'en_camino') {
        const at = appointmentMs(cur.date, cur.slot);
        const earliest = at - EARLIEST_DEPART_MIN * 60_000;
        if (Date.now() < earliest) {
          throw new HttpsError('failed-precondition', `Aún es temprano: la cita es a las ${cur.slot}. Podrás marcar "Voy en camino" desde las ${hhmm(earliest)}. Si quieres ir antes, propón otra hora al cliente.`);
        }
      }
      const patch = { status: rule.to, [rule.stamp]: FieldValue.serverTimestamp(), previousStatus: cur.status, ...(report ?? {}) };
      if (action === 'en_puerta' && cur.arrivedAt) throw new HttpsError('failed-precondition', 'Ya marcaste que estás en la dirección.');
      if (action === 'en_puerta' && cur.location) {
        if (!pos) throw new HttpsError('failed-precondition', 'Activa la ubicación del celular para marcar que llegaste. Así el cliente sabe que de verdad estás en su puerta.');
        const dist = Math.round(meters(pos, cur.location));
        const allowed = ARRIVAL_RADIUS_M + Math.min(pos.accuracy ?? 0, 150);
        patch.arrivedPos = { ...pos, distance: dist };
        if (dist > allowed && !testing) {
          throw new HttpsError('failed-precondition', `Tu ubicación está a ${dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${dist} m`} de la dirección del cliente. Marca "Estoy en la dirección" cuando llegues.`);
        }
      }
      if (action === 'aceptar') {
        // No se aceptan dos trabajos que se crucen (con 30 min de traslado entre uno y otro).
        const o = await findClash(tx, uid, id, cur.date, effectiveMs(cur), cur.hours);
        if (o) {
          throw new HttpsError('failed-precondition', `Ese día ya tienes ${CATEGORIES[o.category] ?? o.category} a las ${o.slot} (unas ${o.hours ?? 1} h). Entre un trabajo y otro deja al menos ${TRAVEL_GAP_MIN} min de traslado. Propón otra hora al cliente o recházala.`);
        }
      }
      if (action === 'llegue') {
        // Solo se empieza con el cliente presente: pide su código de llegada.
        const priv = await tx.get(db().doc(`bookings/${id}/private/llegada`));
        if (priv.exists && String(req.data?.code ?? '').trim() !== String(priv.data().code)) {
          throw new HttpsError('permission-denied', 'El código no coincide. Pídele al cliente el código de 4 dígitos que ve en su reserva.');
        }
        if (!cur.arrivedAt) patch.arrivedAt = FieldValue.serverTimestamp();
      }
      if (action === 'cliente_ausente') {
        const arrived = cur.arrivedAt?.toMillis?.() ?? 0;
        if (!arrived) throw new HttpsError('failed-precondition', 'Primero marca "Estoy en la dirección" para que el cliente reciba el aviso.');
        // La espera cuenta desde la llegada o desde la hora de la cita, lo que sea
        // más tarde: llegar antes no acorta la espera del cliente.
        const from = Math.max(arrived, effectiveMs(cur));
        const wait = CLIENT_WAIT_MIN * 60_000 - (Date.now() - from);
        if (wait > 0) throw new HttpsError('failed-precondition', `Espera ${Math.ceil(wait / 60_000)} min más: el cliente tiene ${CLIENT_WAIT_MIN} minutos desde la hora de la cita (o desde que llegaste, si llegaste tarde).`);
        const rings = Array.isArray(cur.rings) ? cur.rings.length : 0;
        if (rings < RINGS_BEFORE_ABSENT) throw new HttpsError('failed-precondition', `Antes de cancelar, timbra al cliente ${RINGS_BEFORE_ABSENT} veces (llevas ${rings}). Así queda constancia de que lo buscaste.`);
        // Si llegó tarde (más de 15 min después de la hora, contando el retraso
        // aceptado), no es culpa del cliente: no se le cobra y es falta del profesional.
        const arrivedLate = arrived > effectiveMs(cur) + LATE_TOLERANCE_MIN * 60_000;
        const fee = arrivedLate ? 0 : Number(cur.visit ?? cur.subtotal ?? 0);
        patch.cancelledBy = 'cliente_ausente';
        patch.cancelReason = reason || 'El cliente no estaba en la dirección ni respondió.';
        patch.cancelFee = fee;
        if (arrivedLate) {
          patch.arrivedLate = true;
          patch.proFault = 'llego_tarde';
          patch.cancelledBy = 'profesional_tarde';
          if (!cur.demo) tx.set(db().doc(`providers/${uid}`), strikeData(), { merge: true });
        } else if (fee > 0 && !cur.demo) {
          tx.set(db().doc(`clients/${cur.clientId}`), { balance: FieldValue.increment(fee), noShows: FieldValue.increment(1) }, { merge: true });
        }
      }
      if (action === 'rechazar' || action === 'no_puedo') {
        patch.cancelledBy = 'profesional';
        patch.cancelReason = reason;
        patch.cancelFee = 0;
        // Cancelar algo ya aceptado con menos de 2 horas (o yendo en camino) es una falta.
        if (action === 'no_puedo' && cancelFee({ ...cur, status: cur.status }) > 0) {
          patch.proFine = 5;
          tx.set(db().doc(`providers/${uid}`), strikeData({ fines: FieldValue.increment(5) }), { merge: true });
        }
      }
      tx.update(ref, patch);
      return cur;
    });

    // Aviso al cliente (y a HULUL si se cayó la reserva).
    try {
      const { from, notifyTo } = senders();
      const mail = transport();
      const cat = CATEGORIES[b.category] ?? b.category;
      const when = `${longDate(b.date)} a las ${b.slot}`;
      const first = String(b.contactName ?? '').split(' ')[0];
      const arrivedLate = action === 'cliente_ausente' && (b.arrivedAt?.toMillis?.() ?? 0) > effectiveMs(b) + LATE_TOLERANCE_MIN * 60_000;
      const msgs = {
        aceptar: [`${b.professionalName} confirmó tu reserva`, `Hola ${esc(first)}, ${esc(b.professionalName)} confirmó tu servicio de ${esc(cat)} para el ${esc(when)}. Te avisaremos cuando salga hacia tu dirección.`],
        en_camino: [`${b.professionalName} va en camino`, `Hola ${esc(first)}, ${esc(b.professionalName)} ya salió hacia ${esc(b.address)}. Míralo en <a href="https://hululec.com/cuenta">Mi cuenta</a>.`],
        en_puerta: [`${b.professionalName} llegó a tu dirección`, `Hola ${esc(first)}, ${esc(b.professionalName)} está en ${esc(b.address)}. Recíbelo y dale tu <strong>código de llegada</strong> (lo ves en tu reserva) para que empiece.${safetyHtml()}`],
        llegue: [`${b.professionalName} empezó tu servicio`, `Hola ${esc(first)}, ${esc(b.professionalName)} empezó tu servicio con tu código de llegada.`],
        terminar: ['Tu servicio terminó', `Hola ${esc(first)}, ${esc(b.professionalName)} terminó tu servicio de ${esc(cat)}.` +
          (report ? rows([['Resultado', `<strong>${esc(outcomeText(report.outcome, b.category))}</strong>`], [reportName(b.category), esc(report.diagnosis) || '—'], ['Fotos', report.diagnosisPhotos.length ? report.diagnosisPhotos.map((u, i) => `<a href="${esc(u)}" style="color:#7A1E2C">Foto ${i + 1}</a>`).join(' · ') : '—']]) : '') +
          `<p style="font-size:14px;color:#3F3A37">${esc(AFTER_VISIT_NOTE)} Tienes 48 horas para calificarlo o pedir ayuda con el servicio en <a href="https://hululec.com/cuenta">Mi cuenta</a>.</p>`],
        rechazar: ['Tu reserva necesita otro profesional', `Hola ${esc(first)}, ${esc(b.professionalName)} no puede atender tu reserva del ${esc(when)}. No se te cobra nada. Elige otro profesional en <a href="https://hululec.com/servicios/${esc(b.category)}">HULUL</a>.`],
        no_puedo: ['Tu profesional canceló', `Hola ${esc(first)}, ${esc(b.professionalName)} canceló tu reserva del ${esc(when)}. No se te cobra nada y te ayudamos a encontrar otro profesional.`],
        cliente_ausente: arrivedLate
          ? ['Tu profesional llegó tarde', `Hola ${esc(first)}, ${esc(b.professionalName)} llegó más tarde de lo acordado y no te encontró. La reserva se canceló sin costo para ti y se le aplicó una falta. Puedes calificarlo en tu reserva.`]
          : ['Tu profesional no te encontró', `Hola ${esc(first)}, ${esc(b.professionalName)} llegó a ${esc(b.address)}, esperó ${CLIENT_WAIT_MIN} minutos y no te encontró. La reserva se canceló y se cobra la visita (${usd(b.visit ?? b.subtotal)}), que compensa su traslado. Si hubo un error, respóndenos a este correo.`],
      }[action];
      const pushText = {
        aceptar: `Confirmó tu servicio de ${cat} para el ${when}.`,
        en_camino: `Va en camino a tu dirección.`,
        en_puerta: 'Está en tu dirección. Recíbelo y dale tu código de llegada (lo ves en tu reserva).',
        llegue: 'Empezó tu servicio. ¡Que lo disfrutes!',
        terminar: 'Terminó tu servicio. Mira el resumen y las fotos, y califícalo.',
        rechazar: `No puede atender tu reserva del ${when}. No se te cobra nada.`,
        no_puedo: `Canceló tu reserva del ${when}. No se te cobra nada.`,
        cliente_ausente: arrivedLate ? 'Llegó más tarde de lo acordado y no te encontró. Se canceló sin costo para ti.' : `Llegó, esperó ${CLIENT_WAIT_MIN} minutos y no te encontró. Se canceló la reserva y se cobra la visita.`,
      }[action];
      if (pushText) await pushTo(b.clientId, msgs?.[0] ?? 'Tu reserva', pushText, { bookingId: id, to: 'cliente' });
      if (msgs && b.contactEmail) await mail.sendMail({ from, to: b.contactEmail, replyTo: notifyTo, subject: msgs[0], html: layout(msgs[0], `<div style="font-size:15px">${msgs[1]}</div>`) });
      if (action === 'rechazar' || action === 'no_puedo') {
        await mail.sendMail({ from, to: notifyTo, subject: `El profesional ${action === 'rechazar' ? 'rechazó' : 'canceló'} la reserva ${code(id)}`,
          html: layout('Reserva sin profesional', rows([['Código', code(id)], ['Profesional', esc(b.professionalName)], ['Cliente', esc(b.contactName)], ['Celular', esc(b.contactPhone)], ['Fecha', esc(when)], ['Motivo', esc(reason)]])) });
      }
    } catch (e) {
      logger.warn('No se pudo avisar el cambio de estado', { id, action, e: String(e) });
    }
    logger.info('Reserva actualizada por el profesional', { id, action });
    return { status: rule.to };
  },
);

/**
 * "Timbrar": el profesional, ya en la dirección, avisa al cliente con una
 * notificación con sonido. Hasta 3 timbres, con al menos 3 minutos entre uno y
 * otro. Cada timbre queda guardado en la reserva (rings) como respaldo para un
 * reclamo. Al tercero sin respuesta (y cumplida la espera) puede marcar
 * "El cliente no está".
 */
export const timbrar = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const id = String(req.data?.id ?? '');
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) throw new HttpsError('invalid-argument', 'Reserva no válida.');
  const ref = db().doc(`bookings/${id}`);
  const { b, n } = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'No encontramos esa reserva.');
    const cur = snap.data();
    if (cur.professionalId !== uid) throw new HttpsError('permission-denied', 'Esta reserva no es tuya.');
    if (cur.status !== 'en_camino' || !cur.arrivedAt) throw new HttpsError('failed-precondition', 'Primero marca "Estoy en la dirección".');
    const rings = Array.isArray(cur.rings) ? cur.rings.map(Number) : [];
    if (rings.length >= RINGS_BEFORE_ABSENT) throw new HttpsError('failed-precondition', 'Ya timbraste 3 veces. Si el cliente no responde, marca "El cliente no está".');
    const last = rings.length ? rings[rings.length - 1] : 0;
    const wait = last + RING_GAP_MIN * 60_000 - Date.now();
    if (wait > 0) throw new HttpsError('failed-precondition', `Puedes volver a timbrar en ${Math.ceil(wait / 60_000)} min.`);
    tx.update(ref, { rings: [...rings, Date.now()] });
    return { b: cur, n: rings.length + 1 };
  });
  const pro = String(b.professionalName ?? 'Tu profesional').split(' ')[0];
  const last = n >= RINGS_BEFORE_ABSENT;
  const late = (b.arrivedAt?.toMillis?.() ?? 0) > effectiveMs(b) + LATE_TOLERANCE_MIN * 60_000;
  await pushTo(b.clientId, `🔔 ${pro} está en tu puerta (aviso ${n} de ${RINGS_BEFORE_ABSENT})`,
    last
      ? `Último aviso: te espera en ${String(b.address ?? 'tu dirección').slice(0, 80)}. Si no respondes, podrá cancelar la visita${late ? '' : ' y se cobrará la visita'}. Escríbele por el chat si necesitas un momento.`
      : `Te espera en ${String(b.address ?? 'tu dirección').slice(0, 80)}. Recíbelo y dale tu código de llegada, o escríbele por el chat.`,
    { bookingId: id, to: 'cliente', ring: n });
  logger.info('Timbre al cliente', { id, n });
  return { rings: n };
});

/* ------------------------ Servicios del profesional ------------------------ */

const SLUG = /^[a-z]{3,30}$/;

function cleanServices(list) {
  return (Array.isArray(list) ? list : []).map((x) => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 40);
}

function cleanEvidence(e, uid, cat) {
  const kind = String(e?.kind ?? '');
  if (!['certificado', 'experiencia'].includes(kind)) throw new HttpsError('invalid-argument', 'Indica cómo demuestras que sabes hacerlo.');
  if (cat === 'salud' && kind !== 'certificado') throw new HttpsError('invalid-argument', 'Salud exige título registrado en la SENESCYT.');
  const note = String(e?.note ?? '').trim().slice(0, 500);
  const reference = String(e?.reference ?? '').trim().slice(0, 160);
  const files = (Array.isArray(e?.files) ? e.files : []).map(String).slice(0, 6);
  if (files.some((f) => !f.startsWith(`providers/${uid}/`))) throw new HttpsError('invalid-argument', 'Archivos no válidos.');
  if (note.length < 5) throw new HttpsError('invalid-argument', 'Describe tu certificado o tu experiencia.');
  if (kind === 'certificado' && files.length < 1) throw new HttpsError('invalid-argument', 'Sube el certificado.');
  if (kind === 'experiencia' && (files.length < 2 || reference.length < 8)) throw new HttpsError('invalid-argument', 'Sube al menos 2 fotos de trabajos y deja una referencia.');
  return { kind, note, reference, files };
}

/**
 * Un profesional aprobado cambia su tarifa por visita y sus trabajos, o suma
 * una categoría nueva (sin límite). La categoría nueva queda en revisión
 * hasta que HULUL la apruebe en la consola (catStatus.<categoría> = aprobado).
 */
export const actualizarServicios = onCall(
  { region: REGION, secrets: [MAIL_PASSWORD] },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión.');
    const action = String(req.data?.action ?? '');
    const ref = db().doc(`providers/${uid}`);
    const snap = await ref.get();
    const p = snap.data();
    if (!p || !['aprobado', 'suspendido'].includes(p.status)) throw new HttpsError('failed-precondition', 'Tu registro aún está en revisión: los cambios se hacen desde el registro.');
    const cats = p.categories ?? [];

    if (action === 'tarifas') {
      const rates = req.data?.visitRates ?? {};
      const services = req.data?.services ?? {};
      const patch = {};
      for (const c of cats) {
        if (c in rates) {
          const r = validRate(Number(rates[c]));
          const { min, max } = rateRange(c);
          if (r === null || r < min || r > max) throw new HttpsError('invalid-argument', `La tarifa de ${CATEGORIES[c] ?? c} debe estar entre $${min} y $${max}.`);
          patch[`visitRates.${c}`] = r;
        }
        if (c in services) patch[`services.${c}`] = cleanServices(services[c]);
      }
      if (!Object.keys(patch).length) throw new HttpsError('invalid-argument', 'No hay cambios.');
      await ref.update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
      return { ok: true };
    }

    if (action === 'horario') {
      const offHours = cleanOffHours(req.data?.offHours);
      const holidays = req.data?.holidays === true;
      const nocturno = req.data?.surcharges?.nocturno;
      const feriado = req.data?.surcharges?.feriado;
      const sc = {};
      for (const [k, v] of [['nocturno', nocturno], ['feriado', feriado]]) {
        if (v === undefined || v === null || v === '') continue;
        const n = validSurcharge(Number(v));
        if (n === null) throw new HttpsError('invalid-argument', `El recargo debe ser un monto entre $0 y $${MAX_SURCHARGE}.`);
        sc[k] = n;
      }
      if (offHours.length && sc.nocturno === undefined) throw new HttpsError('invalid-argument', 'Pon tu recargo nocturno (puede ser $0).');
      if (holidays && sc.feriado === undefined) throw new HttpsError('invalid-argument', 'Pon tu recargo de feriado (puede ser $0).');
      await ref.update({ offHours, holidays, surcharges: sc, updatedAt: FieldValue.serverTimestamp() });
      return { ok: true };
    }

    if (action === 'agregar') {
      const cat = String(req.data?.category ?? '');
      if (!SLUG.test(cat) || !CATEGORIES[cat]) throw new HttpsError('invalid-argument', 'Categoría no válida.');
      const status = p.catStatus?.[cat];
      if (cats.includes(cat) && status !== 'observado' && status !== 'rechazado') throw new HttpsError('already-exists', 'Ya tienes esa categoría.');
      const rate = validRate(Number(req.data?.visitRate));
      const band = rateRange(cat);
      if (rate === null || rate < band.min || rate > band.max) throw new HttpsError('invalid-argument', `La tarifa por visita en ${CATEGORIES[cat]} debe estar entre $${band.min} y $${band.max}.`);
      const services = cleanServices(req.data?.services);
      if (!services.length) throw new HttpsError('invalid-argument', 'Marca al menos un trabajo que haces.');
      const evidence = cleanEvidence(req.data?.evidence, uid, cat);
      // Los registrados antes de la validación por categoría: sus categorías quedan aprobadas.
      const catStatus = p.catStatus ?? Object.fromEntries(cats.map((c) => [c, 'aprobado']));
      await ref.update({
        categories: cats.includes(cat) ? cats : [...cats, cat],
        catStatus: { ...catStatus, [cat]: 'en_revision' },
        [`catEvidence.${cat}`]: evidence,
        [`visitRates.${cat}`]: rate,
        [`services.${cat}`]: services,
        updatedAt: FieldValue.serverTimestamp(),
      });
      try {
        const { from, notifyTo } = senders();
        const name = p.kind === 'empresa' ? p.businessName : `${p.firstName} ${p.lastName}`;
        await transport().sendMail({
          from, to: notifyTo, replyTo: p.email || undefined,
          subject: `Categoría por revisar: ${CATEGORIES[cat]} · ${name}`,
          html: layout('Un profesional suma una categoría', rows([
            ['Profesional', esc(name)], ['Categoría', esc(CATEGORIES[cat])], ['Tarifa', `${usd(rate)} por visita`],
            ['Trabajos', esc(services.join(', '))], ['Validación', evidenceText(evidence)],
          ]) + `<p style="font-size:13px;color:#6B6560;margin-top:12px">Para aprobar: en Firestore cambia <b>catStatus.${esc(cat)}</b> a <b>aprobado</b> (o <b>observado</b> / <b>rechazado</b>). Archivos en Storage, carpeta providers/${esc(uid)}.</p>` +
            button(`https://console.firebase.google.com/project/${PROJECT}/firestore/databases/-default-/data/~2Fproviders~2F${uid}`, 'Revisar en Firebase') +
            button(`https://console.firebase.google.com/project/${PROJECT}/storage/${BUCKET}/files/~2Fproviders~2F${uid}`, 'Ver archivos', '#9A5B34')),
        });
      } catch (e) {
        logger.warn('No se pudo avisar la categoría nueva', { uid, e: String(e) });
      }
      return { ok: true };
    }
    throw new HttpsError('invalid-argument', 'Acción no válida.');
  },
);

/* ------------------------------ Cambio de hora ------------------------------ */

/**
 * Cliente o profesional proponen otra fecha u hora (para adelantar o
 * atrasar); la otra parte acepta o rechaza. Hasta que se acepte, vale la hora
 * original.
 */
export const reprogramarReserva = onCall(
  { region: REGION, secrets: [MAIL_PASSWORD] },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión.');
    const id = String(req.data?.id ?? '');
    const action = String(req.data?.action ?? '');
    if (!/^[A-Za-z0-9]{10,40}$/.test(id) || !['proponer', 'aceptar', 'rechazar', 'retirar'].includes(action)) throw new HttpsError('invalid-argument', 'Acción no válida.');
    const ref = db().doc(`bookings/${id}`);

    const out = await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'No encontramos esa reserva.');
      const b = snap.data();
      const who = b.clientId === uid ? 'cliente' : b.professionalId === uid ? 'profesional' : null;
      if (!who) throw new HttpsError('permission-denied', 'Esta reserva no es tuya.');
      if (!['pendiente', 'confirmada'].includes(b.status)) throw new HttpsError('failed-precondition', 'Ya no se puede cambiar la hora de esta reserva.');
      const p = b.proposal;

      if (action === 'proponer') {
        const date = String(req.data?.date ?? '');
        const slot = String(req.data?.slot ?? '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01][0-9]|2[0-3]):(00|15|30|45)$/.test(slot)) throw new HttpsError('invalid-argument', 'Elige una fecha y una hora (cada 15 minutos).');
        const at = appointmentMs(date, slot);
        if (at < Date.now() + 15 * 60_000) throw new HttpsError('invalid-argument', 'La nueva hora debe ser al menos dentro de 15 minutos.');
        if (at > Date.now() + 31 * 86_400_000) throw new HttpsError('invalid-argument', 'La nueva fecha debe ser dentro de los próximos 30 días.');
        if (date === b.date && slot === b.slot) throw new HttpsError('invalid-argument', 'Es la misma hora de la reserva.');
        tx.update(ref, { proposal: { date, slot, by: who, at: FieldValue.serverTimestamp() } });
        return { b, who, date, slot };
      }
      if (!p) throw new HttpsError('failed-precondition', 'No hay un cambio de hora pendiente.');
      if (action === 'retirar') {
        if (p.by !== who) throw new HttpsError('permission-denied', 'Solo quien propuso el cambio puede retirarlo.');
        tx.update(ref, { proposal: FieldValue.delete() });
        return { b, who, date: p.date, slot: p.slot };
      }
      if (p.by === who) throw new HttpsError('failed-precondition', 'Espera la respuesta de la otra parte.');
      if (action === 'aceptar') {
        if (appointmentMs(p.date, p.slot) < Date.now() + 5 * 60_000) throw new HttpsError('failed-precondition', 'Esa hora ya pasó. Propón otra.');
        // Si el trabajo ya estaba aceptado, la nueva hora no puede chocar con otro trabajo del profesional.
        if (b.status === 'confirmada') {
          const o = await findClash(tx, b.professionalId, id, p.date, appointmentMs(p.date, p.slot), b.hours);
          if (o) throw new HttpsError('failed-precondition', `${who === 'profesional' ? 'Ese día ya tienes' : 'El profesional ya tiene'} ${CATEGORIES[o.category] ?? o.category} a las ${o.slot} (unas ${o.hours ?? 1} h). Propón otra hora.`);
        }
        tx.update(ref, { date: p.date, slot: p.slot, proposal: FieldValue.delete(), rescheduledAt: FieldValue.serverTimestamp(), previousDate: b.date, previousSlot: b.slot });
      } else {
        tx.update(ref, { proposal: FieldValue.delete(), lastRejectedProposal: { date: p.date, slot: p.slot, by: p.by } });
      }
      return { b, who, date: p.date, slot: p.slot };
    });

    // Aviso por correo a la otra parte.
    try {
      const { b, who, date, slot } = out;
      const { from, notifyTo } = senders();
      const cat = CATEGORIES[b.category] ?? b.category;
      const pro = (await db().doc(`providers/${b.professionalId}`).get()).data();
      const toClient = who === 'profesional';
      const to = toClient ? b.contactEmail : pro?.email;
      const otherName = toClient ? b.professionalName : String(b.contactName ?? '').split(' ')[0];
      const link = toClient ? 'https://hululec.com/cuenta' : 'https://hululec.com/profesionales/agenda';
      const texts = {
        proponer: [`${otherName} propone cambiar la hora`, `${esc(otherName)} propone cambiar tu servicio de ${esc(cat)} del ${esc(longDate(b.date))} a las ${esc(b.slot)} al <strong>${esc(longDate(date))} a las ${esc(slot)}</strong>. Acepta o rechaza el cambio.`],
        aceptar: ['Cambio de hora aceptado', `${esc(otherName)} aceptó: el servicio de ${esc(cat)} queda para el <strong>${esc(longDate(date))} a las ${esc(slot)}</strong>.`],
        rechazar: ['Cambio de hora rechazado', `${esc(otherName)} no aceptó el cambio. Se mantiene el ${esc(longDate(b.date))} a las ${esc(b.slot)}.`],
        retirar: ['Se retiró el cambio de hora', `Se mantiene el ${esc(longDate(b.date))} a las ${esc(b.slot)}.`],
      }[action];
      if (texts) {
        const plain = texts[1].replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ');
        await pushTo(toClient ? b.clientId : b.professionalId, texts[0], plain.slice(0, 180), toClient ? { bookingId: id, to: 'cliente' } : { url: AGENDA, bookingId: id, to: 'pro' });
      }
      if (to && texts) await transport().sendMail({ from, to, replyTo: notifyTo, subject: texts[0], html: layout(texts[0], `<p style="font-size:15px">${texts[1]}</p>` + button(link, 'Ver la reserva')) });
    } catch (e) {
      logger.warn('No se pudo avisar el cambio de hora', { id, e: String(e) });
    }
    return { ok: true };
  },
);

/* ---------------------------- Cierre del servicio ---------------------------- */

/** El cliente confirma que el servicio terminó: la reserva pasa a completada. */
export const confirmarServicio = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const id = String(req.data?.id ?? '');
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) throw new HttpsError('invalid-argument', 'Reserva no válida.');
  const ref = db().doc(`bookings/${id}`);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'No encontramos esa reserva.');
    const b = snap.data();
    if (b.clientId !== uid) throw new HttpsError('permission-denied', 'Esta reserva no es tuya.');
    if (b.status !== 'por_aprobar') throw new HttpsError('failed-precondition', 'Esta reserva ya está cerrada.');
    if (b.extra?.status === 'propuesto') throw new HttpsError('failed-precondition', 'Primero acepta o rechaza el cobro adicional.');
    tx.update(ref, { status: 'completada', completedAt: FieldValue.serverTimestamp(), completedBy: 'cliente', previousStatus: b.status });
  });
  return { ok: true };
});

/** Cada hora: las visitas terminadas hace más de 24 horas se cierran solas. */
export const cerrarTerminadas = onSchedule({ schedule: 'every 15 minutes', region: REGION, timeZone: 'America/Guayaquil' }, async () => {
  const limit = Date.now() - 24 * 3_600_000;
  const snap = await db().collection('bookings').where('status', '==', 'por_aprobar').get();
  const old = snap.docs.filter((d) => {
    const t = d.data().finishedAt;
    // Con un cobro adicional sin responder, se espera al cliente.
    return t && typeof t.toMillis === 'function' && t.toMillis() < limit && d.data().extra?.status !== 'propuesto';
  });
  await Promise.all(old.map((d) => d.ref.update({ status: 'completada', completedAt: FieldValue.serverTimestamp(), completedBy: 'automatico', previousStatus: 'por_aprobar' })));
  const n = await recordatorios();
  logger.info('Visitas cerradas automáticamente', { count: old.length, ...n });
});

/* ------------------------------ Cobro adicional ------------------------------ */


/**
 * Cobro adicional (repuestos, más trabajo u otra visita):
 * - proponer: el profesional, con la visita en curso o terminada.
 * - aceptar (tarjeta o efectivo) / rechazar: el cliente.
 * - recibi_efectivo: el profesional confirma que le pagaron en efectivo.
 * HULUL retiene su comisión: con tarjeta se descuenta del pago; en efectivo
 * queda como saldo a cargo del profesional.
 */
export const cobroAdicional = onCall({ region: REGION, secrets: [MAIL_PASSWORD] }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const id = String(req.data?.id ?? '');
  const action = String(req.data?.action ?? '');
  if (!/^[A-Za-z0-9]{10,40}$/.test(id) || !['proponer', 'aceptar', 'rechazar', 'recibi_efectivo'].includes(action)) throw new HttpsError('invalid-argument', 'Acción no válida.');
  const ref = db().doc(`bookings/${id}`);

  const out = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'No encontramos esa reserva.');
    const b = snap.data();
    const isPro = b.professionalId === uid;
    const isClient = b.clientId === uid;
    const ex = b.extra;

    if (action === 'proponer') {
      if (!isPro) throw new HttpsError('permission-denied', 'Solo el profesional de la reserva puede agregar un cobro.');
      if (!['en_curso', 'por_aprobar'].includes(b.status)) throw new HttpsError('failed-precondition', 'El cobro adicional se agrega durante o al terminar la visita.');
      if (ex && ex.status !== 'rechazado') throw new HttpsError('failed-precondition', 'Ya hay un cobro adicional en esta reserva.');
      const amount = r2(Number(req.data?.amount));
      const description = String(req.data?.description ?? '').trim().slice(0, 300);
      if (!Number.isFinite(amount) || amount < 1 || amount > 2000) throw new HttpsError('invalid-argument', 'El monto debe estar entre $1 y $2000.');
      if (description.length < 10) throw new HttpsError('invalid-argument', 'Explica qué incluye el cobro (al menos 10 caracteres).');
      if (hasProfanity(description)) throw new HttpsError('invalid-argument', PROFANITY_MESSAGE);
      const q = extraOf(amount, regimeOf(b.taxRegime));
      const extra = { amount: q.amount, description, iva: q.iva, total: q.total, commission: q.commission, commissionIva: q.commissionIva, status: 'propuesto', proposedAt: FieldValue.serverTimestamp() };
      tx.update(ref, { extra });
      return { b, extra, to: 'cliente' };
    }

    if (!ex) throw new HttpsError('failed-precondition', 'No hay un cobro adicional en esta reserva.');

    if (action === 'aceptar' || action === 'rechazar') {
      if (!isClient) throw new HttpsError('permission-denied', 'Solo el cliente de la reserva puede responder el cobro.');
      if (ex.status !== 'propuesto') throw new HttpsError('failed-precondition', 'Este cobro ya fue respondido.');
      if (action === 'rechazar') {
        tx.update(ref, { 'extra.status': 'rechazado', 'extra.respondedAt': FieldValue.serverTimestamp() });
        return { b, extra: { ...ex, status: 'rechazado' }, to: 'pro' };
      }
      const method = String(req.data?.method ?? '');
      if (!['tarjeta', 'efectivo'].includes(method)) throw new HttpsError('invalid-argument', 'Elige cómo pagas.');
      // Sin pasarela todavía: con tarjeta queda "por cobrar" hasta conectar los pagos.
      const status = method === 'tarjeta' ? 'por_cobrar' : 'efectivo_pendiente';
      tx.update(ref, { 'extra.status': status, 'extra.method': method, 'extra.respondedAt': FieldValue.serverTimestamp() });
      return { b, extra: { ...ex, status, method }, to: 'pro' };
    }

    // recibi_efectivo
    if (!isPro) throw new HttpsError('permission-denied', 'Solo el profesional confirma el pago en efectivo.');
    if (ex.status !== 'efectivo_pendiente') throw new HttpsError('failed-precondition', 'Este cobro no está pendiente de pago en efectivo.');
    tx.update(ref, { 'extra.status': 'pagado_efectivo', 'extra.paidAt': FieldValue.serverTimestamp() });
    // La comisión de HULUL queda como saldo a cargo del profesional: la registra
    // el libro de movimientos al cerrar la reserva (ledger.js).
    return { b, extra: { ...ex, status: 'pagado_efectivo' }, to: 'cliente' };
  });

  // Avisos (no hacen fallar la operación).
  try {
    const { b, extra, to } = out;
    const cat = CATEGORIES[b.category] ?? b.category;
    const first = String(b.contactName ?? '').split(' ')[0];
    const texts = {
      proponer: [`Cobro adicional de ${usd(extra.total)}`, `${b.professionalName} agregó un cobro adicional a tu servicio de ${cat}: ${extra.description}. Revísalo y acéptalo o recházalo en la app.`],
      aceptar: [`${first} aceptó el cobro adicional`, extra.method === 'tarjeta' ? `Aceptó ${usd(extra.total)} con tarjeta. Se cobra por la app.` : `Aceptó ${usd(extra.total)} en efectivo. Cuando te pague, marca "Recibí el efectivo" en tu agenda.`],
      rechazar: [`${first} no aceptó el cobro adicional`, `No aceptó el cobro de ${usd(extra.total)}. Coordina con el cliente si hace falta.`],
      recibi_efectivo: ['Pago en efectivo registrado', `${b.professionalName} confirmó que recibió ${usd(extra.total)} en efectivo por el cobro adicional.`],
    }[action];
    if (texts) {
      await pushTo(to === 'cliente' ? b.clientId : b.professionalId, texts[0], texts[1], to === 'cliente' ? { bookingId: id, to: 'cliente' } : { url: AGENDA, bookingId: id, to: 'pro' });
      const { from, notifyTo } = senders();
      let email = to === 'cliente' ? b.contactEmail : null;
      if (to === 'pro') email = (await db().doc(`providers/${b.professionalId}`).get()).data()?.email;
      if (email) {
        await transport().sendMail({ from, to: email, replyTo: notifyTo, subject: texts[0],
          html: layout(texts[0], `<p style="font-size:15px">${esc(texts[1])}</p>` + rows([['Código', code(id)], ['Detalle', esc(extra.description)], ['Monto', usd(extra.amount)], ['IVA', usd(extra.iva)], ['Total', `<strong>${usd(extra.total)}</strong>`]]) +
            button(to === 'cliente' ? `https://hululec.com/cuenta/reserva/${id}` : AGENDA, 'Ver la reserva')) });
      }
    }
  } catch (e) {
    logger.warn('No se pudo avisar el cobro adicional', { id, action, e: String(e) });
  }
  return { ok: true };
});

/* ------------------------------- Calificaciones ------------------------------- */

const stars = (n) => { const v = Math.round(Number(n)); return v >= 1 && v <= 5 ? v : null; };
const STARS = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

/**
 * El cliente califica al profesional (obligatorio) y a HULUL (opcional). La
 * reseña es pública en el perfil del profesional y actualiza su promedio. Si
 * la visita estaba "terminada", calificar también cierra el servicio.
 */
export const calificar = onCall({ region: REGION, secrets: [MAIL_PASSWORD] }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const id = String(req.data?.id ?? '');
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) throw new HttpsError('invalid-argument', 'Reserva no válida.');
  const proStars = stars(req.data?.proStars);
  if (!proStars) throw new HttpsError('invalid-argument', 'Elige de 1 a 5 estrellas para el profesional.');
  const appStars = req.data?.appStars == null ? null : stars(req.data.appStars);
  const proComment = String(req.data?.proComment ?? '').trim().slice(0, 600);
  const appComment = String(req.data?.appComment ?? '').trim().slice(0, 600);
  if (proStars <= 2 && proComment.length < 10) throw new HttpsError('invalid-argument', 'Cuéntanos qué no te gustó (al menos 10 caracteres): nos ayuda a mejorar.');
  if (hasProfanity(proComment) || hasProfanity(appComment)) throw new HttpsError('invalid-argument', PROFANITY_MESSAGE);
  const ref = db().doc(`bookings/${id}`);

  const b = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'No encontramos esa reserva.');
    const bk = snap.data();
    if (bk.clientId !== uid) throw new HttpsError('permission-denied', 'Esta reserva no es tuya.');
    const faultCancel = bk.status === 'cancelada' && !!bk.proFault;
    if (!['por_aprobar', 'completada', 'en_disputa'].includes(bk.status) && !faultCancel) throw new HttpsError('failed-precondition', 'Podrás calificar cuando el profesional termine la visita.');
    if (bk.rating) throw new HttpsError('already-exists', 'Ya calificaste este servicio. ¡Gracias!');
    if (bk.extra?.status === 'propuesto') throw new HttpsError('failed-precondition', 'Primero acepta o rechaza el cobro adicional.');
    const proRef = db().doc(`pros/${bk.professionalId}`);
    const pro = await tx.get(proRef);
    tx.set(db().doc(`reviews/${id}`), {
      bookingId: id, professionalId: bk.professionalId, category: bk.category,
      clientName: String(bk.contactName ?? 'Cliente').split(' ')[0], rating: proStars, text: proComment,
      createdAt: FieldValue.serverTimestamp(),
    });
    if (appStars) tx.set(db().doc(`appFeedback/${id}`), { bookingId: id, clientId: uid, rating: appStars, text: appComment, createdAt: FieldValue.serverTimestamp() });
    if (pro.exists) {
      const p = pro.data();
      const count = Number(p.reviewCount ?? 0);
      const avg = (Number(p.rating ?? 0) * count + proStars) / (count + 1);
      tx.update(proRef, { rating: Math.round(avg * 100) / 100, reviewCount: count + 1, ...(faultCancel ? {} : { jobsDone: FieldValue.increment(1) }) });
      bk._newRating = { avg, count: count + 1 };
    }
    tx.update(ref, {
      rating: proStars, ratedAt: FieldValue.serverTimestamp(),
      ...(bk.status === 'por_aprobar' ? { status: 'completada', completedAt: FieldValue.serverTimestamp(), completedBy: 'cliente', previousStatus: bk.status } : {}),
    });
    return bk;
  });

  // Calificación baja: se pausa 14 días. Se vuelve a revisar después de 5 reseñas nuevas.
  try {
    const nr = b._newRating;
    if (nr && nr.count >= RATING_MIN_REVIEWS && nr.avg < RATING_MIN && !b.demo) {
      const pref = db().doc(`providers/${b.professionalId}`);
      const p = (await pref.get()).data();
      if (p && (p.suspendedUntil ?? 0) < Date.now() && nr.count >= Number(p.ratingCheckAt ?? 0) + RATING_MIN_REVIEWS) {
        await pref.set({ suspendedUntil: Date.now() + RATING_SUSPEND_DAYS * DAY_MS, suspendedReason: 'calificacion', suspendedAt: Date.now(), ratingCheckAt: nr.count, suspensions: FieldValue.increment(1) }, { merge: true });
      }
    }
  } catch (e) {
    logger.warn('No se pudo revisar la calificación mínima', { id, e: String(e) });
  }

  // Avisos: al profesional siempre; a HULUL si algo salió mal.
  try {
    const { from, notifyTo } = senders();
    const first = String(b.contactName ?? '').split(' ')[0];
    await pushTo(b.professionalId, `${first} te calificó ${STARS(proStars)}`, proComment || 'Gracias por tu trabajo.', { url: AGENDA, bookingId: id, to: 'pro' });
    if (proStars <= 2 || (appStars && appStars <= 2)) {
      await transport().sendMail({ from, to: notifyTo, subject: `Calificación baja en ${code(id)} · profesional ${proStars}★${appStars ? ` · app ${appStars}★` : ''}`,
        html: layout('Revisar una calificación baja', rows([
          ['Código', code(id)], ['Profesional', esc(b.professionalName)], ['Cliente', esc(b.contactName)], ['Celular', esc(b.contactPhone)],
          ['Profesional', `${STARS(proStars)} ${esc(proComment)}`], ['App', appStars ? `${STARS(appStars)} ${esc(appComment)}` : '—'],
        ])) });
    }
  } catch (e) {
    logger.warn('No se pudo avisar la calificación', { id, e: String(e) });
  }
  return { ok: true };
});

/** El profesional califica al cliente (privado: solo lo ve HULUL). */
export const calificarCliente = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const id = String(req.data?.id ?? '');
  const n = stars(req.data?.stars);
  const comment = String(req.data?.comment ?? '').trim().slice(0, 600);
  if (!/^[A-Za-z0-9]{10,40}$/.test(id) || !n) throw new HttpsError('invalid-argument', 'Elige de 1 a 5 estrellas.');
  if (hasProfanity(comment)) throw new HttpsError('invalid-argument', PROFANITY_MESSAGE);
  const ref = db().doc(`bookings/${id}`);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'No encontramos esa reserva.');
    const b = snap.data();
    if (b.professionalId !== uid) throw new HttpsError('permission-denied', 'Esta reserva no es tuya.');
    if (!['por_aprobar', 'completada'].includes(b.status) && b.cancelledBy !== 'cliente_ausente') throw new HttpsError('failed-precondition', 'Califica al cliente cuando termines la visita.');
    if (b.clientRating) throw new HttpsError('already-exists', 'Ya calificaste a este cliente.');
    tx.update(ref, { clientRating: { stars: n, comment, at: FieldValue.serverTimestamp() } });
    tx.set(db().doc(`clientRatings/${b.clientId}`), { sum: FieldValue.increment(n), count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { ok: true };
});

/* ------------------------------------ Chat ------------------------------------ */

/** Mensaje nuevo en el chat de una reserva: notificación al otro. */
export const avisoChat = onDocumentCreated({ document: 'bookings/{id}/messages/{mid}', region: REGION }, async (event) => {
  const m = event.data?.data();
  if (!m) return;
  const id = event.params.id;
  // Malas palabras: se tapan en el chat (queda el original solo para HULUL).
  if (m.text && hasProfanity(m.text)) {
    m.text = maskProfanity(m.text);
    await event.data.ref.update({ text: m.text });
    await db().doc(`bookings/${id}/moderacion/${event.params.mid}`).set({ original: event.data.data().text, at: FieldValue.serverTimestamp(), from: m.from }).catch(() => {});
  }
  const b = (await db().doc(`bookings/${id}`).get()).data();
  if (!b) return;
  const toPro = m.from === 'cliente';
  const name = toPro ? String(b.contactName ?? 'El cliente').split(' ')[0] : String(b.professionalName ?? 'Tu profesional').split(' ')[0];
  const body = m.kind === 'foto' ? '📷 Te envió una foto' : m.kind === 'pedir_fotos' ? `📷 Te pide fotos: ${String(m.text ?? '').slice(0, 120)}` : String(m.text ?? '').slice(0, 160);
  await pushTo(toPro ? b.professionalId : b.clientId, `💬 ${name}`, body, toPro ? { url: AGENDA, bookingId: id, to: 'pro', chat: true, messageId: event.params.mid } : { bookingId: id, to: 'cliente', chat: true, messageId: event.params.mid });
});

/* ----------------------- Recordatorios y vencimientos ----------------------- */

/** Correo + notificación al cliente (no hace fallar el proceso). */
async function tellClient(b, id, title, text) {
  await pushTo(b.clientId, title, text, { bookingId: id, to: 'cliente' });
  if (!b.contactEmail) return;
  try {
    const { from, notifyTo } = senders();
    await transport().sendMail({ from, to: b.contactEmail, replyTo: notifyTo, subject: title,
      html: layout(title, `<p style="font-size:15px">${esc(text)}</p>` + button(`https://hululec.com/cuenta/reserva/${id}`, 'Ver mi reserva')) });
  } catch (e) {
    logger.warn('No se pudo enviar el recordatorio', { id, e: String(e) });
  }
}

/**
 * Cada 15 minutos:
 * - Pendiente sin aceptar: aviso al cliente 2 h y 1 h antes (y empujón al
 *   profesional); a la hora de la cita se cancela sola, sin costo.
 * - Confirmada: 1 h antes, si el profesional no ha salido, aviso a ambos;
 *   15 min después de la hora sin salir, aviso al cliente (puede cancelar
 *   gratis); 3 h después sin salir, se cancela sola como falta del profesional.
 * - En camino con 30 min de retraso: aviso al cliente (puede cancelar gratis).
 */
async function recordatorios() {
  const now = Date.now();
  const snap = await db().collection('bookings').where('status', 'in', ['pendiente', 'confirmada', 'en_camino']).get();
  let avisos = 0, vencidas = 0;
  for (const d of snap.docs) {
    const b = d.data();
    const id = d.id;
    const at = b.status === 'pendiente' ? appointmentMs(b.date, b.slot) : effectiveMs(b);
    const mins = (at - now) / 60_000;
    const r = b.reminders ?? {};
    const pro = String(b.professionalName ?? 'tu profesional').split(' ')[0];
    const when = `${longDate(b.date)} a las ${b.slot}`;
    const mark = (k) => d.ref.update({ [`reminders.${k}`]: FieldValue.serverTimestamp() });
    try {
      if (b.status === 'pendiente') {
        if (mins <= 0) {
          await d.ref.update({ status: 'cancelada', cancelledBy: 'sistema', cancelReason: 'El profesional no aceptó antes de la hora.', cancelFee: 0, cancelledAt: FieldValue.serverTimestamp(), previousStatus: 'pendiente' });
          await tellClient(b, id, 'Tu reserva se canceló sin costo', `${pro} no aceptó tu reserva del ${when} a tiempo. No se te cobra nada. Reserva con otro profesional en HULUL.`);
          vencidas++;
        } else if (mins <= 60 && !r.pend1h) {
          await mark('pend1h');
          await tellClient(b, id, `${pro} aún no confirma tu reserva`, `Tu cita es en menos de 1 hora (${b.slot}) y ${pro} todavía no la acepta. Escríbele por el chat o cancela gratis y elige otro profesional.`);
          await pushTo(b.professionalId, 'Solicitud sin responder', `Tienes una reserva a las ${b.slot} sin aceptar. Acéptala o recházala ahora.`, { url: AGENDA, bookingId: id, to: 'pro' });
          avisos++;
        } else if (mins <= 120 && !r.pend2h && !r.pend1h) {
          await mark('pend2h');
          await tellClient(b, id, `${pro} aún no confirma tu reserva`, `Tu cita es a las ${b.slot} y ${pro} todavía no la acepta. Puedes esperar, escribirle por el chat o cancelar gratis y elegir otro profesional.`);
          await pushTo(b.professionalId, 'Tienes una solicitud sin responder', `Reserva para el ${when}. Acéptala o recházala en tu agenda.`, { url: AGENDA, bookingId: id, to: 'pro' });
          avisos++;
        }
      } else if (b.status === 'confirmada') {
        if (mins <= -180) {
          await d.ref.update({ status: 'cancelada', cancelledBy: 'sistema', cancelReason: 'El profesional no se presentó.', cancelFee: 0, proFault: 'no_se_presento', proFine: PRO_NOSHOW_FINE, cancelledAt: FieldValue.serverTimestamp(), previousStatus: 'confirmada' });
          if (!b.demo) await db().doc(`providers/${b.professionalId}`).set(strikeData({ fines: FieldValue.increment(PRO_NOSHOW_FINE) }), { merge: true });
          await tellClient(b, id, 'Tu reserva se canceló', `${pro} no se presentó a tu cita del ${when}. No se te cobra nada y le aplicamos una falta. Puedes calificarlo en la reserva.`);
          vencidas++;
        } else if (mins <= -LATE_TOLERANCE_MIN && !r.late15) {
          await mark('late15');
          await tellClient(b, id, `${pro} todavía no sale`, `Tu cita era a las ${b.slot} y ${pro} aún no marca que va en camino. Escríbele por el chat, propón otra hora o cancela sin costo desde tu reserva.`);
          await pushTo(b.professionalId, 'Vas tarde', `Tu cita era a las ${b.slot}. Toca "Voy en camino" o avisa al cliente por el chat. Si no llegas, es una falta.`, { url: AGENDA, bookingId: id, to: 'pro' });
          avisos++;
        } else if (mins <= 60 && mins > 0 && !r.conf1h) {
          await mark('conf1h');
          await tellClient(b, id, `Tu cita con ${pro} es a las ${b.slot}`, `${pro} confirmó, pero aún no sale hacia tu dirección. Si necesitas algo, escríbele por el chat. Que haya alguien en casa para recibirlo.`);
          await pushTo(b.professionalId, `Tu cita es a las ${b.slot}`, 'Sal con tiempo y toca "Voy en camino" para que el cliente te vea en el mapa.', { url: AGENDA, bookingId: id, to: 'pro' });
          avisos++;
        }
      } else if (b.status === 'en_camino' && mins <= -VERY_LATE_MIN && !r.late30) {
        await mark('late30');
        await tellClient(b, id, `${pro} viene con retraso`, `${pro} lleva más de ${VERY_LATE_MIN} minutos de retraso. Míralo en el mapa, escríbele por el chat o cancela sin costo desde tu reserva.`);
        avisos++;
      }
    } catch (e) {
      logger.warn('Recordatorio fallido', { id, e: String(e) });
    }
  }
  return { avisos, vencidas };
}

/* ------------------------------ Aviso de retraso ------------------------------ */

const DELAYS = [10, 15, 20, 30, 45, 60, 90];

/**
 * El profesional avisa que llegará tarde (con su reserva confirmada o en
 * camino) y el cliente decide:
 * - aceptar: la cita se corre esos minutos; si después el cliente cancela,
 *   paga el cargo normal (ya no hay culpa del profesional).
 * - rechazar: la reserva se cancela sin costo para el cliente y es falta del
 *   profesional (multa por retraso).
 * Así un cliente no puede aceptar el retraso y luego cancelar gratis, y el
 * profesional no puede cobrar "cliente ausente" si llegó más tarde de lo acordado.
 */
export const avisarRetraso = onCall({ region: REGION, secrets: [MAIL_PASSWORD] }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const id = String(req.data?.id ?? '');
  const action = String(req.data?.action ?? '');
  if (!/^[A-Za-z0-9]{10,40}$/.test(id) || !['proponer', 'aceptar', 'rechazar'].includes(action)) throw new HttpsError('invalid-argument', 'Acción no válida.');
  const ref = db().doc(`bookings/${id}`);
  const out = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'No encontramos esa reserva.');
    const b = snap.data();
    if (!['confirmada', 'en_camino'].includes(b.status)) throw new HttpsError('failed-precondition', 'Solo se avisa un retraso antes de llegar.');
    if (action === 'proponer') {
      if (b.professionalId !== uid) throw new HttpsError('permission-denied', 'Esta reserva no es tuya.');
      if (b.delay?.status === 'propuesto') throw new HttpsError('failed-precondition', 'Ya avisaste un retraso; espera la respuesta del cliente.');
      const minutes = Number(req.data?.minutes);
      if (!DELAYS.includes(minutes)) throw new HttpsError('invalid-argument', 'Elige cuántos minutos llegarás tarde.');
      const total = (b.delay?.status === 'aceptado' ? Number(b.delay.minutes) : 0) + minutes;
      if (total > 120) throw new HttpsError('failed-precondition', 'Un retraso de más de 2 horas no se puede avisar: propón otra hora o cancela.');
      const reason = String(req.data?.reason ?? '').trim().slice(0, 200);
      if (hasProfanity(reason)) throw new HttpsError('invalid-argument', PROFANITY_MESSAGE);
      tx.update(ref, { delay: { minutes: total, added: minutes, reason, status: 'propuesto', previous: b.delay?.status === 'aceptado' ? Number(b.delay.minutes) : 0, at: FieldValue.serverTimestamp() } });
      return { b, minutes, total, to: 'cliente' };
    }
    if (b.clientId !== uid) throw new HttpsError('permission-denied', 'Esta reserva no es tuya.');
    if (b.delay?.status !== 'propuesto') throw new HttpsError('failed-precondition', 'No hay un aviso de retraso pendiente.');
    if (action === 'aceptar') {
      tx.update(ref, { 'delay.status': 'aceptado', 'delay.respondedAt': FieldValue.serverTimestamp(), reminders: {} });
      return { b, minutes: b.delay.minutes, to: 'pro' };
    }
    // Rechazar: se cancela sin costo para el cliente; falta del profesional.
    tx.update(ref, {
      status: 'cancelada', cancelledBy: 'cliente', cancelledAt: FieldValue.serverTimestamp(), cancelFee: 0,
      cancelReason: 'No aceptó el retraso del profesional.', previousStatus: b.status,
      proFault: 'retraso_rechazado', proFine: PRO_LATE_FINE, 'delay.status': 'rechazado',
    });
    if (!b.demo) tx.set(db().doc(`providers/${b.professionalId}`), strikeData({ fines: FieldValue.increment(PRO_LATE_FINE) }), { merge: true });
    return { b, minutes: b.delay.minutes, to: 'pro' };
  });
  try {
    const { b, minutes, total } = out;
    const pro = String(b.professionalName ?? 'Tu profesional').split(' ')[0];
    const client = String(b.contactName ?? 'El cliente').split(' ')[0];
    const newTime = hhmm(appointmentMs(b.date, b.slot) + (total ?? minutes) * 60_000);
    if (action === 'proponer') await tellClient(b, id, `${pro} llegará ${out.minutes} min tarde`, `${pro} avisa que llegará unos ${out.minutes} minutos tarde (aprox. ${newTime}). Acepta el nuevo horario o, si no puedes esperar, cancela sin costo desde tu reserva.`);
    else if (action === 'aceptar') await pushTo(b.professionalId, `${client} aceptó tu retraso`, `Te espera a las ${hhmm(appointmentMs(b.date, b.slot) + minutes * 60_000)}. Si llegas más tarde, es falta.`, { url: AGENDA, bookingId: id, to: 'pro' });
    else await pushTo(b.professionalId, `${client} no aceptó tu retraso`, 'La reserva se canceló sin costo para el cliente y se te aplicó una falta.', { url: AGENDA, bookingId: id, to: 'pro' });
  } catch (e) {
    logger.warn('No se pudo avisar el retraso', { id, e: String(e) });
  }
  return { ok: true };
});

/* --------------------------------- Reclamos --------------------------------- */
// Protocolo completo en reclamos-core.js. Los expedientes (reclamos/{reserva})
// los escribe solo el servidor; cada parte ve el suyo. El panel de HULUL los lee
// por estas funciones, que dejan registrado cada acceso (reclamos/{id}/accesos).

const ADMIN_EMAILS = defineString('ADMIN_EMAILS', { default: '', description: 'Correos (separados por coma) que pueden ver y resolver reclamos' });
const ADMIN_URL = 'https://hululec.com/admin/reclamos';
const BOOKING_ID = /^[A-Za-z0-9]{10,40}$/;

function requireAdmin(req) {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  if (!isAdminToken(req.auth.token, ADMIN_EMAILS.value())) throw new HttpsError('permission-denied', 'No tienes acceso al panel de reclamos.');
  return { uid: req.auth.uid, email: String(req.auth.token.email).toLowerCase() };
}

const logAccess = (id, admin, action) => db().collection(`reclamos/${id}/accesos`).add({ uid: admin.uid, email: admin.email, action, at: FieldValue.serverTimestamp() });

/** Texto que verá la otra parte: sin groserías. El original queda solo para HULUL. */
function claimText(raw) {
  const text = String(raw ?? '').trim().slice(0, 1500);
  if (text.length < 15) throw new HttpsError('invalid-argument', 'Cuéntanos qué pasó (al menos 15 caracteres).');
  return { text: hasProfanity(text) ? maskProfanity(text) : text, original: text };
}

async function notifyAdmin(subject, title, pairs, id) {
  try {
    const { from, notifyTo } = senders();
    await transport().sendMail({ from, to: notifyTo, subject, html: layout(title, rows(pairs) + button(`${ADMIN_URL}?caso=${encodeURIComponent(id)}`, 'Abrir el expediente')) });
  } catch (e) {
    logger.warn('No se pudo avisar a HULUL del reclamo', { id, e: String(e) });
  }
}

/** Abre un reclamo (cliente o profesional). */
async function openClaim(req, side) {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const id = String(req.data?.id ?? '');
  const kind = String(req.data?.kind ?? '');
  if (!BOOKING_ID.test(id)) throw new HttpsError('invalid-argument', 'Reserva no válida.');
  const { text, original } = claimText(req.data?.text);
  const photos = cleanClaimPhotos(req.data?.photos, uid, id);
  const ref = db().doc(`bookings/${id}`);
  const cref = db().doc(`reclamos/${id}`);
  const kinds = side === 'cliente' ? CLIENT_KINDS : PRO_KINDS;
  const openedAt = Date.now();
  const due = deadlines(openedAt);
  const b = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'No encontramos esa reserva.');
    const bk = snap.data();
    if ((side === 'cliente' ? bk.clientId : bk.professionalId) !== uid) throw new HttpsError('permission-denied', 'Esta reserva no es tuya.');
    if ((await tx.get(cref)).exists) throw new HttpsError('already-exists', 'Ya hay un reclamo en esta reserva. Lo estamos revisando.');
    const blocked = claimBlocked(bk, side, kind, openedAt);
    if (blocked) throw new HttpsError('failed-precondition', blocked);
    tx.set(cref, {
      code: code(id), bookingId: id, openedBy: side, openerId: uid,
      clientId: bk.clientId, proId: bk.professionalId,
      clientName: String(bk.contactName ?? ''), proName: String(bk.professionalName ?? ''),
      category: bk.category ?? '', date: bk.date ?? '', slot: bk.slot ?? '',
      kind, kindLabel: kinds[kind], text, photos,
      status: 'esperando_respuesta', openedAt, ...due,
      response: null, decision: null, alerts: {},
      moneyHeld: side === 'cliente',
    });
    tx.set(db().doc(`reclamos/${id}/privado/textos`), { apertura: original }, { merge: true });
    const dispute = { kind, text, by: side, at: FieldValue.serverTimestamp(), status: 'abierta' };
    // Si reclama el cliente, el pago queda retenido hasta la decisión.
    tx.update(ref, side === 'cliente' ? { status: 'en_disputa', previousStatus: bk.status, dispute, claimId: id } : { dispute, claimId: id });
    return bk;
  });
  const other = side === 'cliente' ? b.professionalId : b.clientId;
  const who = side === 'cliente' ? String(b.contactName ?? 'El cliente').split(' ')[0] : String(b.professionalName ?? 'El profesional').split(' ')[0];
  await pushTo(other, `${who} abrió un reclamo`, `${kinds[kind]}. Tienes ${RESPONSE_HOURS} horas para dar tu versión (con fotos si las tienes). HULUL decide en máximo ${RESOLVE_HOURS} horas.`,
    side === 'cliente' ? { url: AGENDA, bookingId: id, to: 'pro', claim: true } : { bookingId: id, to: 'cliente', claim: true });
  await notifyAdmin(`RECLAMO ${code(id)} · ${kinds[kind]}`, 'Nuevo reclamo', [
    ['Código', code(id)], ['Abrió', side === 'cliente' ? 'Cliente' : 'Profesional'], ['Motivo', esc(kinds[kind])], ['Detalle', esc(text)],
    ['Cliente', esc(b.contactName)], ['Profesional', esc(b.professionalName)], ['Servicio', `${esc(CATEGORIES[b.category] ?? b.category)} · ${esc(longDate(b.date))} ${esc(b.slot)}`],
    ['Plazos', `Respuesta de la otra parte: ${RESPONSE_HOURS} h · Decisión: ${RESOLVE_HOURS} h`],
  ], id);
  logger.info('Reclamo abierto', { id, side, kind });
  return { ok: true };
}

/** El cliente reporta un problema (antes "reportarProblema"; mismo nombre para las apps ya instaladas). */
export const reportarProblema = onCall({ region: REGION, secrets: [MAIL_PASSWORD] }, (req) => openClaim(req, 'cliente'));

/** El profesional reporta un problema con el cliente. */
export const reportarProblemaPro = onCall({ region: REGION, secrets: [MAIL_PASSWORD] }, async (req) => {
  const pro = (await db().doc(`providers/${req.auth?.uid ?? '_'}`).get()).data();
  if (!pro) throw new HttpsError('permission-denied', 'Solo para profesionales.');
  return openClaim(req, 'profesional');
});

/** La otra parte da su versión (una vez, dentro de 24 h; después, hasta que HULUL decida). */
export const responderReclamo = onCall({ region: REGION, secrets: [MAIL_PASSWORD] }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const id = String(req.data?.id ?? '');
  if (!BOOKING_ID.test(id)) throw new HttpsError('invalid-argument', 'Reserva no válida.');
  const { text, original } = claimText(req.data?.text);
  const photos = cleanClaimPhotos(req.data?.photos, uid, id);
  const cref = db().doc(`reclamos/${id}`);
  const c = await db().runTransaction(async (tx) => {
    const snap = await tx.get(cref);
    if (!snap.exists) throw new HttpsError('not-found', 'No encontramos ese reclamo.');
    const cur = snap.data();
    const responder = cur.openedBy === 'cliente' ? cur.proId : cur.clientId;
    if (responder !== uid) throw new HttpsError('permission-denied', 'Solo la otra parte puede responder este reclamo.');
    if (cur.response) throw new HttpsError('already-exists', 'Ya diste tu versión.');
    if (cur.status === 'resuelto') throw new HttpsError('failed-precondition', 'Este reclamo ya fue resuelto.');
    const late = Date.now() > Number(cur.responseDueAt);
    tx.update(cref, { response: { text, photos, at: Date.now(), late }, status: 'en_revision' });
    tx.set(db().doc(`reclamos/${id}/privado/textos`), { respuesta: original }, { merge: true });
    return cur;
  });
  await pushTo(c.openerId, 'Hay una respuesta a tu reclamo', 'La otra parte dio su versión. HULUL revisa todo y te avisa la decisión.', c.openedBy === 'cliente' ? { bookingId: id, to: 'cliente', claim: true } : { url: AGENDA, bookingId: id, to: 'pro', claim: true });
  await notifyAdmin(`Respuesta en reclamo ${c.code}`, 'La otra parte respondió', [['Código', c.code], ['Respondió', c.openedBy === 'cliente' ? 'Profesional' : 'Cliente'], ['Versión', esc(text)]], id);
  return { ok: true };
});

/** Panel: lista de reclamos (sin datos de contacto). */
export const adminReclamos = onCall({ region: REGION }, async (req) => {
  requireAdmin(req);
  const snap = await db().collection('reclamos').orderBy('openedAt', 'desc').limit(200).get();
  return {
    items: snap.docs.map((d) => {
      const c = d.data();
      return {
        id: d.id, code: c.code, openedBy: c.openedBy, kindLabel: c.kindLabel, status: c.status, openedAt: c.openedAt,
        responseDueAt: c.responseDueAt, resolveDueAt: c.resolveDueAt, hasResponse: !!c.response, decision: c.decision?.outcome ?? null,
        clientName: c.clientName, proName: c.proName, category: c.category, date: c.date, slot: c.slot, moneyHeld: !!c.moneyHeld,
      };
    }),
  };
});

/** Panel: expediente completo. Cada apertura (y cada vez que se muestra el contacto) queda registrada. */
export const adminReclamo = onCall({ region: REGION }, async (req) => {
  const admin = requireAdmin(req);
  const id = String(req.data?.id ?? '');
  const reveal = req.data?.reveal === true;
  if (!BOOKING_ID.test(id)) throw new HttpsError('invalid-argument', 'Reclamo no válido.');
  const [cs, bs, ms_, mod, priv, acc] = await Promise.all([
    db().doc(`reclamos/${id}`).get(), db().doc(`bookings/${id}`).get(),
    db().collection(`bookings/${id}/messages`).orderBy('at').limit(500).get(),
    db().collection(`bookings/${id}/moderacion`).get(),
    db().doc(`reclamos/${id}/privado/textos`).get(),
    db().collection(`reclamos/${id}/accesos`).orderBy('at', 'desc').limit(50).get(),
  ]);
  if (!cs.exists || !bs.exists) throw new HttpsError('not-found', 'No encontramos ese reclamo.');
  await logAccess(id, admin, reveal ? 'ver_contacto' : 'abrir');
  const c = cs.data(); const b = bs.data();
  const originals = Object.fromEntries(mod.docs.map((d) => [d.id, d.data().original]));
  const messages = ms_.docs.map((d) => {
    const m = d.data();
    return { id: d.id, from: m.from, kind: m.kind, text: m.text ?? '', photo: m.photo ?? '', at: m.at?.toMillis?.() ?? 0, original: originals[d.id] ?? null };
  });
  const tsKeys = ['createdAt', 'acceptedAt', 'enRouteAt', 'arrivedAt', 'startedAt', 'finishedAt', 'cancelledAt', 'completedAt'];
  const times = Object.fromEntries(tsKeys.map((k) => [k, b[k]?.toMillis?.() ?? null]));
  const contact = (v) => (reveal ? String(v ?? '') : maskContact(v));
  const [cl, pr] = await Promise.all([db().doc(`clients/${c.clientId}`).get(), db().doc(`providers/${c.proId}`).get()]);
  const others = await db().collection('reclamos').where('clientId', '==', c.clientId).get();
  const proOthers = await db().collection('reclamos').where('proId', '==', c.proId).get();
  return {
    claim: { id, ...c, privado: priv.exists ? priv.data() : {} },
    booking: {
      status: b.status, previousStatus: b.previousStatus ?? null, category: b.category, date: b.date, slot: b.slot, hours: b.hours ?? null,
      address: b.address ?? '', notes: b.notes ?? '', paymentMethod: b.paymentMethod ?? '', subtotal: b.subtotal ?? null, visit: b.visit ?? null,
      cancelFee: b.cancelFee ?? null, cancelledBy: b.cancelledBy ?? null, cancelReason: b.cancelReason ?? '', outcome: b.outcome ?? null,
      diagnosis: b.diagnosis ?? '', diagnosisPhotos: b.diagnosisPhotos ?? [], photos: b.photos ?? [], extra: b.extra ?? null, delay: b.delay ?? null,
      arrivedPos: b.arrivedPos ?? null, rings: b.rings ?? [], startedWithCode: !!b.startedAt, clientRating: b.clientRating ?? null, rating: b.rating ?? null, ...times,
      contactName: b.contactName ?? '', contactPhone: contact(b.contactPhone), contactEmail: contact(b.contactEmail), professionalName: b.professionalName ?? '',
    },
    parties: {
      client: { reclamos: others.size, strikes: Number(cl.data()?.strikes ?? 0) },
      pro: { reclamos: proOthers.size, strikes: Number(pr.data()?.strikes ?? 0), rating: pr.data()?.rating ?? null, phone: contact(pr.data()?.phone) },
    },
    messages,
    stats: responseStats(messages),
    timeline: timeline({ ...b, ...Object.fromEntries(tsKeys.map((k) => [k, times[k]])) }, c, messages),
    accesses: acc.docs.map((d) => ({ email: d.data().email, action: d.data().action, at: d.data().at?.toMillis?.() ?? 0 })),
    revealed: reveal,
  };
});

/**
 * Panel: decisión. outcome 'cliente' | 'profesional', motivo (lo ven las dos
 * partes), y opcionalmente multa y falta al profesional, crédito y falta al cliente.
 */
export const resolverReclamo = onCall({ region: REGION, secrets: [MAIL_PASSWORD] }, async (req) => {
  const admin = requireAdmin(req);
  const id = String(req.data?.id ?? '');
  const outcome = String(req.data?.outcome ?? '');
  const note = String(req.data?.note ?? '').trim().slice(0, 1500);
  if (!BOOKING_ID.test(id) || !['cliente', 'profesional'].includes(outcome)) throw new HttpsError('invalid-argument', 'Elige a favor de quién se resuelve.');
  if (note.length < 20) throw new HttpsError('invalid-argument', 'Escribe el motivo de la decisión (al menos 20 caracteres). Lo verán las dos partes.');
  const d = {
    outcome, note,
    multaPro: Math.max(0, Math.min(200, Number(req.data?.multaPro || 0))),
    creditoCliente: Math.max(0, Math.min(500, Number(req.data?.creditoCliente || 0))),
    faltaPro: req.data?.faltaPro === true, faltaCliente: req.data?.faltaCliente === true,
  };
  const cref = db().doc(`reclamos/${id}`);
  const bref = db().doc(`bookings/${id}`);
  const { c, b } = await db().runTransaction(async (tx) => {
    const [cs, bs] = await Promise.all([tx.get(cref), tx.get(bref)]);
    if (!cs.exists || !bs.exists) throw new HttpsError('not-found', 'No encontramos ese reclamo.');
    const cur = cs.data(); const bk = bs.data();
    if (cur.status === 'resuelto') throw new HttpsError('failed-precondition', 'Este reclamo ya fue resuelto.');
    const pref = db().doc(`providers/${cur.proId}`);
    const ps = d.faltaPro ? await tx.get(pref) : null;
    const patch = decisionPatch(bk, cur, d);
    if (patch.status === 'completada') patch.completedAt = FieldValue.serverTimestamp();
    if (patch.cancelledBy === 'reclamo') patch.cancelledAt = FieldValue.serverTimestamp();
    tx.update(bref, patch);
    tx.update(cref, { status: 'resuelto', decision: { ...d, by: admin.email, at: Date.now() } });
    if (d.faltaPro && ps) {
      const p = ps.data() ?? {};
      const log = [...(p.strikeLog ?? []), Date.now()];
      tx.set(pref, { ...strikeData({ lastStrikeReason: 'reclamo' }), ...(strikeSuspension({ ...p, strikeLog: log }) ?? {}) }, { merge: true });
    }
    if (d.faltaCliente) tx.set(db().doc(`clients/${cur.clientId}`), { strikes: FieldValue.increment(1), strikeLog: FieldValue.arrayUnion(Date.now()) }, { merge: true });
    return { c: cur, b: bk };
  });
  await logAccess(id, admin, `resolver_${outcome}`);
  const favor = outcome === 'cliente' ? 'a favor del cliente' : 'a favor del profesional';
  const money = c.openedBy === 'cliente'
    ? (outcome === 'cliente' ? 'No se cobra la visita.' : 'Se mantiene el cobro y se libera el pago al profesional.')
    : '';
  const extraPro = [d.multaPro ? `Multa de ${usd(d.multaPro)}.` : '', d.faltaPro ? 'Se registra una falta.' : ''].filter(Boolean).join(' ');
  const extraCli = [d.creditoCliente ? `Crédito de ${usd(d.creditoCliente)} para tu próximo servicio.` : '', d.faltaCliente ? 'Se registra una falta en tu cuenta.' : ''].filter(Boolean).join(' ');
  const bodyFor = (extra) => `Reclamo ${c.code} resuelto ${favor}. ${money} ${extra} Motivo: ${note}`.replace(/\s+/g, ' ').trim();
  await pushTo(c.clientId, 'Decisión sobre el reclamo', bodyFor(extraCli).slice(0, 220), { bookingId: id, to: 'cliente', claim: true });
  await pushTo(c.proId, 'Decisión sobre el reclamo', bodyFor(extraPro).slice(0, 220), { url: AGENDA, bookingId: id, to: 'pro', claim: true });
  try {
    if (b.contactEmail) {
      const { from, notifyTo } = senders();
      await transport().sendMail({ from, to: b.contactEmail, replyTo: notifyTo, subject: `Decisión sobre tu reclamo ${c.code}`,
        html: layout('Decisión sobre el reclamo', `<p style="font-size:15px">${esc(bodyFor(extraCli))}</p>`) });
    }
  } catch (e) {
    logger.warn('No se pudo enviar la decisión por correo', { id, e: String(e) });
  }
  logger.info('Reclamo resuelto', { id, outcome, by: admin.email });
  return { ok: true };
});

/** Plazos: sin respuesta en 24 h pasa a revisión; aviso a HULUL 12 h antes de vencer y al vencer. */
export const plazosReclamos = onSchedule({ schedule: 'every 30 minutes', region: REGION, timeZone: 'America/Guayaquil', secrets: [MAIL_PASSWORD] }, async () => {
  const snap = await db().collection('reclamos').where('status', 'in', ['esperando_respuesta', 'en_revision']).get();
  for (const d of snap.docs) {
    const c = d.data();
    for (const a of dueActions(c)) {
      if (a === 'sin_respuesta') {
        await d.ref.update({ status: 'en_revision', responseMissed: true });
        await pushTo(c.openerId, 'Tu reclamo pasó a revisión', `La otra parte no respondió en ${RESPONSE_HOURS} horas. HULUL decide con la información que hay.`, c.openedBy === 'cliente' ? { bookingId: d.id, to: 'cliente', claim: true } : { url: AGENDA, bookingId: d.id, to: 'pro', claim: true });
        await notifyAdmin(`Reclamo ${c.code}: sin respuesta en ${RESPONSE_HOURS} h`, 'Sin respuesta de la otra parte', [['Código', c.code], ['Motivo', esc(c.kindLabel)]], d.id);
      } else if (a === 'por_vencer') {
        await d.ref.update({ 'alerts.porVencer': true });
        await notifyAdmin(`⏰ Reclamo ${c.code} vence en ${REMIND_BEFORE_HOURS} h`, 'Reclamo por vencer', [['Código', c.code], ['Motivo', esc(c.kindLabel)], ['Estado', esc(CLAIM_STATUS[c.status])]], d.id);
      } else if (a === 'vencido') {
        await d.ref.update({ 'alerts.vencido': true });
        await notifyAdmin(`⚠️ Reclamo ${c.code} VENCIDO`, 'Reclamo vencido sin decisión', [['Código', c.code], ['Motivo', esc(c.kindLabel)], ['Plazo', `${RESOLVE_HOURS} h desde la apertura`]], d.id);
      }
    }
  }
});

/* ------------------------ Libro de movimientos ------------------------ */

/**
 * Cada vez que una reserva cambia, el servidor deja en `ledger` los
 * movimientos de dinero que le corresponden (money.js → ledgerEntriesFor) y
 * revierte los que ya no corresponden (por ejemplo, una disputa que termina en
 * devolución). Los movimientos no se editan ni se borran: se revierten.
 * Solo el servidor escribe aquí; cada profesional ve los suyos.
 */
export const libroMovimientos = onDocumentWritten(
  { document: 'bookings/{id}', region: REGION },
  async (event) => {
    const id = event.params.id;
    const after = event.data?.after?.data();
    if (!after || after.demo) return;
    const before = event.data?.before?.data();
    // Solo interesa cuando cambia algo que mueve dinero.
    const sig = (b) => (b ? JSON.stringify([b.status, b.cancelFee ?? 0, b.proFine ?? 0, b.clientCredit ?? 0, b.extra?.status ?? '', b.extra?.amount ?? 0, b.paymentMethod, b.taxRegime ?? '']) : '');
    if (sig(before) === sig(after)) return;
    const desired = ledgerEntriesFor(after);
    if (desired === null) return;
    const proId = String(after.professionalId ?? '');
    if (!proId) return;
    const eventMs = (after.finishedAt ?? after.completedAt ?? after.cancelledAt)?.toMillis?.() ?? Date.now();
    const holdUntil = Math.max(Date.now(), eventMs + PAYOUT_HOLD_HOURS * 3_600_000);
    const col = db().collection('ledger');
    const changed = await db().runTransaction(async (tx) => {
      const existing = (await tx.get(col.where('bookingId', '==', id))).docs.map((d) => ({ id: d.id, ...d.data() }));
      const { create, reverse } = ledgerDiff(desired, existing);
      if (!create.length && !reverse.length) return false;
      const base = { bookingId: id, proId, clientId: after.clientId ?? null, paymentMethod: after.paymentMethod ?? null, payoutId: null, createdAt: FieldValue.serverTimestamp() };
      let n = existing.length;
      for (const e of reverse) {
        const rid = `${id}_${String(++n).padStart(3, '0')}`;
        tx.set(col.doc(rid), { ...base, ...reversalOf(e, e.id), availableAt: Date.now() });
        tx.update(col.doc(e.id), { reversedBy: rid });
      }
      for (const e of create) {
        const { hold, ...rest } = e;
        tx.set(col.doc(`${id}_${String(++n).padStart(3, '0')}`), { ...base, ...rest, availableAt: hold ? holdUntil : Date.now() });
      }
      return true;
    });
    if (changed) await refreshProBalance(proId);
  },
);

/**
 * Saldo del profesional con HULUL (lo pendiente de liquidar). Si es negativo,
 * es deuda (cobros en efectivo, multas): con más de $30 se le desactiva el efectivo.
 */
async function refreshProBalance(proId) {
  const snap = await db().collection('ledger').where('proId', '==', proId).where('payoutId', '==', null).get();
  const balance = r2(snap.docs.reduce((s, d) => s + Number(d.data().proDelta ?? 0), 0));
  await db().doc(`providers/${proId}`).set({ payoutBalance: balance, cashDebt: r2(Math.max(0, -balance)) }, { merge: true });
}

/**
 * Liquidación semanal (lunes 06:00): por cada profesional suma lo pendiente que
 * ya pasó la ventana de reclamos y no está en disputa, descuenta comisión,
 * multas, deuda de efectivo y retenciones, y deja la orden de pago en
 * `payouts` (status "por_pagar"). Si el neto no es positivo, el saldo pasa a la
 * semana siguiente. La transferencia la hará la dispersión de la pasarela;
 * mientras tanto HULUL la hace y cambia status a "pagado".
 */
export const liquidacionSemanal = onSchedule({ schedule: 'every monday 06:00', region: REGION, timeZone: 'America/Guayaquil', secrets: [MAIL_PASSWORD] }, async () => {
  const now = Date.now();
  const week = payoutWeek(now);
  const pending = (await db().collection('ledger').where('payoutId', '==', null).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!pending.length) return;
  // Reservas en disputa: su dinero espera a que HULUL resuelva.
  const bookingIds = [...new Set(pending.map((e) => e.bookingId))];
  const disputed = new Set();
  for (let i = 0; i < bookingIds.length; i += 100) {
    const refs = bookingIds.slice(i, i + 100).map((x) => db().doc(`bookings/${x}`));
    const snaps = await db().getAll(...refs);
    for (const s of snaps) if (s.exists && s.data().status === 'en_disputa') disputed.add(s.id);
  }
  const byPro = new Map();
  for (const e of pending) {
    if (Number(e.availableAt ?? 0) > now || disputed.has(e.bookingId)) continue;
    byPro.set(e.proId, [...(byPro.get(e.proId) ?? []), e]);
  }
  const summary = [];
  for (const [proId, entries] of byPro) {
    const pSnap = await db().doc(`providers/${proId}`).get();
    const p = pSnap.data() ?? {};
    const liq = weeklyPayout(entries, p.taxRegime);
    if (liq.net <= 0) { summary.push({ proId, name: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(), net: liq.net, carried: true }); continue; }
    const bank = (await db().doc(`providers/${proId}/private/banco`).get()).data() ?? null;
    const payoutRef = db().collection('payouts').doc(`${week}_${proId}`);
    const writer = db().bulkWriter();
    writer.set(payoutRef, {
      proId, week, status: 'por_pagar', regime: regimeOf(p.taxRegime),
      gross: liq.gross, deductions: liq.deductions, retentions: liq.retentions, net: liq.net, byKind: liq.byKind,
      entryIds: entries.map((e) => e.id), bank: bank ? { bank: bank.bank, type: bank.type, number: bank.number, holder: bank.holder, holderId: bank.holderId } : null,
      retentionsDefined: false, createdAt: FieldValue.serverTimestamp(),
    });
    for (const e of entries) writer.update(db().doc(`ledger/${e.id}`), { payoutId: payoutRef.id });
    // Retenciones como movimientos propios (para el comprobante mensual).
    for (const [k, v] of Object.entries(liq.retentions)) {
      if (v > 0) writer.set(db().collection('ledger').doc(`${payoutRef.id}_ret_${k}`), { kind: `retencion_${k}`, bucket: 'retenciones_por_pagar', amount: v, proDelta: -v, proId, bookingId: null, payoutId: payoutRef.id, availableAt: now, createdAt: FieldValue.serverTimestamp() });
    }
    await writer.close();
    await refreshProBalance(proId);
    summary.push({ proId, name: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(), net: liq.net, email: p.email, liq, bank });
    if (p.email) {
      const { from, notifyTo } = senders();
      await transport().sendMail({
        from, to: p.email, replyTo: notifyTo, subject: `Tu liquidación HULUL de la semana ${week}`,
        html: layout('Tu liquidación semanal', `<p style="font-size:15px">Hola ${esc(p.firstName ?? '')}, este es el resumen de lo que te depositamos esta semana.</p>` + rows([
          ['Cobrado por tus servicios', usd(liq.gross)],
          ['Comisión, cargos, multas y deuda de efectivo', `−${usd(liq.deductions)}`],
          ...(liq.retentions.renta + liq.retentions.iva > 0 ? [['Retenciones de ley', `−${usd(liq.retentions.renta + liq.retentions.iva)}`]] : []),
          ['A depositar', `<strong>${usd(liq.net)}</strong>`],
          ['Cuenta', bank ? `${esc(bank.bank)} ****${esc(String(bank.number ?? '').slice(-4))}` : 'Sin cuenta registrada'],
        ]) + '<p style="font-size:13px;color:#6B6560">La factura de la comisión y el comprobante de retención te llegan aparte.</p>'),
      }).catch((e) => logger.warn('No se pudo enviar la liquidación', { proId, e: String(e) }));
    }
  }
  const { from, notifyTo } = senders();
  const toPay = summary.filter((s) => !s.carried);
  await transport().sendMail({
    from, to: notifyTo, subject: `Liquidación semanal ${week}: ${toPay.length} pagos por ${usd(toPay.reduce((s, x) => s + x.net, 0))}`,
    html: layout('Pagos de la semana', rows(summary.map((s) => [esc(s.name || s.proId), s.carried ? `Saldo ${usd(s.net)} (pasa a la próxima semana)` : `${usd(s.net)} · ${s.bank ? `${esc(s.bank.bank)} ${esc(s.bank.type)} ${esc(s.bank.number)}` : 'SIN CUENTA'}`])) +
      '<p style="font-size:13px;color:#6B6560">Órdenes en Firestore: colección <b>payouts</b> (status "por_pagar"). Al transferir, cambia status a <b>pagado</b>. Retenciones aún en 0: porcentajes por definir con el contador.</p>'),
  }).catch((e) => logger.warn('No se pudo enviar el resumen de liquidación', { e: String(e) }));
  logger.info('Liquidación semanal', { week, pagos: toPay.length });
});

/** Only the professional assigned to this booking can read this aggregate. */
export const resumenCliente = onCall({region:REGION}, async req => {
 const uid=req.auth?.uid; if(!uid) throw new HttpsError('unauthenticated','Inicia sesión.');
 const id=String(req.data?.bookingId || '');
 if(!/^[A-Za-z0-9]{10,40}$/.test(id)) throw new HttpsError('invalid-argument','Reserva inválida.');
 const booking=(await db().doc('bookings/'+id).get()).data();
 if(!canReadClientSummary(uid,booking)) throw new HttpsError('permission-denied','Esta reserva no es tuya.');
 const aggregate=booking.clientId ? (await db().doc('clientRatings/'+booking.clientId).get()).data() : null;
 return clientSummary(booking,aggregate);
});
