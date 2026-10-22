/**
 * Registro de profesionales y empresas proveedoras (Google Apps Script).
 * Sirve la página (Index.html), escribe en Google Sheets y guarda los
 * documentos en Google Drive. La página no muestra ninguna marca.
 *
 * Cada profesional queda con:
 *  - una fila en la hoja "Profesionales" (y una por categoría en "Categorías"),
 *  - una carpeta "<Apellido Nombre> · <cédula> · <código>" dentro de CONFIG.FOLDER_ID
 *    con sus documentos, fotos de trabajos y datos.json (perfil con los mismos
 *    campos de Firestore providers/{uid}, listo para migrar),
 *  - su cuenta bancaria (obligatoria): una fila en "Banco (privado)" y banco.json.
 *
 * Instalación: ver LEEME.md. Resumen: crear Code.gs e Index.html en un
 * proyecto de Apps Script, revisar CONFIG, ejecutar setup() una vez e implementar como
 * Aplicación web (Ejecutar como: yo · Acceso: cualquier usuario).
 */

const CONFIG = {
  /** Google Sheet donde se escriben los registros. */
  SHEET_ID: '1C97wrHqgCq5yGUEmyYNHizLglkdnPiY6hKVZSqflR_I',
  /** Carpeta de Drive "RESPALDO DE PROVEEDORES": una subcarpeta por profesional con sus fotos y documentos. */
  FOLDER_ID: '1ZpZs19-_cT12vw-2oVLGt5yPfrlzQB0L',
  /** Responsable del tratamiento de datos que se nombra en la autorización (LOPDP). */
  CONTROLLER: 'Corporación Coffeeport Cía. Ltda.',
  /** Correo que ve el profesional para dudas o para pedir que borren sus datos (vacío = no se muestra). */
  CONTACT_EMAIL: '',
  /** A quién avisar de cada registro nuevo (vacío = la cuenta dueña del script). */
  NOTIFY_EMAIL: '',
  /** Correo de confirmación al profesional (sale desde la cuenta dueña del script). */
  CONFIRM_TO_APPLICANT: false,
  MAX_FILE_MB: 12,
};

/* Igual que packages/shared/src (categories.ts y provider.ts). */
const CATS = {climatizacion: { name: 'Climatización', suggested: 25 }, plomeria: { name: 'Plomería', suggested: 20 }, electricidad: { name: 'Electricidad', suggested: 20 }, electrodomesticos: { name: 'Electrodomésticos', suggested: 20 }, limpieza: { name: 'Limpieza', suggested: 25 }, jardineria: { name: 'Jardinería', suggested: 20 }, piscinas: { name: 'Piscinas', suggested: 20 }, pintura: { name: 'Pintura', suggested: 25 }, belleza: { name: 'Belleza', suggested: 15 }, mascotas: { name: 'Mascotas', suggested: 12 }, clases: { name: 'Clases', suggested: 12 }, salud: { name: 'Salud', suggested: 20 }, cerrajeria: { name: 'Cerrajería', suggested: 20 }, carpinteria: { name: 'Carpintería', suggested: 20 }, albanileria: { name: 'Albañilería', suggested: 25 }, fumigacion: { name: 'Fumigación', suggested: 30 }, mudanzas: { name: 'Mudanzas', suggested: 40 }, tecnologia: { name: 'Tecnología', suggested: 20 }};
const RATE_BAND = 0.25, MIN_RATE = 5;
const CITIES = { guayaquil: 'Guayaquil', samborondon: 'Samborondón', daule: 'Daule', duran: 'Durán', quito: 'Quito', cuenca: 'Cuenca' };
const TAX = ['general', 'rimpe_emprendedor', 'rimpe_popular', 'no_se'];
const DOC_KEYS = ['cedulaFrente', 'cedulaReverso', 'selfie', 'antecedentes', 'ruc', 'titulo'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];

/*
 * Estructura de la hoja: cada pestaña es una colección de Firestore y cada
 * columna se llama igual que el campo. Las columnas que empiezan con "_"
 * son de control (no se suben). Las listas y objetos van en JSON.
 *
 *  providers               → providers/{uid}            (una fila por profesional)
 *  providers.catStatus     → providers/{uid}.catStatus  (una fila por profesional y categoría; aquí se aprueba cada una)
 *  providers.private.banco → providers/{uid}/private/banco
 */
