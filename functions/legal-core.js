/**
 * Parte legal de HULUL: prueba de aceptación de términos (quién, qué versión, cuándo, desde
 * dónde), constancia en PDF y validación de casos legales. Funciones puras salvo el PDF.
 * Pruebas en legal-core.test.js.
 */
import PDFDocument from 'pdfkit';
import { createHash } from 'node:crypto';

export const LEGAL_DOCS = {
  terminos: 'Términos y condiciones',
  privacidad: 'Política de privacidad',
  mandato: 'Mandato de cobro y reglas para profesionales',
};
const VERSION = /^\d{4}-\d{2}-\d{2}[a-z0-9-]{0,10}$/;
const HASH = /^[a-f0-9]{64}$/;

/** Valida lo que manda la app al aceptar. */
export function acceptanceInput(d) {
  const tipo = d?.tipo === 'profesional' ? 'profesional' : d?.tipo === 'cliente' ? 'cliente' : null;
  if (!tipo) return { error: 'Tipo de usuario no válido.' };
  const docs = (Array.isArray(d?.docs) ? d.docs : []).slice(0, 5)
    .filter((x) => LEGAL_DOCS[x?.doc] && VERSION.test(String(x?.version ?? '')))
    .map((x) => ({ doc: x.doc, version: x.version, textoHash: HASH.test(String(x?.textoHash ?? '')) ? x.textoHash : null }));
  if (!docs.length) return { error: 'No hay documentos aceptados.' };
  if (tipo === 'profesional' && !docs.some((x) => x.doc === 'mandato')) return { error: 'El profesional debe aceptar el mandato de cobro.' };
  const canal = ['web', 'app'].includes(d?.canal) ? d.canal : 'web';
  return { tipo, docs, canal, momento: ['registro', 'cambio_version', 'reserva'].includes(d?.momento) ? d.momento : 'registro' };
}

/** IP del usuario (detrás del balanceador de Google) y dispositivo. */
export function clientInfo(rawRequest) {
  const h = rawRequest?.headers ?? {};
  const fwd = String(h['x-forwarded-for'] ?? '').split(',')[0].trim();
  const ip = (fwd || rawRequest?.ip || '').replace(/^::ffff:/, '').slice(0, 64);
  return { ip, userAgent: String(h['user-agent'] ?? '').slice(0, 300), origen: String(h.origin ?? '').slice(0, 120) };
}

/** Huella SHA-256 del registro: si alguien lo cambia, ya no coincide. */
export function fingerprint(rec) {
  const base = JSON.stringify({ uid: rec.uid, email: rec.email, tipo: rec.tipo, docs: rec.docs, ip: rec.ip, userAgent: rec.userAgent, at: rec.atIso });
  return createHash('sha256').update(base).digest('hex');
}

