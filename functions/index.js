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
import { randomInt } from 'node:crypto';
import { hasProfanity, maskProfanity, PROFANITY_MESSAGE } from './profanity.js';

/** Debe coincidir con la ubicación de la base de datos Firestore. */
const REGION = 'southamerica-east1';
const PROJECT = 'hulul-59081';

initializeApp();
const db = () => getFirestore();

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

function transport() {
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
  const visit = r2(visitRateOf(p, b.category));
  const fee = 1.99;
  const iva = r2((visit + fee) * IVA_RATE);
  const total = r2(visit + fee + iva);
  const near = (x, y) => Math.abs(Number(x) - y) < 0.02;
  // También vale la tarifa publicada en el directorio (por si cambió hace segundos).
  const pub = (await db().doc(`pros/${b.professionalId}`).get()).data()?.visitRates?.[b.category];
  const okFor = (v) => near(b.visit, v) && near(b.subtotal, v) && near(b.fee, fee) && near(b.iva, r2((v + fee) * IVA_RATE)) && near(b.total, r2(v + fee + r2((v + fee) * IVA_RATE)));
  return { ok: okFor(visit) || (Number.isFinite(Number(pub)) && okFor(r2(Number(pub)))), total };
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
      const priced = await checkPrice(b);
      if (!priced.ok) {
        await event.data.ref.update({ status: 'cancelada', cancelledBy: 'sistema', cancelledAt: FieldValue.serverTimestamp(), cancelFee: 0,
          cancelReason: 'El precio de la reserva no coincide con la tarifa del profesional. Vuelve a reservar para ver el precio correcto.', expectedTotal: priced.total });
        await pushTo(b.clientId, 'Revisa tu reserva', 'El precio no coincidía con la tarifa actual del profesional. Vuelve a reservar: no se te cobró nada.', { bookingId: event.params.id, to: 'cliente' }).catch(() => {});
        const { from, notifyTo } = senders();
        await mail.sendMail({ from, to: notifyTo, subject: `Reserva anulada por precio ${code(event.params.id)}`,
          html: layout('Precio alterado o desactualizado', rows([['Código', code(event.params.id)], ['Cliente', esc(b.contactName)], ['Profesional', esc(b.professionalName)], ['Enviado', usd(b.total)], ['Correcto', usd(priced.total)]])) }).catch(() => {});
        logger.warn('Reserva anulada: precio no coincide', { id: event.params.id, sent: b.total, expected: priced.total });
        return;
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
      ['Te queda', `<strong>${usd((b.visit ?? b.subtotal ?? 0) * 0.85)}</strong> por la visita (menos la comisión)`],
    ]) +
    `<p style="font-size:14px;color:#3F3A37;margin-top:16px">Lee bien qué necesita el cliente y acepta solo si sabes hacerlo. Acéptala o recházala en tu agenda.</p>` +
    button('https://hululec.com/profesionales/agenda', 'Abrir mi agenda');
  return { from, to: p.email, replyTo: notifyTo, subject: `Reserva nueva ${code(id)} · ${cat} · ${when}`, html: layout('Tienes una reserva', body) };
}

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
    // Profesional de pruebas (se marca a mano en la consola): horario libre en el periodo de prueba.
    tester: p.tester === true,
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
        const mine = await tx.get(db().collection('bookings').where('professionalId', '==', uid).where('date', '==', cur.date));
        const start = effectiveMs(cur);
        const end = start + Number(cur.hours ?? 1) * 3_600_000;
        const clash = mine.docs.find((d) => {
          if (d.id === id) return false;
          const o = d.data();
          if (!['confirmada', 'en_camino', 'en_curso'].includes(o.status)) return false;
          const os = effectiveMs(o);
          const oe = os + Number(o.hours ?? 1) * 3_600_000;
          return start < oe + TRAVEL_GAP_MIN * 60_000 && os < end + TRAVEL_GAP_MIN * 60_000;
        });
        if (clash) {
          const o = clash.data();
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
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(0[6-9]|1[0-9]|2[0-1]):(00|15|30|45)$/.test(slot)) throw new HttpsError('invalid-argument', 'Elige una fecha y una hora entre 06:00 y 21:45 (cada 15 minutos).');
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

// Mismos valores que packages/shared/src/pricing.ts (extraQuote).
const IVA_RATE = 0.15;
const COMMISSION = 0.15;
const r2 = (n) => Math.round(n * 100) / 100;

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
      const extra = { amount, description, iva: r2(amount * IVA_RATE), total: r2(amount * (1 + IVA_RATE)), commission: r2(amount * COMMISSION), status: 'propuesto', proposedAt: FieldValue.serverTimestamp() };
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
    // La comisión de HULUL queda como saldo a cargo del profesional.
    if (!b.demo) tx.set(db().doc(`providers/${uid}`), { cashDebt: FieldValue.increment(ex.commission) }, { merge: true });
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
  await pushTo(toPro ? b.professionalId : b.clientId, `💬 ${name}`, body, toPro ? { url: AGENDA, bookingId: id, to: 'pro', chat: true } : { bookingId: id, to: 'cliente', chat: true });
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