const TAB = { pro: 'providers', cat: 'providers.catStatus', bank: 'providers.private.banco' };
const HEADERS = {
  'providers': ['_codigo', '_fecha', '_seguimiento', '_duplicado', '_carpeta', '_whatsapp', '_notas', '_uid',
    'status', 'kind', 'firstName', 'lastName', 'businessName', 'cedula', 'ruc', 'phone', 'email', 'years', 'bio',
    'categories', 'services', 'visitRates', 'catEvidence', 'cities', 'days', 'from', 'to', 'acceptsCash',
    'offHours', 'holidays', 'surcharges', 'taxRegime', 'eSignature', 'docs', 'consentPrivacy', 'consentMarketing', 'preregistro'],
  'providers.catStatus': ['_codigo', '_nombre', 'category', 'catStatus', 'visitRate', 'services', 'evidenceKind', 'evidenceNote', 'evidenceReference', 'evidenceFiles', '_carpeta'],
  'providers.private.banco': ['_codigo', '_nombre', 'bank', 'type', 'number', 'holder', 'holderId'],
};
/** Columnas que deben quedar como texto (ceros a la izquierda). */
const TEXT_COLS = ['cedula', 'ruc', 'phone', 'number', 'holderId', 'from', 'to'];

/* ============================== Instalación ============================== */

/**
 * Ejecutar UNA vez desde el editor: conecta la hoja y la carpeta de CONFIG
 * y crea en la hoja las pestañas que falten (no borra nada de lo que ya tenga).
 */
function setup() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
  Object.keys(HEADERS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      // Si la hoja está recién creada y vacía, se usa su primera pestaña.
      const first = ss.getSheets()[0];
      sh = (ss.getSheets().length === 1 && first.getLastRow() === 0 && !ss.getSheetByName(HEADERS_FIRST)) ? first.setName(name) : ss.insertSheet(name);
    }
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]])
        .setFontWeight('bold').setBackground('#1F3A5F').setFontColor('#FFFFFF');
      sh.setFrozenRows(1);
    }
  });
  const list = vals => SpreadsheetApp.newDataValidation().requireValueInList(vals, true).build();
  const col = (name, h) => HEADERS[name].indexOf(h) + 1;
  const pro = ss.getSheetByName(TAB.pro), cat = ss.getSheetByName(TAB.cat);
  pro.getRange(2, col(TAB.pro, '_seguimiento'), pro.getMaxRows() - 1).setDataValidation(list(['nuevo', 'contactado', 'documentos pendientes', 'listo']));
  pro.getRange(2, col(TAB.pro, 'status'), pro.getMaxRows() - 1).setDataValidation(list(['en_revision', 'observado', 'aprobado', 'rechazado']));
  cat.getRange(2, col(TAB.cat, 'catStatus'), cat.getMaxRows() - 1).setDataValidation(list(['en_revision', 'observado', 'aprobado', 'rechazado']));
  Object.keys(HEADERS).forEach(name => HEADERS[name].forEach((h, i) => {
    if (TEXT_COLS.indexOf(h) >= 0) ss.getSheetByName(name).getRange(2, i + 1, ss.getSheetByName(name).getMaxRows() - 1).setNumberFormat('@');
  }));
  Logger.log('Listo.\nHoja: ' + ss.getUrl() + '\nCarpeta de archivos: ' + folder.getUrl());
}
const HEADERS_FIRST = TAB.pro;

/* ================================ Web app ================================ */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Registro de profesionales')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Datos que la página necesita al abrir. */
function config() {
  return { controller: CONFIG.CONTROLLER, contact: CONFIG.CONTACT_EMAIL, url: ScriptApp.getService().getUrl() };
}

/** Única entrada desde la página (google.script.run.api). */
function api(req) {
  try {
    req = req || {};
    if (req.hp) return { ok: true }; // trampa para robots
    if (req.action === 'archivo') return saveFile(req);
    if (req.action === 'profesional') return saveProvider(req);
    return { ok: false, error: 'Acción desconocida.' };
  } catch (err) {
    console.error(err);
    return { ok: false, error: err && err.userMessage ? err.userMessage : 'Error del servidor. Inténtalo otra vez.' };
  }
}

/* ================================ Archivos ================================ */

