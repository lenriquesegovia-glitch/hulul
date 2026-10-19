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
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import nodemailer from 'nodemailer';

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

// Mismos textos que packages/shared/src/policy.ts.
const OUTCOMES = { resuelto: 'Quedó resuelto', parcial: 'Necesita más trabajo', no_resuelto: 'No se pudo resolver' };
const AFTER_VISIT_NOTE = 'HULUL cobra solo la visita. Si hace falta más trabajo, repuestos u otra visita, lo acuerdas directamente con el profesional; HULUL no interviene ni garantiza ese acuerdo. Califica al profesional para que otros clientes sepan cómo trabajó.';
const HOME_SAFETY_NOTICE = [
  'Ten en casa a una persona adulta de tu confianza mientras dure el trabajo.',
  'Guarda dinero, joyas, documentos y objetos de valor, y no dejes al profesional solo en áreas que no necesita.',
  'HULUL verifica la identidad y los antecedentes de los profesionales, pero no se responsabiliza por robos, pérdidas ni daños de objetos durante el servicio.',
];
const safetyHtml = () => `<div style="background:#FFF6E5;border:1px solid #E9C98B;border-radius:10px;padding:12px 14px;margin-top:16px;font-size:14px;color:#3F3A37"><strong>Antes de que entre a tu casa</strong><ul style="margin:8px 0 0;padding-left:18px">${HOME_SAFETY_NOTICE.map((t) => `<li style="margin:4px 0">${esc(t)}</li>`).join('')}</ul></div>`;

/** Tarifa por visita válida, o null. */
const validRate = (n) => (typeof n === 'number' && Number.isFinite(n) && n >= MIN_VISIT_RATE && n <= MAX_VISIT_RATE ? Math.round(n * 100) / 100 : null);

/** Categorías aprobadas. Sin catStatus (registros anteriores al 18-oct): todas. */
function approvedCats(p) {
  const cats = p.categories ?? [];
  if (!p.catStatus) return cats;
  return cats.filter((c) => (p.catStatus[c] ?? 'aprobado') === 'aprobado');
}
const visitRateOf = (p, c) => validRate(p.visitRates?.[c]) ?? SUGGESTED[c] ?? 20;
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

