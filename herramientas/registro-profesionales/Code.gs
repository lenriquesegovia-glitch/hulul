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
  /** Verificar documentos y rostro antes de dejar continuar (requiere activar el servicio Drive API). */
  VERIFY: true,
  /**
   * Distancia entre rostros (0 = idénticos). Hasta FACE_OK coincide; hasta FACE_REJECT pasa
   * con revisión manual; más, se rechaza. En pruebas, personas distintas pero parecidas dieron
   * 0,48–0,52: no subir FACE_REJECT por encima de 0,5.
   */
  FACE_OK: 0.42,
  FACE_REJECT: 0.5,
  /** Antigüedad máxima del certificado de antecedentes penales (días). */
  ANTECEDENTES_MAX_DAYS: 90,
  /** Consultar el RUC en el SRI (si el SRI no responde, se usa solo el certificado). */
  SRI_CHECK: true,
};

const DOC_LABEL = { cedulaFrente: 'Cédula (frente)', cedulaReverso: 'Cédula (reverso)', selfie: 'Selfie', antecedentes: 'Certificado de antecedentes', ruc: 'Certificado del RUC', titulo: 'Título' };

/* Igual que packages/shared/src (categories.ts y provider.ts). */
const CATS = {climatizacion: { name: 'Climatización', suggested: 25 }, plomeria: { name: 'Plomería', suggested: 20 }, electricidad: { name: 'Electricidad', suggested: 20 }, electrodomesticos: { name: 'Electrodomésticos', suggested: 20 }, limpieza: { name: 'Limpieza', suggested: 25 }, jardineria: { name: 'Jardinería', suggested: 20 }, piscinas: { name: 'Piscinas', suggested: 20 }, pintura: { name: 'Pintura', suggested: 25 }, belleza: { name: 'Belleza', suggested: 15 }, mascotas: { name: 'Mascotas', suggested: 12 }, clases: { name: 'Clases', suggested: 12 }, salud: { name: 'Salud', suggested: 20 }, cerrajeria: { name: 'Cerrajería', suggested: 20 }, carpinteria: { name: 'Carpintería', suggested: 20 }, albanileria: { name: 'Albañilería', suggested: 25 }, fumigacion: { name: 'Fumigación', suggested: 30 }, mudanzas: { name: 'Mudanzas', suggested: 40 }, tecnologia: { name: 'Tecnología', suggested: 20 }};
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
    'offHours', 'holidays', 'surcharges', 'taxRegime', 'eSignature', 'docs', 'consentPrivacy', 'consentMarketing', 'preregistro', '_alertas', '_verificacion'],
  'providers.catStatus': ['_codigo', '_nombre', 'category', 'catStatus', 'visitRate', 'services', 'evidenceKind', 'evidenceNote', 'evidenceReference', 'evidenceFiles', '_carpeta', '_categoria'],
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
  if (CONFIG.VERIFY && typeof Drive === 'undefined') {
    Logger.log('ATENCIÓN: falta activar el servicio "Drive API" (menú izquierdo → Servicios → + → Drive API → Agregar). Sin eso, nadie podrá pasar la verificación de documentos.');
  }
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
  return { controller: CONFIG.CONTROLLER, contact: CONFIG.CONTACT_EMAIL, url: ScriptApp.getService().getUrl(),
    verify: CONFIG.VERIFY, face: { ok: CONFIG.FACE_OK, reject: CONFIG.FACE_REJECT } };
}

/** Única entrada desde la página (google.script.run.api). */
function api(req) {
  try {
    req = req || {};
    if (req.hp) return { ok: true }; // trampa para robots
    if (req.action === 'archivo') return saveFile(req);
    if (req.action === 'profesional') return saveProvider(req);
    if (req.action === 'preverificar') return preVerify(req);
    return { ok: false, error: 'Acción desconocida.' };
  } catch (err) {
    console.error(err);
    return { ok: false, error: err && err.userMessage ? err.userMessage : 'Error del servidor (' + (err && err.message ? err.message : err) + '). Inténtalo otra vez.' };
  }
}

/* ================================ Archivos ================================ */

