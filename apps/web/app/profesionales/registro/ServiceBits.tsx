'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  EVIDENCE_OPTIONS,
  MAX_DOC_MB,
  MAX_EVIDENCE_FILES,
  MAX_VISIT_RATE,
  MIN_VISIT_RATE,
  getCategory,
  rateRange,
  referencePrices,
  subservicesOf,
  type CategoryEvidence,
  type CategorySlug,
  type ReferencePrices,
} from '@hulul/shared';

/**
 * Piezas del registro de profesionales que también usa "Mis servicios":
 * tarifa por visita con precios de referencia, trabajos que hace y cómo
 * demuestra que sabe hacerlos.
 */

async function storage() {
  const [{ firebaseApp }, st] = await Promise.all([import('@hulul/shared/firebase'), import('firebase/storage')]);
  return { storage: st.getStorage(firebaseApp()), st };
}

/** Precios de referencia de una categoría (sugerido y, si hay, rango de otros profesionales). */
export function useReference(category: CategorySlug, uid?: string): ReferencePrices {
  const [ref, setRef] = useState<ReferencePrices>(() => referencePrices(category, []));
  useEffect(() => {
    let off = false;
    import('@hulul/shared/firebase')
      .then(({ categoryRates }) => categoryRates(category, uid))
      .then((rates) => { if (!off) setRef(referencePrices(category, rates)); })
      .catch(() => {});
    return () => { off = true; };
  }, [category, uid]);
  return ref;
}

export function referenceText(r: ReferencePrices, range?: { min: number; max: number }): string {
  const base = `Sugerido por HULUL: $${r.suggested}.${range ? ` Puedes cobrar entre $${range.min} y $${range.max}.` : ''}`;
  if (r.median === undefined) return `${base} Aún hay pocos profesionales en esta categoría para comparar.`;
  return `${base} ${r.count} profesionales cobran entre $${r.min} y $${r.max} (la mitad cobra $${r.median} o menos).`;
}

/** Tarifa por visita, con los precios de referencia debajo. */
export function RateField({ category, uid, value, onChange }: {
  category: CategorySlug; uid?: string; value: number | undefined; onChange: (v: number | undefined) => void;
}) {
  const ref = useReference(category, uid);
  const range = rateRange(category);
  const out = value !== undefined && (value < range.min || value > range.max);
  return (
    <div className="stack gap-8">
      <Field id={`r-${category}`} label="Tu tarifa por visita (USD)" hint={referenceText(ref, range)}>
        <input id={`r-${category}`} type="text" inputMode="numeric" maxLength={4} value={value ? String(value) : ''}
          placeholder={String(ref.suggested)}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
            onChange(v ? Number(v) : undefined);
          }} />
      </Field>
      {!value && (
        <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 13.5 }} onClick={() => onChange(Math.min(range.max, Math.max(range.min, ref.median ?? ref.suggested)))}>
          Usar ${Math.min(range.max, Math.max(range.min, ref.median ?? ref.suggested))}
        </button>
      )}
      {out && <span className="form-error" style={{ fontSize: 13.5 }}>Para que los precios de HULUL sean parecidos y creíbles, en esta categoría la tarifa va de ${range.min} a ${range.max}.</span>}
    </div>
  );
}

export const rateProblem = (name: string, v: number | undefined, category?: CategorySlug): string => {
  const { min, max } = category ? rateRange(category) : { min: MIN_VISIT_RATE, max: MAX_VISIT_RATE };
  return !(Number(v) >= min && Number(v) <= max) ? `Tu tarifa por visita en ${name} debe estar entre $${min} y $${max}.` : '';
};

/** Trabajos que hace en una categoría (los de la lista y los propios). */
export function ServicesPicker({ category, value, onChange }: { category: CategorySlug; value: string[]; onChange: (v: string[]) => void }) {
  const base = subservicesOf(category);
  const toggle = (s: string) => onChange(value.includes(s) ? value.filter((y) => y !== s) : [...value, s]);
  return (
    <div className="stack gap-8">
      <span className="muted" style={{ fontSize: 13.5 }}>Marca lo que haces:</span>
      <div className="tag-row">
        {[...base, ...value.filter((x) => !base.includes(x))].map((s) => {
          const on = value.includes(s);
          return <button key={s} type="button" aria-pressed={on} className={`tag ${on ? 'on' : ''}`} onClick={() => toggle(s)}>{on && '✓ '}{s}</button>;
        })}
      </div>
      <AddOwnJob onAdd={(job) => { if (!value.includes(job)) onChange([...value, job]); }} />
    </div>
  );
}

const EMPTY_EVIDENCE: CategoryEvidence = { kind: 'experiencia', note: '', reference: '', files: [] };