function saveFile(req) {
  checkId(req.id);
  if (!/^(doc_(cedulaFrente|cedulaReverso|selfie|antecedentes|ruc|titulo)|ev_[a-z]+_\d{1,2})$/.test(String(req.key))) fail('Archivo no reconocido.');
  if (MIMES.indexOf(req.mime) < 0) fail('Solo se aceptan fotos o PDF.');
  const bytes = Utilities.base64Decode(String(req.data || ''));
  if (!bytes.length) fail('El archivo llegó vacío.');
  if (bytes.length > CONFIG.MAX_FILE_MB * 1048576) fail('El archivo pesa más de ' + CONFIG.MAX_FILE_MB + ' MB.');
  const folder = providerFolder(req.id);
  // Si lo vuelve a subir, reemplaza el anterior.
  const it = folder.searchFiles('title contains "' + req.key + '."');
  while (it.hasNext()) { const f = it.next(); if (f.getName().indexOf(req.key + '.') === 0) f.setTrashed(true); }
  const ext = req.mime === 'application/pdf' ? 'pdf' : (req.mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const file = folder.createFile(Utilities.newBlob(bytes, req.mime, req.key + '.' + ext));
  file.setDescription('Original: ' + String(req.name || '').slice(0, 120));
  return { ok: true, fileId: file.getId() };
}

function providerFolder(id) {
  const parent = DriveApp.getFolderById(CONFIG.FOLDER_ID);
  const it = parent.searchFolders('title contains "' + id + '"');
  if (it.hasNext()) return it.next();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const again = parent.searchFolders('title contains "' + id + '"');
    return again.hasNext() ? again.next() : parent.createFolder(id);
  } finally { lock.releaseLock(); }
}

/* ============================== Profesionales ============================== */