function saveFile(req) {
  checkId(req.id);
  if (!/^(doc_(cedulaFrente|cedulaReverso|selfie|antecedentes|ruc|titulo)|ev_[a-z]+(-\d{1,2})?_\d{1,2})$/.test(String(req.key))) fail('Archivo no reconocido.');
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
  const meta = { original: String(req.name || '').slice(0, 120) };
  file.setDescription(JSON.stringify(meta));
  if (/^doc_/.test(req.key)) {
    // Se verifica en el momento: el resultado vuelve a la página y queda guardado en el archivo.
    meta.expect = cleanExpect(req.expect);
    meta.verify = verifyDoc(req.key, file, meta.expect, req.face);
    file.setDescription(JSON.stringify(meta).slice(0, 4000));
    return { ok: true, fileId: file.getId(), verify: { status: meta.verify.status, msg: meta.verify.msg } };
  }
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
    const m = /^(doc_\w+|ev_[a-z]+(?:-\d+)?_\d+)\./.exec(f.getName());
    if (m && !f.isTrashed()) files[m[1]] = { driveId: f.getId(), name: f.getName(), url: f.getUrl() };
  }

  // Documentos obligatorios (igual que requiredDocs() de la app).
  const required = ['cedulaFrente', 'cedulaReverso', 'selfie', 'antecedentes'];
  if (!d.rucPending) required.push('ruc');
  if (d.categories.indexOf('salud') >= 0) required.push('titulo');
  const missingDocs = required.filter(k => !files['doc_' + k]);
  if (missingDocs.length) fail('Faltan documentos: ' + missingDocs.map(k => DOC_LABEL[k]).join(', ') + '. Vuelve a subirlos.');

  // Todos los documentos deben haber pasado la verificación, con los datos que envía ahora.
  const verificacion = {}, alertas = [];
  if (CONFIG.VERIFY) {
    const toCheck = required.concat(files.doc_titulo && required.indexOf('titulo') < 0 ? ['titulo'] : []);
    toCheck.forEach(k => {
      const meta = fileMeta(files['doc_' + k].driveId), v = meta.verify, ex = meta.expect || {};
      if (!v) fail(DOC_LABEL[k] + ': falta verificarlo. Vuelve a subirlo.');
      if (v.status !== 'ok' && v.status !== 'revisar') fail(DOC_LABEL[k] + ': ' + (v.msg || 'no pasó la verificación.') + (k === 'selfie' ? ' Vuelve a tomar la selfie.' : ' Vuelve a subirlo.'));
      if (String(ex.cedula) !== String(d.cedula) || normText(ex.lastName) !== normText(d.lastName) || (k === 'ruc' && String(ex.ruc) !== String(d.ruc))) {
        fail(DOC_LABEL[k] + ': cambiaste tus datos después de subirlo. Vuelve a subirlo.');
      }
      verificacion[k] = { status: v.status, checks: v.checks };
      if (v.status === 'revisar') alertas.push(DOC_LABEL[k] + ': ' + (v.flag || v.msg));
    });
  }

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
    visitRates[s] = Math.round(Number(d.visitRates[s]) * 100) / 100;
    catStatus[s] = 'en_revision';
  });
  const customNames = {};
  d.categories.forEach(s => { if (!CATS[s]) customNames[s] = String(d.customNames[s]).trim().slice(0, 60); });
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
      // Categorías nuevas que propuso el profesional (otra-1 → nombre). Al migrar se asignan a una categoría de la app.
      customNames: customNames,
      // Firma electrónica: solo quién la emitió y cuándo caduca (AAAA-MM). El archivo y la clave nunca se piden aquí.
      eSignatureIssuer: d.eSignature ? String(d.eSignatureIssuer || '').slice(0, 40) : '',
      eSignatureExpires: d.eSignature && /^\d{4}-\d{2}$/.test(String(d.eSignatureExpires)) ? String(d.eSignatureExpires) : '',
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
    ensureTabs(ss);
    const sh = ss.getSheetByName(TAB.pro);
    // Si reintenta el envío con el mismo código, se reemplaza lo anterior.
    [TAB.pro, TAB.cat, TAB.bank].forEach(n => removeRows(ss.getSheetByName(n), req.id));
    if (readObjs(sh).some(r => String(r.cedula) === String(d.cedula) && r._codigo !== req.id)) {
      fail('Ya existe un registro con esta cédula. Si necesitas corregir tus datos, comunícate con nosotros.');
    }
    duplicate = findDuplicate(sh, d.cedula, d.phone, req.id);
    if (duplicate) alertas.push('Mismo celular que ' + duplicate);
    const { catStatus: _omit, ...fields } = profile;
    appendObj(sh, Object.assign({}, fields, {
      _codigo: req.id, _fecha: now, _seguimiento: 'nuevo', _duplicado: duplicate, _carpeta: folder.getUrl(),
      _whatsapp: 'https://wa.me/593' + d.phone.slice(1),
      _alertas: alertas.join(' · '), _verificacion: verificacion,
    }));
    const cs = ss.getSheetByName(TAB.cat);
    d.categories.forEach(s => {
      const ev = catEvidence[s];
      appendObj(cs, { _codigo: req.id, _nombre: fullName, category: s, catStatus: 'en_revision', visitRate: visitRates[s],
        services: services[s], evidenceKind: ev.kind, evidenceNote: ev.note, evidenceReference: ev.reference || '', evidenceFiles: ev.files, _carpeta: folder.getUrl(), _categoria: catName(s, d) });
    });
    const b = req.bank;
    appendObj(ss.getSheetByName(TAB.bank), { _codigo: req.id, _nombre: fullName, bank: b.bank, type: b.type === 'corriente' ? 'corriente' : 'ahorros',
      number: String(b.number), holder: String(b.holder).trim(), holderId: String(b.holderId) });
  } finally { lock.releaseLock(); }

  notifyOwner(req.id, profile, folder.getUrl(), alertas.join(' · '));
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
    if (!CATS[s] && !(/^otra-\d{1,2}$/.test(s) && String((d.customNames || {})[s] || '').trim().length >= 3)) return 'Categoría no reconocida.';
    if (!CATS[s] && !String((d.otherServices || {})[s] || '').trim()) return catName(s, d) + ': faltan las subcategorías.';
    const rate = Number((d.visitRates || {})[s]);
    if (!(rate > 0)) return catName(s, d) + ': falta la tarifa por visita.';
    const ev = (d.catEvidence || {})[s] || {};
    if (['certificado', 'experiencia'].indexOf(ev.kind) < 0) return catName(s, d) + ': falta la validación.';
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