const PROBLEMS = {
  si_estaba: 'El cliente sí estaba en casa',
  no_vino: 'No se realizó el servicio',
  incompleto: 'Se marcó como terminado, pero no se completó',
  cobro: 'El cobro no fue el acordado',
  otro: 'Otra cosa',
};

/**
 * El cliente reporta un problema con una visita terminada (hasta 48 h). La
 * reserva pasa a "en revisión": el pago queda retenido (no se libera al
 * profesional ni se cierra sola) hasta que HULUL revise la evidencia (código de
 * llegada, ubicación, fotos, diagnóstico y chat) y decida.
 */
export const reportarProblema = onCall({ region: REGION, secrets: [MAIL_PASSWORD] }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const id = String(req.data?.id ?? '');
  const kind = String(req.data?.kind ?? '');
  const text = String(req.data?.text ?? '').trim().slice(0, 1000);
  if (!/^[A-Za-z0-9]{10,40}$/.test(id) || !PROBLEMS[kind]) throw new HttpsError('invalid-argument', 'Elige qué pasó.');
  if (text.length < 15) throw new HttpsError('invalid-argument', 'Cuéntanos qué pasó (al menos 15 caracteres).');
  const ref = db().doc(`bookings/${id}`);
  const b = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'No encontramos esa reserva.');
    const bk = snap.data();
    if (bk.clientId !== uid) throw new HttpsError('permission-denied', 'Esta reserva no es tuya.');
    const finished = bk.finishedAt?.toMillis?.() ?? 0;
    const absent = bk.status === 'cancelada' && bk.cancelledBy === 'cliente_ausente' && Date.now() - (bk.cancelledAt?.toMillis?.() ?? 0) < 48 * 3_600_000;
    if (kind === 'si_estaba' && !absent) throw new HttpsError('failed-precondition', 'Esta opción es para cuando el profesional marcó que no te encontró (hasta 48 horas después).');
    const inWindow = absent || bk.status === 'por_aprobar' || (bk.status === 'completada' && Date.now() - finished < 48 * 3_600_000);
    if (!inWindow) throw new HttpsError('failed-precondition', 'Los problemas se reportan hasta 48 horas después de terminada la visita.');
    if (bk.dispute) throw new HttpsError('already-exists', 'Ya reportaste un problema en esta reserva. Lo estamos revisando.');
    tx.update(ref, { status: 'en_disputa', previousStatus: bk.status, dispute: { kind, text, at: FieldValue.serverTimestamp(), status: 'abierta' } });
    return bk;
  });
  try {
    const { from, notifyTo } = senders();
    await transport().sendMail({ from, to: notifyTo, replyTo: b.contactEmail || undefined, subject: `RECLAMO ${code(id)} · ${PROBLEMS[kind]}`,
      html: layout('Reclamo por revisar', rows([
        ['Código', code(id)], ['Motivo', esc(PROBLEMS[kind])], ['Detalle', esc(text)],
        ['Cliente', `${esc(b.contactName)} · ${esc(b.contactPhone)}`], ['Profesional', esc(b.professionalName)],
        ['Resultado marcado', esc(outcomeText(b.outcome, b.category))], [reportName(b.category), esc(b.diagnosis ?? '—')],
        ['Empezó con código', b.startedAt ? 'Sí' : 'No'],
        ...(b.cancelledBy === 'cliente_ausente' ? [['Cliente ausente', `Cobro retenido: ${usd(b.cancelFee)}. Llegada marcada a ${b.arrivedPos?.distance ?? '¿?'} m de la dirección.`]] : []),
      ]) + `<p style="font-size:13px;color:#6B6560">Revisa en Firestore la reserva, sus fotos y el chat (bookings/${esc(id)}/messages). Para cerrar: cambia <b>status</b> a <b>completada</b> (procede el pago) o <b>cancelada</b> con <b>cancelFee</b> 0 (se devuelve al cliente). Si era "cliente ausente" y el cliente tiene razón: <b>cancelada</b>, <b>cancelFee</b> 0 y resta el monto de <b>balance</b> en clients/${esc(b.clientId)}.</p>` +
        button(`https://console.firebase.google.com/project/${PROJECT}/firestore/databases/-default-/data/~2Fbookings~2F${id}`, 'Revisar en Firebase')) });
    await pushTo(b.professionalId, 'El cliente pidió ayuda con el servicio', `${PROBLEMS[kind]}. HULUL lo revisa; el pago queda retenido mientras tanto. Puedes responder por el chat.`, { url: AGENDA, bookingId: id, to: 'pro' });
  } catch (e) {
    logger.warn('No se pudo avisar el reclamo', { id, e: String(e) });
  }
  return { ok: true };
});
