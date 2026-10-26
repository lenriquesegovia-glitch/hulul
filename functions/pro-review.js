/**
 * Revisión de profesionales: reglas puras (sin Firebase) para el panel
 * /admin/profesionales y los avisos al profesional. Pruebas en pro-review.test.js.
 */

export const REVIEW_DECISIONS = ['aprobado', 'observado', 'rechazado'];
export const REVIEW_LIST_STATUSES = ['en_revision', 'observado', 'aprobado', 'rechazado', 'borrador'];
export const PRO_UID = /^[A-Za-z0-9]{20,40}$/;
export const MAX_FILE_BYTES = 9 * 1024 * 1024;

/** Valida la decisión que manda el panel. Devuelve el cambio para providers/{uid} o un mensaje de error. */
export function reviewPatch(input, current) {
  const decision = String(input?.decision ?? '');
  if (!REVIEW_DECISIONS.includes(decision)) return { error: 'Decisión no válida.' };
  const note = String(input?.note ?? '').trim().slice(0, 1000);
  if (decision !== 'aprobado' && note.length < 10) return { error: 'Escribe el motivo para el profesional (al menos 10 caracteres). Lo va a leer.' };
  if (!current) return { error: 'No encontramos ese profesional.' };
  if (current.status === 'borrador') return { error: 'Este registro aún no fue enviado a revisión.' };
  const cats = Array.isArray(current.categories) ? current.categories : [];
  const catIn = input?.catStatus && typeof input.catStatus === 'object' ? input.catStatus : {};
  const catStatus = { ...(current.catStatus ?? {}) };
  for (const c of cats) {
    const v = catIn[c];
    if (REVIEW_DECISIONS.includes(v)) catStatus[c] = v;
    else if (decision === 'aprobado' && (catStatus[c] ?? 'en_revision') === 'en_revision') catStatus[c] = 'aprobado';
  }
  if (decision === 'aprobado' && cats.length && !cats.some((c) => catStatus[c] === 'aprobado')) {
    return { error: 'Para aprobar, al menos una categoría debe quedar aprobada.' };
  }
  if (decision === 'aprobado' && !cats.length) {
    return { error: 'Este profesional solo propuso actividades nuevas. Antes de aprobarlo hay que crear esa categoría en HULUL; mientras tanto, márcalo como observado.' };
  }
  return { patch: { status: decision, reviewNote: note, catStatus } };
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
    if (typeof path === 'string' && path.startsWith(prefix)) out.push({ label: DOC_LABELS[key] ?? key, path, name: v?.name ?? '' });
  }
  for (const [cat, ev] of Object.entries(p?.catEvidence ?? {})) {
    (ev?.files ?? []).forEach((path, i) => {
      if (typeof path === 'string' && path.startsWith(prefix)) out.push({ label: `${cat} · respaldo ${i + 1}`, path, name: '' });
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