export const CASE_TYPES = {
  demanda_civil: 'Demanda civil',
  denuncia_penal: 'Denuncia penal (Fiscalía)',
  defensoria: 'Reclamo en la Defensoría del Pueblo (consumidor)',
  laboral: 'Reclamo o inspección del Ministerio del Trabajo',
  datos: 'Reclamo por protección de datos (LOPDP)',
  sri: 'Requerimiento del SRI',
  extrajudicial: 'Reclamo extrajudicial o carta de abogado',
  otro: 'Otro',
};
export const CASE_STATUS = ['abierto', 'en_tramite', 'audiencia', 'cerrado_favorable', 'cerrado_acuerdo', 'cerrado_desfavorable'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function caseInput(d) {
  const tipo = CASE_TYPES[d?.tipo] ? d.tipo : null;
  const titulo = String(d?.titulo ?? '').trim().slice(0, 140);
  if (!tipo) return { error: 'Elige el tipo de caso.' };
  if (titulo.length < 4) return { error: 'Escribe un título corto del caso.' };
  if (!ISO.test(String(d?.notificado ?? ''))) return { error: 'Escribe la fecha en que HULUL fue notificada.' };
  const contraparteTipo = ['cliente', 'profesional', 'trabajador', 'autoridad', 'otro'].includes(d?.contraparteTipo) ? d.contraparteTipo : 'otro';
  return {
    tipo, titulo, notificado: d.notificado, contraparteTipo,
    contraparte: String(d?.contraparte ?? '').trim().slice(0, 120),
    contraparteId: String(d?.contraparteId ?? '').trim().slice(0, 60),
    reserva: String(d?.reserva ?? '').trim().slice(0, 40),
    autoridad: String(d?.autoridad ?? '').trim().slice(0, 140),
    proceso: String(d?.proceso ?? '').trim().slice(0, 60),
    abogado: String(d?.abogado ?? '').trim().slice(0, 120),
    estado: CASE_STATUS.includes(d?.estado) ? d.estado : 'abierto',
    proxima: ISO.test(String(d?.proxima ?? '')) ? d.proxima : null,
    proximaQue: String(d?.proximaQue ?? '').trim().slice(0, 160),
    monto: Math.max(0, Math.round(Number(d?.monto || 0) * 100) / 100),
    notas: String(d?.notas ?? '').trim().slice(0, 4000),
  };
}

const fmt = (iso) => new Date(iso).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', dateStyle: 'long', timeStyle: 'medium' });

/** Constancia en PDF de una aceptación (para un juez, la Defensoría o el propio usuario). */
export function acceptancePdf(rec, company = { name: 'Corporación Coffeeport Cía. Ltda. (HULUL)', ruc: '0993265160001' }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Constancia de aceptación ${rec.id}`, Author: 'HULUL' } });
    const out = []; doc.on('data', (c) => out.push(c)); doc.on('end', () => resolve(Buffer.concat(out))); doc.on('error', reject);
    doc.rect(0, 0, doc.page.width, 70).fill('#123F43');
    doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(20).text('HULUL', 50, 24);
    doc.font('Helvetica').fontSize(9).text(`${company.name} · RUC ${company.ruc}`, 50, 48);
    doc.fill('#1C2B2A').font('Helvetica-Bold').fontSize(15).text('Constancia de aceptación electrónica', 50, 96);
    doc.font('Helvetica').fontSize(10).fill('#5E6E6B').text('Registro generado por la plataforma al momento de la aceptación. Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos: los mensajes de datos tienen igual valor jurídico que los documentos escritos (art. 2).', { width: 495 });
    doc.moveDown(1);
    const row = (k, v) => { doc.font('Helvetica-Bold').fontSize(10).fill('#1C2B2A').text(k, { continued: true }).font('Helvetica').text(`  ${v || '—'}`); doc.moveDown(0.3); };
    row('Registro:', rec.id);
    row('Fecha y hora:', fmt(rec.atIso));
    row('Usuario:', `${rec.nombre || ''} ${rec.email ? `<${rec.email}>` : ''}`.trim());
    row('Identificador de cuenta:', rec.uid);
    row('Tipo:', rec.tipo === 'profesional' ? 'Profesional' : 'Cliente');
    row('Momento:', { registro: 'Registro de la cuenta', cambio_version: 'Aceptación de una versión nueva', reserva: 'Reserva' }[rec.momento] ?? rec.momento);
    row('Canal:', rec.canal === 'app' ? 'Aplicación móvil' : 'Sitio web hululec.com');
    row('Dirección IP:', rec.ip);
    row('Dispositivo:', rec.userAgent);
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(12).text('Documentos aceptados');
    doc.moveDown(0.3);
    for (const d of rec.docs) {
      doc.font('Helvetica').fontSize(10).text(`• ${LEGAL_DOCS[d.doc] ?? d.doc}, versión ${d.version}${d.textoHash ? ` (huella del texto ${d.textoHash.slice(0, 16)}…)` : ''}`);
    }
    doc.moveDown(0.8);
    doc.font('Helvetica').fontSize(10).fill('#1C2B2A').text('Forma de aceptación: el usuario marcó la casilla «Acepto…» con enlace a cada documento y confirmó con el botón de la pantalla, estando autenticado en su cuenta. Se le envió una copia por correo.', { width: 495 });
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(10).text('Huella de integridad (SHA-256) del registro');
    doc.font('Courier').fontSize(9).text(rec.huella);
    doc.font('Helvetica').fontSize(8.5).fill('#5E6E6B').text('Si cualquier dato del registro se cambiara, esta huella ya no coincidiría.', { width: 495 });
    doc.end();
  });
}
