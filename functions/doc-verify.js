/**
 * Verificación de documentos del registro de profesionales.
 * Misma lógica que el formulario anónimo (herramientas/registro-profesionales/Code.gs):
 * se lee el texto del documento (OCR) y se comprueba que sea el documento que
 * dice ser y que sea de esta persona (cédula, RUC, apellido, fechas).
 *
 * Resultado: ok · revisar (pasa, pero queda marcado para revisión manual) ·
 * rechazado (no deja continuar). Sin Firebase: pruebas en doc-verify.test.js.
 */

export const VERIFY_CFG = {
  /** Distancia entre rostros (0 = idénticos). Hasta FACE_OK coincide; hasta FACE_REJECT pasa con revisión; más, se rechaza. */
  FACE_OK: 0.42,
  FACE_REJECT: 0.5,
  /** Antigüedad máxima del certificado de antecedentes penales (días). */
  ANTECEDENTES_MAX_DAYS: 90,
};

export const VERIFIED_DOCS = ['cedulaFrente', 'cedulaReverso', 'selfie', 'antecedentes', 'ruc', 'titulo'];

const TIP = {
  cedulaFrente: 'Toma la foto de cerca, con buena luz, sin reflejos y que se vea la cédula completa.',
  cedulaReverso: 'Toma la foto de cerca, con buena luz, sin reflejos y que se vea la cédula completa.',
  antecedentes: 'Sube el PDF original que descargaste del Ministerio del Interior (no una foto de la pantalla).',
  ruc: 'Sube el PDF del certificado del RUC que descargas en SRI en línea.',
  titulo: '',
};