function saveProvider(req) {
  checkId(req.id);
  const d = req.data || {};
  const v = validateProvider(d) || validateBank(req.bank, d);
  if (v) fail(v);

  const folder = providerFolder(req.id);
  const files = {};
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    const m = /^(doc_\w+|ev_[a-z]+_\d+)\./.exec(f.getName());
    if (m && !f.isTrashed()) files[m[1]] = { driveId: f.getId(), name: f.getName(), url: f.getUrl() };
  }

  // Documentos obligatorios (igual que requiredDocs() de la app).
  const required = ['cedulaFrente', 'cedulaReverso', 'selfie', 'antecedentes'];
  if (!d.rucPending) required.push('ruc');
  if (d.categories.indexOf('salud') >= 0) required.push('titulo');
  const missingDocs = required.filter(k => !files['doc_' + k]);
  if (missingDocs.length) fail('Faltan documentos: ' + missingDocs.join(', ') + '. Vuelve a subirlos.');

  const fullName = (d.lastName + ' ' + d.firstName).trim();
  folder.setName(fullName + ' · ' + d.cedula + ' · ' + req.id);

  // Perfil con los campos de Firestore providers/{uid} (ver ProviderSignup.tsx).
  const docs = {};
  DOC_KEYS.forEach(k => { if (files['doc_' + k]) docs[k] = { driveId: files['doc_' + k].driveId, name: files['doc_' + k].name }; });
  const catEvidence = {}, services = {}, visitRates = {}, catStatus = {};
  d.categories.forEach(s => {
    const ev = d.catEvidence[s];
    const evFiles = Object.keys(files).filter(k => k.indexOf('ev_' + s + '_') === 0).sort().map(k => files[k].driveId);
    catEvidence[s] = { kind: ev.kind, note: String(ev.note).trim(), files: evFiles };
    if (ev.kind === 'experiencia') catEvidence[s].reference = String(ev.reference || '').trim();
    const extra = String((d.otherServices || {})[s] || '').split(',').map(x => x.trim()).filter(Boolean);
    services[s] = (d.services[s] || []).concat(extra);
    visitRates[s] = Math.round(Number(d.visitRates[s]));
    catStatus[s] = 'en_revision';
  });
  const surcharges = {};
  if (d.offHours.length) surcharges.nocturno = num(d.surcharges.nocturno);
  if (d.holidays) surcharges.feriado = num(d.surcharges.feriado);
  const profile = {
    kind: d.kind, firstName: d.firstName.trim(), lastName: d.lastName.trim(), businessName: (d.businessName || '').trim(),
    cedula: d.cedula, ruc: d.ruc || '', phone: d.phone, email: d.email,
    categories: d.categories, services: services, visitRates: visitRates, catEvidence: catEvidence, catStatus: catStatus,
    years: num(d.years), bio: d.bio.trim(),
    cities: d.cities, days: d.days.map(Number).sort(), from: d.from, to: d.to, acceptsCash: !!d.acceptsCash,
    offHours: d.offHours.map(Number), holidays: !!d.holidays, surcharges: surcharges,
    docs: docs, eSignature: !!d.eSignature,
    status: 'en_revision',
    consentPrivacy: true, consentMarketing: !!d.consentMarketing,
    // Solo de este registro (no existen en Firestore; útiles para la migración).
    preregistro: {
      id: req.id, createdAt: new Date().toISOString(), consentVersion: String(req.consentVersion || ''),
      rucPending: !!d.rucPending, taxRegimeAnswer: d.taxRegime, zones: d.zones || [],
      referredBy: String(d.referredBy || '').slice(0, 80), heardFrom: String(d.heardFrom || '').slice(0, 40),
    },
  };
  if (['general', 'rimpe_emprendedor', 'rimpe_popular'].indexOf(d.taxRegime) >= 0) profile.taxRegime = d.taxRegime;

  writeJson(folder, 'datos.json', profile);
  {
    const b = req.bank;
    writeJson(folder, 'banco.json', { bank: b.bank, type: b.type === 'corriente' ? 'corriente' : 'ahorros', number: String(b.number), holder: String(b.holder).trim(), holderId: String(b.holderId) });
  }

  const now = new Date();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let duplicate = '';
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sh = ss.getSheetByName(TAB.pro);
    // Si reintenta el envío con el mismo código, se reemplaza lo anterior.
    [TAB.pro, TAB.cat, TAB.bank].forEach(n => removeRows(ss.getSheetByName(n), req.id));
    duplicate = findDuplicate(sh, d.cedula, d.phone, req.id);
    const { catStatus: _omit, ...fields } = profile;
    appendObj(sh, Object.assign({}, fields, {
      _codigo: req.id, _fecha: now, _seguimiento: 'nuevo', _duplicado: duplicate, _carpeta: folder.getUrl(),
      _whatsapp: 'https://wa.me/593' + d.phone.slice(1),
    }));
    const cs = ss.getSheetByName(TAB.cat);
    d.categories.forEach(s => {
      const ev = catEvidence[s];
      appendObj(cs, { _codigo: req.id, _nombre: fullName, category: s, catStatus: 'en_revision', visitRate: visitRates[s],
        services: services[s], evidenceKind: ev.kind, evidenceNote: ev.note, evidenceReference: ev.reference || '', evidenceFiles: ev.files, _carpeta: folder.getUrl() });
    });
    const b = req.bank;
    appendObj(ss.getSheetByName(TAB.bank), { _codigo: req.id, _nombre: fullName, bank: b.bank, type: b.type === 'corriente' ? 'corriente' : 'ahorros',
      number: String(b.number), holder: String(b.holder).trim(), holderId: String(b.holderId) });
  } finally { lock.releaseLock(); }

  notifyOwner(req.id, profile, folder.getUrl(), duplicate);
  if (CONFIG.CONFIRM_TO_APPLICANT) confirmApplicant(req.id, profile);
  return { ok: true, id: req.id };
}

function validateProvider(d) {
  if (['persona', 'empresa'].indexOf(d.kind) < 0) return 'Tipo de registro inválido.';
  if (d.kind === 'empresa' && String(d.businessName || '').trim().length < 3) return 'Falta la razón social.';
  if (String(d.firstName || '').trim().length < 2 || String(d.lastName || '').trim().length < 2) return 'Faltan nombres y apellidos.';
  if (!validCedula(String(d.cedula))) return 'La cédula no es válida.';
  if (!d.rucPending && !validRuc(String(d.ruc))) return 'El RUC no es válido.';
  if (!/^09\d{8}$/.test(String(d.phone))) return 'El celular no es válido.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(d.email))) return 'El correo no es válido.';
  if (String(d.bio || '').trim().length < 20) return 'Falta la presentación.';
  if (!Array.isArray(d.categories) || !d.categories.length) return 'Elige al menos una categoría.';
  for (let i = 0; i < d.categories.length; i++) {
    const s = d.categories[i];
    if (!CATS[s]) return 'Categoría no reconocida.';
    const r = rateRange(s), rate = Number((d.visitRates || {})[s]);
    if (!(rate >= r.min && rate <= r.max)) return CATS[s].name + ': la tarifa debe estar entre $' + r.min + ' y $' + r.max + '.';
    const ev = (d.catEvidence || {})[s] || {};
    if (['certificado', 'experiencia'].indexOf(ev.kind) < 0) return CATS[s].name + ': falta la validación.';
    if (s === 'salud' && ev.kind !== 'certificado') return 'Salud exige título registrado en la SENESCYT.';
  }
  if (!Array.isArray(d.cities) || !d.cities.length || d.cities.some(c => !CITIES[c])) return 'Elige al menos una ciudad.';
  if (!Array.isArray(d.days) || !d.days.length) return 'Elige al menos un día.';
  if (!/^\d\d:00$/.test(d.from) || !/^\d\d:00$/.test(d.to) || d.from >= d.to) return 'Revisa tu horario.';
  if (!Array.isArray(d.offHours) || d.offHours.some(h => !((h >= 0 && h <= 7) || (h >= 18 && h <= 23)))) return 'Horas fuera de horario inválidas.';
  if (TAX.indexOf(d.taxRegime) < 0) return 'Elige tu régimen en el SRI.';
  if (!d.consentPrivacy || !d.consentTruth) return 'Faltan las autorizaciones.';
  return '';
}