export const avisoReserva = onDocumentCreated(
  { document: 'bookings/{id}', region: REGION, secrets: [MAIL_PASSWORD] },
  async (event) => {
    const b = event.data?.data();
    if (!b) return;
    const mail = transport();
    for (const m of bookingEmails(b, event.params.id, senders())) await mail.sendMail(m);
    // Aviso al profesional real (si es uno registrado y aprobado).
    try {
      const pro = await db().doc(`providers/${b.professionalId}`).get();
      const p = pro.exists ? pro.data() : null;
      if (p?.email && p.status === 'aprobado') await mail.sendMail(proBookingEmail(b, event.params.id, p, senders()));
    } catch (e) {
      logger.warn('No se pudo avisar al profesional', { id: event.params.id, e: String(e) });
    }
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
    const ref = db().doc(`bookings/${id}`);

    const result = await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'No encontramos esa reserva.');
      const b = snap.data();
      if (b.clientId !== uid) throw new HttpsError('permission-denied', 'Esta reserva no es tuya.');
      const fee = cancelFee(b);
      if (fee === null) throw new HttpsError('failed-precondition', b.status === 'cancelada' ? 'Esta reserva ya está cancelada.' : 'El servicio ya empezó o terminó; no se puede cancelar.');
      tx.update(ref, {
        status: 'cancelada', cancelledBy: 'cliente', cancelledAt: FieldValue.serverTimestamp(),
        cancelFee: fee, cancelReason: reason, previousStatus: b.status,
      });
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

/** Qué puede hacer el profesional en cada estado. */
const PRO_ACTIONS = {
  aceptar: { from: ['pendiente'], to: 'confirmada', stamp: 'acceptedAt' },
  rechazar: { from: ['pendiente'], to: 'cancelada', stamp: 'cancelledAt' },
  en_camino: { from: ['confirmada'], to: 'en_camino', stamp: 'enRouteAt' },
  llegue: { from: ['en_camino'], to: 'en_curso', stamp: 'startedAt' },
  terminar: { from: ['en_curso'], to: 'por_aprobar', stamp: 'finishedAt' },
  no_puedo: { from: ['confirmada', 'en_camino'], to: 'cancelada', stamp: 'cancelledAt' },
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
    const rule = PRO_ACTIONS[action];
    if (!rule || !/^[A-Za-z0-9]{10,40}$/.test(id)) throw new HttpsError('invalid-argument', 'Acción no válida.');
    // Al terminar: resultado, diagnóstico escrito y fotos (respaldo para ambos).
    let report = null;
    if (action === 'terminar') {
      const outcome = String(req.data?.outcome ?? '');
      const diagnosis = String(req.data?.diagnosis ?? '').trim().slice(0, 1500);
      const photos = Array.isArray(req.data?.photos) ? req.data.photos.map(String) : [];
      if (!OUTCOMES[outcome]) throw new HttpsError('invalid-argument', 'Elige cómo quedó el trabajo.');
      if (outcome !== 'resuelto' && diagnosis.length < 20) throw new HttpsError('invalid-argument', 'Explica en el diagnóstico qué encontraste y qué hace falta (mínimo 20 caracteres).');
      if (photos.length > 6) throw new HttpsError('invalid-argument', 'Máximo 6 fotos.');
      const prefix = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(`diagnosticos/${uid}/${id}/`)}`;
      if (photos.some((u) => !u.startsWith(prefix))) throw new HttpsError('invalid-argument', 'Fotos no válidas.');
      report = { outcome, diagnosis, diagnosisPhotos: photos };
    }
    const proSnap = await db().doc(`providers/${uid}`).get();
    const pro = proSnap.data();
    if (!pro || pro.status !== 'aprobado') throw new HttpsError('permission-denied', 'Tu cuenta de profesional no está activa.');
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
      if (action === 'rechazar' || action === 'no_puedo') {
        patch.cancelledBy = 'profesional';
        patch.cancelReason = reason;
        patch.cancelFee = 0;
        // Cancelar algo ya aceptado con menos de 2 horas (o yendo en camino) es una falta.
        if (action === 'no_puedo' && cancelFee({ ...cur, status: cur.status }) > 0) {
          patch.proFine = 5;
          tx.set(db().doc(`providers/${uid}`), { strikes: FieldValue.increment(1) }, { merge: true });
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
      const msgs = {
        aceptar: [`${b.professionalName} confirmó tu reserva`, `Hola ${esc(first)}, ${esc(b.professionalName)} confirmó tu servicio de ${esc(cat)} para el ${esc(when)}. Te avisaremos cuando salga hacia tu dirección.`],
        en_camino: [`${b.professionalName} va en camino`, `Hola ${esc(first)}, ${esc(b.professionalName)} ya salió hacia ${esc(b.address)}. Míralo en <a href="https://hululec.com/cuenta">Mi cuenta</a>.`],
        llegue: [`${b.professionalName} llegó`, `Hola ${esc(first)}, ${esc(b.professionalName)} marcó que llegó a tu dirección y va a empezar el trabajo.${safetyHtml()}`],
        terminar: ['Tu servicio terminó: revisa el diagnóstico', `Hola ${esc(first)}, ${esc(b.professionalName)} terminó la visita.` +
          (report ? rows([['Resultado', `<strong>${esc(OUTCOMES[report.outcome])}</strong>`], ['Diagnóstico', esc(report.diagnosis) || '—'], ['Fotos', report.diagnosisPhotos.length ? report.diagnosisPhotos.map((u, i) => `<a href="${esc(u)}" style="color:#7A1E2C">Foto ${i + 1}</a>`).join(' · ') : '—']]) : '') +
          `<p style="font-size:14px;color:#3F3A37">${esc(AFTER_VISIT_NOTE)} Tienes 48 horas para calificarlo o reportar un problema en <a href="https://hululec.com/cuenta">Mi cuenta</a>.</p>`],
        rechazar: ['Tu reserva necesita otro profesional', `Hola ${esc(first)}, ${esc(b.professionalName)} no puede atender tu reserva del ${esc(when)}. No se te cobra nada. Elige otro profesional en <a href="https://hululec.com/servicios/${esc(b.category)}">HULUL</a>.`],
        no_puedo: ['Tu profesional canceló', `Hola ${esc(first)}, ${esc(b.professionalName)} canceló tu reserva del ${esc(when)}. No se te cobra nada y te ayudamos a encontrar otro profesional.`],
      }[action];
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
          if (r === null) throw new HttpsError('invalid-argument', `La tarifa de ${CATEGORIES[c] ?? c} debe estar entre $${MIN_VISIT_RATE} y $${MAX_VISIT_RATE}.`);
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
      if (rate === null) throw new HttpsError('invalid-argument', `La tarifa por visita debe estar entre $${MIN_VISIT_RATE} y $${MAX_VISIT_RATE}.`);
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
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(0[7-9]|1[0-9]):00$/.test(slot)) throw new HttpsError('invalid-argument', 'Elige una fecha y una hora entre 07:00 y 19:00.');
        const at = appointmentMs(date, slot);
        if (at < Date.now() + 60 * 60_000) throw new HttpsError('invalid-argument', 'La nueva hora debe ser al menos dentro de 1 hora.');
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
        if (appointmentMs(p.date, p.slot) < Date.now() + 30 * 60_000) throw new HttpsError('failed-precondition', 'Esa hora ya pasó o está muy cerca. Propón otra.');
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
      if (to && texts) await transport().sendMail({ from, to, replyTo: notifyTo, subject: texts[0], html: layout(texts[0], `<p style="font-size:15px">${texts[1]}</p>` + button(link, 'Ver la reserva')) });
    } catch (e) {
      logger.warn('No se pudo avisar el cambio de hora', { id, e: String(e) });
    }
    return { ok: true };
  },
);
