/**
 * Revisión de profesionales: reglas puras (sin Firebase) para el panel
 * /admin/profesionales y los avisos al profesional. Pruebas en pro-review.test.js.
 */

export const REVIEW_DECISIONS = ['aprobado', 'observado', 'rechazado'];
export const REVIEW_LIST_STATUSES = ['en_revision', 'observado', 'aprobado', 'rechazado', 'borrador'];
export const PRO_UID = /^[A-Za-z0-9]{20,40}$/;
export const MAX_FILE_BYTES = 9 * 1024 * 1024;

/**
 * Valida la decisión que manda el panel. Devuelve el cambio para providers/{uid} o un mensaje de error.
 * input.assign: { idDeActividadPropuesta: categoría } suma una actividad nueva a una categoría
 * existente (sus trabajos, tarifa y cómo lo demuestra pasan a esa categoría) para poder aprobarla.
 */
export function reviewPatch(input, current, validCats = []) {
  const decision = String(input?.decision ?? '');
  if (!REVIEW_DECISIONS.includes(decision)) return { error: 'Decisión no válida.' };
  const note = String(input?.note ?? '').trim().slice(0, 1000);
  if (decision !== 'aprobado' && note.length < 10) return { error: 'Escribe el motivo para el profesional (al menos 10 caracteres). Lo va a leer.' };
  if (!current) return { error: 'No encontramos ese profesional.' };
  if (current.status === 'borrador') return { error: 'Este registro aún no fue enviado a revisión.' };

  const cats = Array.isArray(current.categories) ? [...current.categories] : [];
  const services = { ...(current.services ?? {}) };
  const visitRates = { ...(current.visitRates ?? {}) };
  const catEvidence = { ...(current.catEvidence ?? {}) };
  let proposals = Array.isArray(current.proposals) ? [...current.proposals] : [];
  const catIn = input?.catStatus && typeof input.catStatus === 'object' ? input.catStatus : {};
  const catStatus = { ...(current.catStatus ?? {}) };
  const assigned = [];

  // Actividades nuevas que HULUL suma a una categoría existente.
  const assign = input?.assign && typeof input.assign === 'object' ? input.assign : {};
  for (const [id, cat] of Object.entries(assign)) {
    if (!cat) continue;
    const prop = proposals.find((x) => x?.id === id);
    if (!prop) return { error: 'Esa actividad ya no está en el registro. Vuelve a abrirlo.' };
    if (!validCats.includes(cat)) return { error: 'Elige una categoría válida para la actividad.' };
    if (!cats.includes(cat)) cats.push(cat);
    const extra = Array.isArray(prop.services) ? prop.services.map((x) => String(x).trim()).filter(Boolean) : [];
    services[cat] = [...new Set([...(services[cat] ?? []), ...extra])].slice(0, 40);
    if (!(Number(visitRates[cat]) > 0) && Number(prop.rate) > 0) visitRates[cat] = Math.round(Number(prop.rate) * 100) / 100;
    if (!catEvidence[cat]) catEvidence[cat] = { kind: 'experiencia', note: String(prop.note ?? '').slice(0, 500), reference: '', files: [] };
    if (!REVIEW_DECISIONS.includes(catStatus[cat]) || catStatus[cat] === 'observado') catStatus[cat] = 'en_revision';
    proposals = proposals.filter((x) => x?.id !== id);
    assigned.push({ name: String(prop.name ?? ''), category: cat });
  }

  for (const c of cats) {
    const v = catIn[c];
    if (REVIEW_DECISIONS.includes(v)) catStatus[c] = v;
    else if (decision === 'aprobado' && (catStatus[c] ?? 'en_revision') === 'en_revision') catStatus[c] = 'aprobado';
  }
  if (decision === 'aprobado' && !cats.length) {
    return { error: 'Este profesional solo propuso actividades nuevas. Elige en «Aprobar dentro de…» la categoría donde entra cada una y vuelve a tocar Aprobar.' };
  }
  if (decision === 'aprobado' && !cats.some((c) => catStatus[c] === 'aprobado')) {
    return { error: 'Para aprobar, al menos una categoría debe quedar aprobada.' };
  }
  const patch = { status: decision, reviewNote: note, catStatus };
  if (assigned.length) Object.assign(patch, { categories: cats, services, visitRates, catEvidence, proposals });
  return { patch, assigned };
}

/** Texto del aviso al profesional según la decisión. */
export function reviewMessage(decision, firstName, note) {
  const hola = `Hola ${String(firstName ?? '').split(' ')[0] || ''}`.trim();
  if (decision === 'aprobado') {
    return {
      subject: '¡Ya estás en HULUL!',
      title: 'Tu perfil fue aprobado',
      push: ['Tu perfil fue aprobado', 'Ya apareces en HULUL y los clientes pueden reservarte.'],
      text: `${hola}, revisamos tus datos y documentos. Tu perfil ya aparece en HULUL y los clientes pueden reservarte.${note ? ` Nota de HULUL: ${note}` : ''}`,
    };
  }
  if (decision === 'observado') {
    return {
      subject: 'Tu registro en HULUL necesita una corrección',
      title: 'Falta corregir algo en tu registro',
      push: ['Corrige tu registro', note.slice(0, 110)],
      text: `${hola}, revisamos tu registro y necesitamos que corrijas lo siguiente: ${note} Entra a tu registro, corrígelo y vuelve a enviarlo. Lo revisamos de nuevo en 1 a 3 días hábiles.`,
    };
  }
  return {
    subject: 'Resultado de tu registro en HULUL',
    title: 'No pudimos aprobar tu registro',
    push: ['No pudimos aprobar tu registro', note.slice(0, 110)],
    text: `${hola}, revisamos tu registro y por ahora no podemos aprobarlo. Motivo: ${note} Si crees que hay un error, responde a este correo.`,
  };
}

/** Archivos del registro para el panel: documentos de identidad y respaldos por categoría. */
export function providerFiles(p, uid) {
  const out = [];
  const prefix = `providers/${uid}/`;
  for (const [key, v] of Object.entries(p?.docs ?? {})) {
    const path = typeof v === 'string' ? v : v?.path;
    if (typeof path === 'string' && path.startsWith(prefix)) out.push({ key, label: DOC_LABELS[key] ?? key, path, name: v?.name ?? '' });
  }
  for (const [cat, ev] of Object.entries(p?.catEvidence ?? {})) {
    (ev?.files ?? []).forEach((path, i) => {
      if (typeof path === 'string' && path.startsWith(prefix)) out.push({ key: '', label: `${cat} · respaldo ${i + 1}`, path, name: '' });
    });
  }
  return out;
}

const DOC_LABELS = {
  cedulaFrente: 'Cédula (frente)', cedulaReverso: 'Cédula (reverso)', selfie: 'Foto de rostro', antecedentes: 'Certificado de antecedentes',
  ruc: 'Certificado del RUC', titulo: 'Título o certificado',
};

/** Cuenta bancaria con el número tapado (en el panel no hace falta completo). */
export function maskBank(b) {
  if (!b) return null;
  const n = String(b.number ?? '');
  return { bank: b.bank ?? '', type: b.type ?? '', number: n ? `•••• ${n.slice(-4)}` : '', holder: b.holder ?? '', holderId: b.holderId ?? '' };
}