/** La cuenta bancaria es obligatoria y debe estar a nombre del profesional o de su empresa. */
function validateBank(b, d) {
  if (!b || !b.bank) return 'Falta la cuenta bancaria.';
  if (!/^\d{5,20}$/.test(String(b.number))) return 'El número de cuenta no es válido.';
  if (String(b.holder || '').trim().length < 3) return 'Falta el titular de la cuenta.';
  const id = String(b.holderId);
  if (!(validCedula(id) || validRuc(id))) return 'La cédula o RUC del titular no es válida.';
  if (id !== d.cedula && id !== d.ruc) return 'La cuenta debe estar a nombre del profesional o de su empresa.';
  return '';
}

function findDuplicate(sh, cedula, phone, id) {
  const rows = readObjs(sh);
  const hits = rows.filter(r => r._codigo !== id && (String(r.cedula) === cedula || String(r.phone) === phone)).map(r => r._codigo);
  return hits.length ? hits.join(', ') : '';
}

function removeRows(sh, id) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return;
  const ids = sh.getRange(2, 1, n, 1).getValues(); // columna A = _codigo
  for (let i = ids.length - 1; i >= 0; i--) if (ids[i][0] === id) sh.deleteRow(i + 2);
}

/** Agrega una fila poniendo cada valor bajo la columna de su mismo nombre. */
function appendObj(sh, obj) {
  const head = HEADERS[sh.getName()];
  sh.appendRow(head.map(h => toCell(obj[h], h)));
}
function toCell(v, h) {
  if (v === undefined || v === null) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') return JSON.stringify(v);
  if (TEXT_COLS.indexOf(h) >= 0) return "'" + v;
  // Evita que un texto que empieza con = + - @ se tome como fórmula.
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

/** Lee una pestaña como lista de objetos {columna: valor}. */
function readObjs(sh) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const head = HEADERS[sh.getName()];
  return sh.getRange(2, 1, n, head.length).getValues().map(r => {
    const o = {};
    head.forEach((h, i) => { o[h] = r[i]; });
    return o;
  });
}

/* ========================== Exportar para Firebase ========================== */

/**
 * Ejecutar desde el editor cuando toque subir a Firebase. Junta las tres
 * pestañas (con lo que hayas aprobado o corregido en la hoja) y deja en la
 * carpeta el archivo firestore-providers.json:
 *   [{ codigo, provider: {…providers/{uid}}, banco: {…private/banco}, carpeta }]
 * Los archivos de docs y catEvidence van con su id de Drive; el script de
 * importación los sube a Storage y crea la cuenta (uid) de cada profesional.
 */