/** Hoy en Ecuador (UTC-5), a medianoche. */
export function todayEc(now = Date.now()) {
  const d = new Date(now - 5 * 3600_000);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const human = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

/**
 * Verifica un documento a partir de su texto.
 * @param {string} key cedulaFrente | cedulaReverso | antecedentes | ruc | titulo
 * @param {string} text texto leído por OCR
 * @param {{cedula:string, ruc?:string, firstName:string, lastName:string, businessName?:string, kind?:string}} ex datos del profesional
 */
export function verifyText(key, text, ex = {}, today = todayEc()) {
  const t = normText(text);
  const r = { status: 'ok', msg: '', checks: { chars: t.length } };
  const set = (status, msg) => { r.status = status; r.msg = msg; return r; };
  if (t.length < 15) return set('rechazado', `No pudimos leer nada en el archivo. ${TIP[key] ?? ''}`.trim());

  const ced = String(ex.cedula || ''), ruc = String(ex.ruc || '');
  const others = foreignIds(t, [ced, ruc.slice(0, 10)]);
  const sur = surnameFound(t, ex.lastName), name = nameFound(t, ex.firstName);
  r.checks.apellido = sur; r.checks.nombre = name;

  if (key === 'cedulaFrente' || key === 'cedulaReverso') {
    const numOk = hasNumber(t, ced);
    const isId = /ECUADOR|IDENTIDAD|CEDULA|CIUDADANIA|REGISTRO CIVIL|NUI|IDECU|I<ECU/.test(t);
    const back = /PADRE|MADRE|INSTRUCCION|PROFESION|OCUPACION|DACTILAR|EXPEDICION|IDECU|I<ECU|<<</.test(t);
    r.checks.numero = numOk; r.checks.esCedula = isId;
    const exp = dateAfter(t, /EXPIRACION|VENCIMIENTO|CADUCIDAD|EXPIRA/);
    if (exp) {
      r.checks.caduca = iso(exp);
      if (exp < today) return set('rechazado', `Tu cédula está caducada (venció el ${human(exp)}). Necesitamos una cédula vigente.`);
    }
    if (others.length && !numOk) return set('rechazado', 'La cédula de la foto no es la tuya (tiene otro número). Sube la foto de tu propia cédula.');
    if (key === 'cedulaFrente') {
      if (numOk && sur) return r;
      if (numOk || (sur && isId)) return set('revisar', 'Leímos solo parte de tus datos; lo revisaremos a mano.');
      return set('rechazado', `En la foto no se lee tu número de cédula ni tu apellido. ${TIP[key]}`);
    }
    if (!back && !isId) return set('rechazado', `Esta foto no parece el reverso de una cédula. ${TIP[key]}`);
    if (!back) return set('revisar', 'No pudimos confirmar que sea el reverso; lo revisaremos a mano.');
    return r;
  }

  if (key === 'antecedentes') {
    const isCert = /ANTECEDENTES/.test(t);
    const numOk = hasNumber(t, ced);
    r.checks.numero = numOk; r.checks.esCertificado = isCert;
    if (!isCert) return set('rechazado', `Este archivo no es un certificado de antecedentes penales. ${TIP[key]}`);
    if (!numOk) {
      if (others.length) return set('rechazado', 'El certificado es de otra persona (tiene otro número de cédula).');
      return set('rechazado', `No encontramos tu número de cédula en el certificado. ${TIP[key]}`);
    }
    const issued = latestDate(t, today);
    if (issued) {
      r.checks.emitido = iso(issued);
      const days = Math.floor((today - issued) / 86_400_000);
      if (days > VERIFY_CFG.ANTECEDENTES_MAX_DAYS) {
        return set('rechazado', `Tu certificado es del ${human(issued)} y tiene más de ${Math.round(VERIFY_CFG.ANTECEDENTES_MAX_DAYS / 30)} meses. Descarga uno nuevo (es gratis).`);
      }
    }
    const clean = /NO\s+(SE\s+)?REGISTRA|NO\s+TIENE\s+ANTECEDENTES|NO\s+POSEE\s+ANTECEDENTES/.test(t);
    const record = !clean && /(SI|SÍ)\s+REGISTRA|REGISTRA\s+ANTECEDENTES|POSEE\s+ANTECEDENTES/.test(t);
    r.checks.registra = record ? 'si' : clean ? 'no' : 'no se pudo leer';
    if (record) { r.flag = 'Registra antecedentes'; return set('revisar', 'Recibido. Lo revisaremos a mano.'); }
    if (!issued) { r.flag = 'Fecha del certificado ilegible'; return set('revisar', 'No pudimos leer la fecha del certificado; lo revisaremos a mano.'); }
    if (!clean) { r.flag = 'No se leyó si registra antecedentes'; return set('revisar', 'Recibido. Lo revisaremos a mano.'); }
    return r;
  }

  if (key === 'ruc') {
    const isRuc = /CONTRIBUYENTE|REGISTRO UNICO|RENTAS INTERNAS|\bRUC\b|\bSRI\b/.test(t);
    const numOk = hasNumber(t, ruc);
    r.checks.numero = numOk; r.checks.esRuc = isRuc;
    if (!isRuc) return set('rechazado', `Este archivo no es un certificado del RUC. ${TIP[key]}`);
    if (!numOk) {
      if (foreignRucs(t, ruc).length) return set('rechazado', 'El certificado es de otro RUC. Sube el certificado de tu RUC.');
      return set('rechazado', `No encontramos tu número de RUC en el certificado. ${TIP[key]}`);
    }
    const holderOk = ex.kind === 'empresa' ? companyFound(t, ex.businessName) : sur;
    r.checks.titular = holderOk;
    if (/SUSPENDID|PASIVO|CANCELAD|CERRAD/.test(t) && !/ACTIVO/.test(t)) {
      r.flag = 'RUC posiblemente inactivo';
      return set('revisar', 'Tu RUC podría no estar activo; lo revisaremos a mano.');
    }
    if (!holderOk) { r.flag = 'Titular del RUC no encontrado'; return set('revisar', 'No encontramos tu nombre en el certificado; lo revisaremos a mano.'); }
    return r;
  }

  if (key === 'titulo') {
    if (!sur) { r.flag = 'Nombre no encontrado en el título'; return set('revisar', 'No encontramos tu nombre en el título; lo revisaremos a mano.'); }
    return r;
  }
  return r;
}

/** Selfie: la comparación de rostros la hace el navegador; aquí se aplican los umbrales. */
export function verifySelfie(face) {
  const f = face || {};
  const dist = Number(f.distance);
  const checks = { distancia: Number.isFinite(dist) ? dist : null, pruebaDeVida: !!f.liveness, modo: String(f.mode || '').slice(0, 10), intentos: Number(f.tries) || 1 };
  if (!Number.isFinite(dist) || dist < 0 || dist > 2) return { status: 'rechazado', msg: 'Falta comparar tu selfie con la foto de tu cédula. Vuelve a tomarla.', checks };
  if (dist < 0.15 && !f.liveness) return { status: 'rechazado', msg: 'La selfie debe ser de tu rostro, no una foto de tu cédula.', checks };
  if (dist > VERIFY_CFG.FACE_REJECT) return { status: 'rechazado', msg: 'Tu rostro no coincide con la foto de tu cédula.', checks };
  if (dist > VERIFY_CFG.FACE_OK) return { status: 'revisar', msg: 'El parecido con tu cédula no es claro; lo revisaremos a mano.', flag: 'Parecido dudoso con la cédula', checks };
  if (!f.liveness) return { status: 'revisar', msg: 'Selfie sin prueba de vida; la revisaremos a mano.', flag: 'Selfie sin cámara en vivo', checks };
  return { status: 'ok', msg: '', checks };
}

/** Datos con los que se verifica (si cambian después, hay que volver a subir el documento). */
export function expectOf(p) {
  const s = (x, n) => String(x ?? '').trim().slice(0, n);
  return { cedula: s(p?.cedula, 10), ruc: s(p?.ruc, 13), firstName: s(p?.firstName, 80), lastName: s(p?.lastName, 80), businessName: s(p?.businessName, 120), kind: p?.kind === 'empresa' ? 'empresa' : 'persona' };
}
export const sameExpect = (a, b, key) => {
  if (!a || !b) return false;
  if (a.cedula !== b.cedula || normText(a.lastName) !== normText(b.lastName)) return false;
  if (key === 'ruc' && (a.ruc !== b.ruc || normText(a.businessName) !== normText(b.businessName))) return false;
  return true;
};

/**
 * Al enviar el registro: todos los documentos obligatorios deben estar
 * verificados (ok o revisar), sobre el archivo actual y con los datos actuales.
 * Devuelve { problems: [...], alerts: [...] }.
 */
export function submissionCheck(p, verification, required) {
  const problems = [], alerts = [];
  const LABEL = { cedulaFrente: 'Cédula (frente)', cedulaReverso: 'Cédula (reverso)', selfie: 'Foto de rostro', antecedentes: 'Certificado de antecedentes', ruc: 'Certificado del RUC', titulo: 'Título' };
  const ex = expectOf(p);
  const keys = [...required, ...(p?.docs?.titulo && !required.includes('titulo') ? ['titulo'] : [])];
  for (const k of keys) {
    const doc = p?.docs?.[k];
    const v = verification?.[k];
    if (!doc?.path) { problems.push(`${LABEL[k]}: falta subirlo.`); continue; }
    if (!v || v.path !== doc.path) { problems.push(`${LABEL[k]}: falta verificarlo. Vuelve a subirlo.`); continue; }
    if (!sameExpect(v.expect, ex, k)) { problems.push(`${LABEL[k]}: cambiaste tus datos después de subirlo. Vuelve a subirlo.`); continue; }
    if (v.status !== 'ok' && v.status !== 'revisar') { problems.push(`${LABEL[k]}: ${v.msg || 'no pasó la verificación.'}`); continue; }
    if (v.status === 'revisar') alerts.push(`${LABEL[k]}: ${v.flag || v.msg}`);
  }
  return { problems, alerts };
}

/* ---- Texto ---- */

export function normText(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[ \t]+/g, ' ');
}
/** ¿Aparece el número? Tolera espacios, guiones o puntos entre dígitos y la O leída como 0. */
export function hasNumber(t, num) {
  if (!num) return false;
  const s = t.replace(/(\d)O|O(?=\d)/g, (m, d) => (d ? `${d}0` : '0')).replace(/(\d)[\s.-]+(?=\d)/g, '$1');
  return s.includes(num);
}
function foreignIds(t, mine) {
  const s = t.replace(/(\d)[\s.-]+(?=\d)/g, '$1');
  const out = [];
  for (const n of s.match(/\d{10,13}/g) || []) {
    const c = n.slice(0, 10);
    if (validCedula(c) && !mine.includes(c) && !out.includes(c)) out.push(c);
  }
  return out;
}
function foreignRucs(t, ruc) {
  const s = t.replace(/(\d)[\s.-]+(?=\d)/g, '$1');
  return (s.match(/\d{10}001/g) || []).filter((n) => n !== ruc && validRuc(n));
}
const words = (s) => normText(s).replace(/[^A-Z ]/g, ' ').split(' ').filter((w) => w.length >= 3 && !['DEL', 'LOS', 'LAS'].includes(w));
function hasWord(t, w) {
  return new RegExp(`(^|[^A-Z])${w}([^A-Z]|$)`).test(t.replace(/[^A-Z0-9]/g, ' ').replace(/ +/g, ' ')) || (t.replace(/[^A-Z]/g, '').includes(w) && w.length >= 6);
}
export function surnameFound(t, lastName) { const w = words(lastName); return w.length ? hasWord(t, w[0]) || (w[1] ? hasWord(t, w[1]) : false) : false; }
function nameFound(t, firstName) { const w = words(firstName); return w.length ? hasWord(t, w[0]) : false; }
function companyFound(t, businessName) {
  const w = words(businessName).filter((x) => !['CIA', 'LTDA', 'S.A', 'SAS', 'COMPANIA', 'EMPRESA'].includes(x));
  return w.length ? hasWord(t, w[0]) : false;
}