/** Cómo demuestra que sabe hacer el trabajo de esta categoría. */
export function EvidenceEditor({ category, uid, value, onChange }: {
  category: CategorySlug; uid: string; value: CategoryEvidence | undefined; onChange: (v: CategoryEvidence) => void;
}) {
  const e = value ?? { ...EMPTY_EVIDENCE, kind: category === 'salud' ? 'certificado' : 'experiencia' };
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const name = getCategory(category)?.name ?? category;
  const set = (patch: Partial<CategoryEvidence>) => onChange({ ...e, ...patch });

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr('');
    const list = Array.from(files).slice(0, MAX_EVIDENCE_FILES - e.files.length);
    if (!list.length) { setErr(`Máximo ${MAX_EVIDENCE_FILES} archivos.`); return; }
    if (list.some((f) => f.size > MAX_DOC_MB * 1024 * 1024)) { setErr(`Cada archivo debe pesar menos de ${MAX_DOC_MB} MB.`); return; }
    if (list.some((f) => !(f.type.startsWith('image/') || f.type === 'application/pdf'))) { setErr('Sube fotos o PDF.'); return; }
    setBusy(true);
    try {
      const { storage: s, st } = await storage();
      const paths: string[] = [];
      for (const f of list) {
        const ext = (f.name.split('.').pop() || (f.type === 'application/pdf' ? 'pdf' : 'jpg')).toLowerCase().slice(0, 5);
        const path = `providers/${uid}/evidencia-${category}-${Date.now()}-${paths.length}.${ext}`;
        await st.uploadBytes(st.ref(s, path), f, { contentType: f.type });
        paths.push(path);
      }
      set({ files: [...e.files, ...paths] });
    } catch {
      setErr('No se pudo subir. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack gap-12" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <strong style={{ fontSize: 15 }}>¿Cómo demuestras que sabes hacer trabajos de {name.toLowerCase()}?</strong>
      <div className="stack gap-8">
        {EVIDENCE_OPTIONS.filter((o) => category !== 'salud' || o.value === 'certificado').map((o) => (
          <label key={o.value} className="check">
            <input type="radio" name={`ev-${category}`} checked={e.kind === o.value} onChange={() => set({ kind: o.value })} />
            <span><strong>{o.label}.</strong> {o.help}</span>
          </label>
        ))}
      </div>
      <Field id={`ev-note-${category}`} label={e.kind === 'certificado' ? '¿Qué certificado o título tienes?' : 'Cuenta tu experiencia'}>
        <input id={`ev-note-${category}`} maxLength={500} value={e.note}
          placeholder={e.kind === 'certificado' ? 'Ej.: Técnico en refrigeración, SECAP 2019' : 'Ej.: 8 años en un taller de electrodomésticos en el centro'}
          onChange={(x) => set({ note: x.target.value })} />
      </Field>
      {e.kind === 'experiencia' && (
        <Field id={`ev-ref-${category}`} label="¿Quién te recomienda? (nombre y celular)" hint="Un cliente o empleador anterior. Podemos llamarlo para confirmar.">
          <input id={`ev-ref-${category}`} maxLength={160} value={e.reference ?? ''} placeholder="Ej.: María López, 0991234567"
            onChange={(x) => set({ reference: x.target.value })} />
        </Field>
      )}
      <div className="doc-row" style={{ alignItems: 'center' }}>
        <div className="stack gap-4" style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 14.5 }}>{e.kind === 'certificado' ? 'Foto o PDF del certificado' : 'Fotos de trabajos que hiciste (mínimo 2)'}</strong>
          <span className="muted" style={{ fontSize: 13 }}>{e.files.length ? `✓ ${e.files.length} archivo(s) subido(s)` : 'Solo el equipo de HULUL los ve.'}</span>
          {err && <span className="form-error" style={{ fontSize: 13 }}>{err}</span>}
        </div>
        {e.files.length > 0 && <button type="button" className="link-btn" onClick={() => set({ files: [] })}>Quitar</button>}
        <label className="btn btn-ghost doc-btn" aria-busy={busy}>
          {busy ? 'Subiendo…' : e.files.length ? 'Agregar' : 'Subir'}
          <input type="file" multiple accept="image/*,application/pdf" disabled={busy || e.files.length >= MAX_EVIDENCE_FILES}
            onChange={(x) => { upload(x.target.files); x.target.value = ''; }} />
        </label>
      </div>
    </div>
  );
}

/** Agregar un trabajo que no está en la lista. */
export function AddOwnJob({ onAdd }: { onAdd: (job: string) => void }) {
  const [v, setV] = useState('');
  const add = () => {
    const job = v.trim().replace(/\s+/g, ' ');
    if (job.length < 3) return;
    onAdd(job.charAt(0).toUpperCase() + job.slice(1, 60));
    setV('');
  };
  return (
    <div className="row gap-8">
      <input className="own-job" value={v} maxLength={60} placeholder="¿Haces otro trabajo? Escríbelo"
        onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
      <button type="button" className="btn btn-ghost" style={{ minHeight: 44, padding: '0 14px' }} onClick={add}>Agregar</button>
    </div>
  );
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <span className="muted" style={{ fontSize: 12.5 }}>{hint}</span>}
    </div>
  );
}
