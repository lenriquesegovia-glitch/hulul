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
    ['Horas', esc(b.hours)],
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
        ['Horas', esc(b.hours)],
        ['Dirección', esc(b.address)],
        ...(mapsUrl(b.location) ? [['Ubicación', mapRow(b.location)]] : []),
        ['Total', `<strong>${usd(b.total)}</strong>`],
      ]) +
      `<p style="font-size:14px;color:#3F3A37;margin-top:16px">Te escribiremos por WhatsApp para confirmar. El pago queda retenido por HULUL y se libera al profesional cuando apruebas el trabajo.</p>` +
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

/** Correos cuando un profesional envía su registro a revisión. */
export function providerEmails(p, uid, { from, notifyTo }) {
  const name = p.kind === 'empresa' ? `${p.businessName} (${p.firstName} ${p.lastName})` : `${p.firstName} ${p.lastName}`;
  const cats = (p.categories ?? []).map((c) => `${CATEGORIES[c] ?? c} · $${p.rates?.[c]}/h · mín. ${p.minHours?.[c]} h`).join('<br>');
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
    `<p style="font-size:13px;color:#6B6560;margin-top:12px">Para aprobar: en Firestore cambia <b>status</b> a <b>aprobado</b> (o <b>observado</b> si hay que corregir algo). Los documentos están en Storage, carpeta providers/${esc(uid)}.</p>` +
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
      ['Horas', esc(b.hours)],
      ['Cliente', esc(firstName)],
      ['Dirección', esc(b.address)],
      ['Ubicación', mapRow(b.location)],
      ['Trabajo', esc(b.notes)],
      ['Pago', esc(PAYMENTS[b.paymentMethod] ?? b.paymentMethod)],
      ['Te queda', `<strong>${usd((b.subtotal ?? 0) * 0.85)}</strong> aprox. (menos la comisión)`],
    ]) +
    `<p style="font-size:14px;color:#3F3A37;margin-top:16px">Responde este correo o escríbenos por WhatsApp para confirmar que vas. Pronto podrás aceptar desde la app de profesionales.</p>`;
  return { from, to: p.email, replyTo: notifyTo, subject: `Reserva nueva ${code(id)} · ${cat} · ${when}`, html: layout('Tienes una reserva', body) };
}

/** Datos públicos de un profesional aprobado (nada de cédula, RUC, contacto ni banco). */
export function publicPro(p, uid) {
  const name = p.kind === 'empresa' ? String(p.businessName ?? '').trim() : `${String(p.firstName ?? '').trim()} ${String(p.lastName ?? '').trim()}`.trim();
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return {
    uid, name, initials, isCompany: p.kind === 'empresa',
    categories: p.categories ?? [], services: p.services ?? {}, rates: p.rates ?? {},
    cities: p.cities ?? [], years: Number(p.years ?? 0), bio: String(p.bio ?? ''),
    days: p.days ?? [], from: p.from ?? '', to: p.to ?? '', acceptsCash: !!p.acceptsCash,
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
    const cur = await ref.get();
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
          button(`https://hululec.com/profesional/${uid}`, 'Ver mi perfil')),
      });
    }
  },
);

/* ------------------------------ Cancelación ------------------------------ */

// Misma regla que packages/shared/src/policy.ts (cancelTerms). Si cambias una, cambia la otra.
const FREE_CANCEL_HOURS = 2;
const LATE_CANCEL_FEE = 3;
const CANCELLABLE = ['pendiente', 'confirmada', 'en_camino'];

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