/* ---- Fechas ---- */

const MESES = { ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6, JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, SETIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12 };
function mkDate(y, m, d) {
  y = +y; m = +m; d = +d;
  if (y < 1950 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const x = new Date(y, m - 1, d);
  return x.getMonth() === m - 1 ? x : null;
}
function findDates(t) {
  const out = [];
  const push = (x) => { if (x) out.push(x); };
  t.replace(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/g, (m, d, mo, y) => push(mkDate(y, mo, d)));
  t.replace(/\b(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})\b/g, (m, y, mo, d) => push(mkDate(y, mo, d)));
  t.replace(/\b(\d{1,2})\s*(?:DE\s+)?([A-Z]{3,10})\.?\s*(?:DE|DEL|,)?\s*(\d{4})\b/g, (m, d, mes, y) => { if (MESES[mes]) push(mkDate(y, MESES[mes], d)); });
  return out;
}
function latestDate(t, today) {
  const lim = today.getTime() + 86_400_000;
  return findDates(t).filter((d) => d.getTime() <= lim).sort((a, b) => b - a)[0] || null;
}
function dateAfter(t, label) {
  const m = label.exec(t);
  if (!m) return null;
  return findDates(t.slice(m.index, m.index + 60))[0] || null;
}

/* ---- Cédula y RUC ---- */

export function validCedula(id) {
  if (!/^\d{10}$/.test(id)) return false;
  const prov = Number(id.slice(0, 2));
  if (!((prov >= 1 && prov <= 24) || prov === 30)) return false;
  if (Number(id[2]) >= 6) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) { let d = Number(id[i]) * (i % 2 === 0 ? 2 : 1); if (d > 9) d -= 9; sum += d; }
  return (10 - (sum % 10)) % 10 === Number(id[9]);
}
export function validRuc(r) {
  if (!/^\d{10}001$/.test(r)) return false;
  const t = Number(r[2]);
  return t < 6 ? validCedula(r.slice(0, 10)) : t === 6 || t === 9;
}