/**
 * Crea las pestañas que falten con su encabezado (por si no se ejecutó
 * setup() o se cambió el nombre de una pestaña).
 */
function ensureTabs(ss) {
  Object.keys(HEADERS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    } else if (sh.getLastColumn() < HEADERS[name].length) {
      // Columnas nuevas: se agregan al final del encabezado.
      const from = sh.getLastColumn();
      sh.getRange(1, from + 1, 1, HEADERS[name].length - from).setValues([HEADERS[name].slice(from)]).setFontWeight('bold');
    }
  });
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

function notifyOwner(id, p, folderUrl, alerts) {
  const to = CONFIG.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
  if (!to) return;
  const cats = p.categories.map(s => catName(s, p.preregistro) + ' $' + p.visitRates[s]).join(', ');
  try {
    MailApp.sendEmail({
      to: to,
      subject: 'Registro · Nuevo profesional: ' + p.firstName + ' ' + p.lastName + ' (' + p.categories.map(s => catName(s, p.preregistro)).join(', ') + ')',
      htmlBody: '<p><b>' + esc(p.firstName + ' ' + p.lastName) + '</b> · ' + id + '</p>' +
        '<p>' + esc(cats) + '<br>' + esc(p.cities.map(c => CITIES[c]).join(', ')) + '<br>Cel. ' + p.phone + ' · ' + esc(p.email) + '</p>' +
        (alerts ? '<p style="color:#B42318"><b>Revisar:</b> ' + esc(alerts) + '</p>' : '<p style="color:#1F7A4A">Documentos y rostro verificados.</p>') +
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

/* ============================== Verificación ============================== */
/*
 * Cada documento se verifica apenas se sube (antes de dejar continuar):
 *  - Se lee el texto del archivo con el OCR de Google Drive (servicio avanzado
 *    "Drive API", hay que activarlo en el editor: Servicios → Drive API).
 *  - Se comprueba que el documento sea el que dice ser y que sea de esta
 *    persona (número de cédula / RUC, apellido, fechas).
 *  - La selfie la compara el navegador contra la foto de la cédula (rostro y
 *    prueba de vida); aquí se aplican los mismos umbrales.
 * Resultado: ok · revisar (pasa, pero queda marcado para revisión manual) ·
 * rechazado (no deja continuar) · error (no se pudo verificar: no deja continuar).
 * Al enviar el registro, el servidor vuelve a exigir que todo esté ok o revisar.
 */

function verifyDoc(key, file, ex, face) {
  if (!CONFIG.VERIFY) return { status: 'ok', msg: '', checks: { verificacion: 'desactivada' } };
  ex = ex || {};
  const k = key.replace(/^doc_/, '');
  if (k === 'selfie') return verifySelfie(face);
  const text = ocrText(file); // si falla, lanza el error y no deja continuar
  const t = normText(text);
  const r = { status: 'ok', msg: '', checks: { chars: t.length } };
  const set = (status, msg) => { r.status = status; r.msg = msg; return r; };
  if (t.length < 15) return set('rechazado', 'No pudimos leer nada en el archivo. ' + TIP[k]);

  const ced = String(ex.cedula || ''), ruc = String(ex.ruc || '');
  const others = foreignIds(t, [ced, ruc.slice(0, 10)]);
  const sur = surnameFound(t, ex.lastName), name = nameFound(t, ex.firstName);
  r.checks.apellido = sur; r.checks.nombre = name;

  if (k === 'cedulaFrente' || k === 'cedulaReverso') {
    const numOk = hasNumber(t, ced);
    const isId = /ECUADOR|IDENTIDAD|CEDULA|CIUDADANIA|REGISTRO CIVIL|NUI|IDECU|I<ECU/.test(t);
    const back = /PADRE|MADRE|INSTRUCCION|PROFESION|OCUPACION|DACTILAR|EXPEDICION|IDECU|I<ECU|<<</.test(t);
    r.checks.numero = numOk; r.checks.esCedula = isId;
    const exp = dateAfter(t, /EXPIRACION|VENCIMIENTO|CADUCIDAD|EXPIRA/);
    if (exp) {
      r.checks.caduca = iso(exp);
      if (exp < today()) return set('rechazado', 'Tu cédula está caducada (venció el ' + human(exp) + '). Necesitamos una cédula vigente.');
    }
    if (others.length && !numOk) return set('rechazado', 'La cédula de la foto no es la tuya (tiene otro número). Sube la foto de tu propia cédula.');
    if (k === 'cedulaFrente') {
      if (numOk && sur) return r;
      if (numOk || (sur && isId)) return set('revisar', 'Leímos solo parte de tus datos; lo revisaremos a mano.');
      return set('rechazado', 'En la foto no se lee tu número de cédula ni tu apellido. ' + TIP[k]);
    }
    // Reverso: debe verse como el reverso de una cédula.
    if (!back && !isId) return set('rechazado', 'Esta foto no parece el reverso de una cédula. ' + TIP[k]);
    if (!back) return set('revisar', 'No pudimos confirmar que sea el reverso; lo revisaremos a mano.');
    return r;
  }

  if (k === 'antecedentes') {
    const isCert = /ANTECEDENTES/.test(t);
    const numOk = hasNumber(t, ced);
    r.checks.numero = numOk; r.checks.esCertificado = isCert;
    if (!isCert) return set('rechazado', 'Este archivo no es un certificado de antecedentes penales. ' + TIP[k]);
    if (!numOk) {
      if (others.length) return set('rechazado', 'El certificado es de otra persona (tiene otro número de cédula).');
      return set('rechazado', 'No encontramos tu número de cédula en el certificado. ' + TIP[k]);
    }
    const issued = latestDate(t);
    if (issued) {
      r.checks.emitido = iso(issued);
      const days = Math.floor((today() - issued) / 86400000);
      if (days > CONFIG.ANTECEDENTES_MAX_DAYS) {
        return set('rechazado', 'Tu certificado es del ' + human(issued) + ' y tiene más de ' + Math.round(CONFIG.ANTECEDENTES_MAX_DAYS / 30) + ' meses. Descarga uno nuevo (es gratis).');
      }
    }
    const clean = /NO\s+(SE\s+)?REGISTRA|NO\s+TIENE\s+ANTECEDENTES|NO\s+POSEE\s+ANTECEDENTES/.test(t);
    const record = !clean && /(SI|SÍ)\s+REGISTRA|REGISTRA\s+ANTECEDENTES|POSEE\s+ANTECEDENTES/.test(t);
    r.checks.registra = record ? 'si' : clean ? 'no' : 'no se pudo leer';
    if (record) { r.flag = 'Registra antecedentes'; return set('revisar', 'Recibido. Lo revisaremos a mano.'); }
    if (!issued) return set('revisar', 'No pudimos leer la fecha del certificado; lo revisaremos a mano.');
    if (!clean) return set('revisar', 'Recibido. Lo revisaremos a mano.');
    return r;
  }

  if (k === 'ruc') {
    const isRuc = /CONTRIBUYENTE|REGISTRO UNICO|RENTAS INTERNAS|\bRUC\b|\bSRI\b/.test(t);
    const numOk = hasNumber(t, ruc);
    r.checks.numero = numOk; r.checks.esRuc = isRuc;
    if (!isRuc) return set('rechazado', 'Este archivo no es un certificado del RUC. ' + TIP[k]);
    if (!numOk) {
      if (foreignRucs(t, ruc).length) return set('rechazado', 'El certificado es de otro RUC. Sube el certificado de tu RUC.');
      return set('rechazado', 'No encontramos tu número de RUC en el certificado. ' + TIP[k]);
    }
    const holderOk = ex.kind === 'empresa' ? companyFound(t, ex.businessName) : sur;
    r.checks.titular = holderOk;
    const sri = CONFIG.SRI_CHECK ? sriLookup(ruc) : { checked: false };
    r.checks.sri = sri;
    if (sri.checked && !sri.exists) return set('rechazado', 'Ese RUC no existe en el SRI. Revisa el número.');
    if (sri.checked && sri.exists) {
      if (!/ACTIV/.test(normText(sri.state))) return set('rechazado', 'Tu RUC está ' + String(sri.state || 'inactivo').toLowerCase() + ' en el SRI. Actívalo para poder facturar y vuelve a intentarlo.');
      const sriName = normText(sri.name);
      const sriOk = ex.kind === 'empresa' ? companyFound(sriName, ex.businessName) : surnameFound(sriName, ex.lastName);
      r.checks.sriTitular = sriOk;
      if (!sriOk) return set('rechazado', 'Según el SRI, ese RUC está a nombre de otra persona.');
    } else if (/SUSPENDID|PASIVO|CANCELAD|CERRAD/.test(t) && !/ACTIVO/.test(t)) {
      return set('revisar', 'Tu RUC podría no estar activo; lo revisaremos a mano.');
    }
    if (!holderOk) return set('revisar', 'No encontramos tu nombre en el certificado; lo revisaremos a mano.');
    return r;
  }

  if (k === 'titulo') {
    if (!sur) return set('revisar', 'No encontramos tu nombre en el título; lo revisaremos a mano.');
    return r;
  }
  return r;
}

const TIP = {
  cedulaFrente: 'Toma la foto de cerca, con buena luz, sin reflejos y que se vea la cédula completa.',
  cedulaReverso: 'Toma la foto de cerca, con buena luz, sin reflejos y que se vea la cédula completa.',
  antecedentes: 'Sube el PDF original que descargaste del Ministerio del Interior (no una foto de la pantalla).',
  ruc: 'Sube el PDF del certificado del RUC que descargas en SRI en línea.',
  titulo: '',
};

/** Selfie: la comparación de rostros la hace el navegador; aquí se aplican los umbrales. */
function verifySelfie(face) {
  if (!CONFIG.VERIFY) return { status: 'ok', msg: '', checks: {} };
  const f = face || {};
  const dist = Number(f.distance);
  const checks = { distancia: isFinite(dist) ? dist : null, pruebaDeVida: !!f.liveness, modo: String(f.mode || ''), intentos: Number(f.tries) || 1 };
  if (!isFinite(dist)) return { status: 'rechazado', msg: 'Falta comparar tu selfie con la foto de tu cédula. Vuelve a tomarla.', checks: checks };
  if (dist > CONFIG.FACE_REJECT) return { status: 'rechazado', msg: 'Tu rostro no coincide con la foto de tu cédula.', checks: checks };
  if (dist > CONFIG.FACE_OK) return { status: 'revisar', msg: 'El parecido con tu cédula no es claro; lo revisaremos a mano.', checks: checks };
  if (!f.liveness) return { status: 'revisar', msg: 'Selfie sin prueba de vida; la revisaremos a mano.', checks: checks };
  return { status: 'ok', msg: '', checks: checks };
}

/** Texto del archivo con el OCR de Google Drive (servicio avanzado Drive API, v2 o v3). */
function ocrText(file) {
  if (typeof Drive === 'undefined') fail('El verificador de documentos no está activo todavía. Inténtalo más tarde.');
  const blob = file.getBlob();
  let id;
  if (Drive.Files.create) {
    id = Drive.Files.create({ name: 'ocr-temporal', mimeType: MimeType.GOOGLE_DOCS }, blob, { ocrLanguage: 'es' }).id;
  } else {
    id = Drive.Files.insert({ title: 'ocr-temporal', mimeType: MimeType.GOOGLE_DOCS }, blob, { ocr: true, ocrLanguage: 'es' }).id;
  }
  try {
    return DocumentApp.openById(id).getBody().getText();
  } finally {
    try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { console.error('No se pudo borrar el OCR temporal', e); }
  }
}

/** Consulta pública del SRI (si no responde, no bloquea: se usa solo el certificado). */
function sriLookup(ruc) {
  try {
    const res = UrlFetchApp.fetch('https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/obtenerPorNumerosRuc?&ruc=' + encodeURIComponent(ruc),
      { muteHttpExceptions: true, headers: { Accept: 'application/json' } });
    const code = res.getResponseCode();
    if (code !== 200) return { checked: false, note: 'SRI respondió ' + code };
    const body = res.getContentText();
    if (!body || body === '[]' || body === 'null') return { checked: true, exists: false };
    const j = JSON.parse(body);
    const c = Array.isArray(j) ? j[0] : j;
    if (!c || !c.numeroRuc) return { checked: false, note: 'Respuesta del SRI sin datos' };
    return { checked: true, exists: true, name: String(c.razonSocial || ''), state: String(c.estadoContribuyenteRuc || '') };
  } catch (e) {
    return { checked: false, note: String(e && e.message || e).slice(0, 120) };
  }
}

/** Antes de los documentos: cédula ya registrada y RUC en el SRI. */
function preVerify(req) {
  const d = req.data || {};
  if (!validCedula(String(d.cedula))) fail('La cédula no es válida.');
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  ensureTabs(ss);
  const dup = readObjs(ss.getSheetByName(TAB.pro)).filter(r => String(r.cedula) === String(d.cedula) && r._codigo !== req.id);
  if (dup.length) fail('Ya existe un registro con esta cédula. Si necesitas corregir tus datos, comunícate con nosotros.');
  if (CONFIG.VERIFY && CONFIG.SRI_CHECK && !d.rucPending && validRuc(String(d.ruc))) {
    const sri = sriLookup(String(d.ruc));
    if (sri.checked && !sri.exists) fail('Ese RUC no existe en el SRI. Revisa el número o marca que lo estás sacando.');
    if (sri.checked && sri.exists) {
      if (!/ACTIV/.test(normText(sri.state))) fail('Tu RUC está ' + String(sri.state || 'inactivo').toLowerCase() + ' en el SRI. Actívalo para poder facturar.');
      const n = normText(sri.name);
      const ok = d.kind === 'empresa' ? companyFound(n, d.businessName) : surnameFound(n, d.lastName);
      if (!ok) fail('Según el SRI, ese RUC está a nombre de otra persona. Revisa el número y tus apellidos.');
    }
  }
  return { ok: true };
}

/** Lee el resultado guardado en la descripción del archivo. */
function fileMeta(driveId) {
  try { return JSON.parse(DriveApp.getFileById(driveId).getDescription() || '{}'); } catch (e) { return {}; }
}

/* ---- Texto ---- */

function normText(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[ \t]+/g, ' ');
}
/** ¿Aparece el número? Tolera espacios, guiones o puntos entre dígitos y la O leída como 0. */
function hasNumber(t, num) {
  if (!num) return false;
  const s = t.replace(/(\d)O|O(?=\d)/g, (m, d) => d ? d + '0' : '0').replace(/(\d)[\s.\-]+(?=\d)/g, '$1');
  return s.indexOf(num) >= 0;
}
/** Cédulas válidas de 10 dígitos en el texto que no son las esperadas. */
function foreignIds(t, mine) {
  const s = t.replace(/(\d)[\s.\-]+(?=\d)/g, '$1');
  const out = [];
  (s.match(/\d{10,13}/g) || []).forEach(n => {
    const c = n.slice(0, 10);
    if (validCedula(c) && mine.indexOf(c) < 0 && out.indexOf(c) < 0) out.push(c);
  });
  return out;
}
function foreignRucs(t, ruc) {
  const s = t.replace(/(\d)[\s.\-]+(?=\d)/g, '$1');
  return (s.match(/\d{10}001/g) || []).filter(n => n !== ruc && validRuc(n));
}
function words(s) { return normText(s).replace(/[^A-Z ]/g, ' ').split(' ').filter(w => w.length >= 3 && ['DEL', 'LOS', 'LAS'].indexOf(w) < 0); }
function hasWord(t, w) { return new RegExp('(^|[^A-Z])' + w + '([^A-Z]|$)').test(t.replace(/[^A-Z0-9]/g, ' ').replace(/ +/g, ' ')) || t.replace(/[^A-Z]/g, '').indexOf(w) >= 0 && w.length >= 6; }
function surnameFound(t, lastName) { const w = words(lastName); return w.length ? hasWord(t, w[0]) || (w[1] ? hasWord(t, w[1]) : false) : false; }
function nameFound(t, firstName) { const w = words(firstName); return w.length ? hasWord(t, w[0]) : false; }
function companyFound(t, businessName) {
  const w = words(businessName).filter(x => ['CIA', 'LTDA', 'S.A', 'SAS', 'COMPANIA', 'EMPRESA'].indexOf(x) < 0);
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
  const push = x => { if (x) out.push(x); };
  t.replace(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/g, (m, d, mo, y) => push(mkDate(y, mo, d)));
  t.replace(/\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g, (m, y, mo, d) => push(mkDate(y, mo, d)));
  t.replace(/\b(\d{1,2})\s*(?:DE\s+)?([A-Z]{3,10})\.?\s*(?:DE|DEL|,)?\s*(\d{4})\b/g, (m, d, mes, y) => { if (MESES[mes]) push(mkDate(y, MESES[mes], d)); });
  return out;
}
/** La fecha más reciente que no esté en el futuro (fecha de emisión). */
function latestDate(t) {
  const lim = today().getTime() + 86400000;
  const ds = findDates(t).filter(d => d.getTime() <= lim).sort((a, b) => b - a);
  return ds[0] || null;
}
/** Primera fecha que aparece después de una etiqueta (p. ej. FECHA DE EXPIRACIÓN). */
function dateAfter(t, label) {
  const m = label.exec(t);
  if (!m) return null;
  const ds = findDates(t.slice(m.index, m.index + 60));
  return ds[0] || null;
}
function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function iso(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function human(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy'); }

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
/** Datos con los que se verificó un documento (para exigir que no cambien después). */
function cleanExpect(e) {
  e = e || {};
  const s = (x, n) => String(x == null ? '' : x).trim().slice(0, n);
  return { cedula: s(e.cedula, 10), ruc: s(e.ruc, 13), firstName: s(e.firstName, 80), lastName: s(e.lastName, 80), businessName: s(e.businessName, 120), kind: e.kind === 'empresa' ? 'empresa' : 'persona' };
}

/** Nombre visible de una categoría (de la lista o agregada por el profesional). */
function catName(s, d) { return CATS[s] ? CATS[s].name : String(((d || {}).customNames || {})[s] || s).trim(); }
function num(x) { const n = Number(x); return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; }
function checkId(id) { if (!/^RP-[A-Z0-9]{8}$/.test(String(id))) fail('Código de registro inválido.'); }
function writeJson(folder, name, obj) {
  const old = folder.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true);
  folder.createFile(name, JSON.stringify(obj, null, 2), 'application/json');
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function fail(msg) { const e = new Error(msg); e.userMessage = msg; throw e; }