function exportarFirestore() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const parse = (v, h) => {
    if (v === '' || v === null) return undefined;
    if (['categories', 'services', 'visitRates', 'catEvidence', 'cities', 'days', 'offHours', 'surcharges', 'docs', 'preregistro', 'evidenceFiles'].indexOf(h) >= 0) {
      return typeof v === 'string' ? JSON.parse(v) : v;
    }
    if (TEXT_COLS.indexOf(h) >= 0) return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm') : String(v);
    return v;
  };
  const cats = readObjs(ss.getSheetByName(TAB.cat));
  const banks = readObjs(ss.getSheetByName(TAB.bank));
  const out = readObjs(ss.getSheetByName(TAB.pro)).filter(r => r._codigo).map(r => {
    const provider = {};
    Object.keys(r).forEach(h => { if (h[0] !== '_') { const v = parse(r[h], h); if (v !== undefined) provider[h] = v; } });
    provider.catStatus = {};
    cats.filter(c => c._codigo === r._codigo).forEach(c => { provider.catStatus[c.category] = c.catStatus || 'en_revision'; });
    const b = banks.find(x => x._codigo === r._codigo);
    const banco = b ? { bank: b.bank, type: b.type, number: String(b.number), holder: b.holder, holderId: String(b.holderId) } : null;
    return { codigo: r._codigo, uid: r._uid || '', provider: provider, banco: banco, carpeta: r._carpeta };
  });
  const folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
  writeJson(folder, 'firestore-providers.json', out);
  Logger.log(out.length + ' profesionales exportados a firestore-providers.json en ' + folder.getUrl());
}

/* ================================ Correos ================================ */

function notifyOwner(id, p, folderUrl, duplicate) {
  const to = CONFIG.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
  if (!to) return;
  const cats = p.categories.map(s => CATS[s].name + ' $' + p.visitRates[s]).join(', ');
  try {
    MailApp.sendEmail({
      to: to,
      subject: 'Registro · Nuevo profesional: ' + p.firstName + ' ' + p.lastName + ' (' + p.categories.map(s => CATS[s].name).join(', ') + ')',
      htmlBody: '<p><b>' + esc(p.firstName + ' ' + p.lastName) + '</b> · ' + id + '</p>' +
        '<p>' + esc(cats) + '<br>' + esc(p.cities.map(c => CITIES[c]).join(', ')) + '<br>Cel. ' + p.phone + ' · ' + esc(p.email) + '</p>' +
        (duplicate ? '<p style="color:#B42318"><b>Posible duplicado:</b> ' + esc(duplicate) + '</p>' : '') +
        '<p><a href="' + folderUrl + '">Abrir carpeta</a> · <a href="https://wa.me/593' + p.phone.slice(1) + '">WhatsApp</a></p>',
    });
  } catch (e) { console.error('Aviso de registro', e); }
}

function confirmApplicant(id, p) {
  try {
    MailApp.sendEmail({
      to: p.email,
      subject: 'Recibimos tu registro (' + id + ')',
      htmlBody: '<div style="font-family:Arial,sans-serif;color:#16191D;max-width:520px">' +
        '<p>Hola ' + esc(p.firstName.split(' ')[0]) + ',</p>' +
        '<p>Recibimos tu registro como profesional. Tu código es <b>' + id + '</b>.</p>' +
        '<p>Vamos a revisar tus datos y documentos y te escribiremos por WhatsApp.</p>' +
        '<p>Si necesitas corregir algo, responde a este correo con tu código.</p></div>',
    });
  } catch (e) { console.error('Confirmación', e); }
}

/* ================================ Utilidades ================================ */

function validCedula(id) {
  if (!/^\d{10}$/.test(id)) return false;
  const prov = Number(id.slice(0, 2));
  if (!((prov >= 1 && prov <= 24) || prov === 30)) return false;
  if (Number(id[2]) >= 6) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) { let d = Number(id[i]) * (i % 2 === 0 ? 2 : 1); if (d > 9) d -= 9; sum += d; }
  return (10 - (sum % 10)) % 10 === Number(id[9]);
}
function validRuc(r) {
  if (!/^\d{10}001$/.test(r)) return false;
  const t = Number(r[2]);
  return t < 6 ? validCedula(r.slice(0, 10)) : (t === 6 || t === 9);
}
function rateRange(slug) {
  const s = CATS[slug].suggested;
  return { min: Math.max(MIN_RATE, Math.floor(s * (1 - RATE_BAND))), max: Math.ceil(s * (1 + RATE_BAND)) };
}
function num(x) { const n = Number(x); return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; }
function checkId(id) { if (!/^RP-[A-Z0-9]{8}$/.test(String(id))) fail('Código de registro inválido.'); }
function writeJson(folder, name, obj) {
  const old = folder.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true);
  folder.createFile(name, JSON.stringify(obj, null, 2), 'application/json');
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function fail(msg) { const e = new Error(msg); e.userMessage = msg; throw e; }
