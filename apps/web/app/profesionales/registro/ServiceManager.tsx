'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  categories,
  CATEGORY_REVIEW_LABEL,
  evidenceProblem,
  getCategory,
  type CategoryEvidence,
  type CategoryReview,
  type CategorySlug,
} from '@hulul/shared';
import { EvidenceEditor, RateField, rateProblem, ServicesPicker } from './ServiceBits';

interface ProviderServices {
  categories: CategorySlug[];
  catStatus?: Partial<Record<CategorySlug, CategoryReview>>;
  visitRates: Partial<Record<CategorySlug, number>>;
  services: Partial<Record<CategorySlug, string[]>>;
}

const errMsg = (e: unknown) => (e as { message?: string }).message || 'No pudimos guardar. Revisa tu conexión e inténtalo de nuevo.';

/**
 * "Mis servicios" para un profesional aprobado: cambia su tarifa por visita
 * y sus trabajos, y suma categorías nuevas (sin límite), cada una con su
 * validación. Las nuevas quedan en revisión hasta que HULUL las apruebe.
 */
export function ServiceManager({ uid }: { uid: string }) {
  const [p, setP] = useState<ProviderServices | null>(null);
  const [rates, setRates] = useState<Partial<Record<CategorySlug, number | undefined>>>({});
  const [services, setServices] = useState<Partial<Record<CategorySlug, string[]>>>({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const [{ firestore }, fs] = await Promise.all([import('@hulul/shared/firebase'), import('firebase/firestore')]);
    const snap = await fs.getDoc(fs.doc(firestore(), 'providers', uid));
    const data = (snap.data() ?? {}) as Partial<ProviderServices> & { rates?: Partial<Record<CategorySlug, number>> };
    const next: ProviderServices = {
      categories: data.categories ?? [],
      catStatus: data.catStatus,
      visitRates: data.visitRates ?? {},
      services: data.services ?? {},
    };
    setP(next);
    setRates(next.visitRates);
    setServices(next.services);
  }, [uid]);

  useEffect(() => { load().catch(() => setErr('No pudimos cargar tus servicios.')); }, [load]);

  if (!p) return <p className="muted">{err || 'Cargando tus servicios…'}</p>;

  const statusOf = (c: CategorySlug): CategoryReview => p.catStatus?.[c] ?? 'aprobado';

  const save = async () => {
    setErr(''); setMsg('');
    for (const c of p.categories) {
      const name = getCategory(c)?.name ?? c;
      const r = rateProblem(name, rates[c]);
      if (r) { setErr(r); return; }
      if (!(services[c]?.length)) { setErr(`Marca al menos un trabajo en ${name}.`); return; }
    }
    setBusy(true);
    try {
      const { updateServices } = await import('@hulul/shared/firebase');
      await updateServices({
        action: 'tarifas',
        visitRates: Object.fromEntries(p.categories.map((c) => [c, rates[c]])) as Partial<Record<CategorySlug, number>>,
        services: Object.fromEntries(p.categories.map((c) => [c, services[c] ?? []])),
      });
      setMsg('Listo: tus tarifas y trabajos quedaron guardados. Tu perfil público se actualiza en unos segundos.');
      await load();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="stack gap-16">
      <h2 className="fs-title">Mis servicios y tarifas</h2>
      <p className="muted" style={{ fontSize: 14 }}>Cobras por visita. Puedes cambiar tu tarifa cuando quieras; las reservas ya hechas mantienen el precio con el que se reservaron.</p>

      {p.categories.map((c) => {
        const st = statusOf(c);
        return (
          <div key={c} className="card stack gap-12" style={{ padding: 18 }}>
            <div className="row gap-12" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 17 }}>{getCategory(c)?.name}</strong>
              <span className={`tag ${st === 'aprobado' ? 'on' : ''}`} style={{ cursor: 'default' }}>{CATEGORY_REVIEW_LABEL[st]}</span>
            </div>
            {st === 'aprobado' ? (
              <>
                <ServicesPicker category={c} value={services[c] ?? []} onChange={(v) => setServices((x) => ({ ...x, [c]: v }))} />
                <div className="form-2">
                  <RateField category={c} uid={uid} value={rates[c]} onChange={(v) => setRates((x) => ({ ...x, [c]: v }))} />
                </div>
              </>
            ) : (
              <p className="muted" style={{ fontSize: 13.5 }}>
                {st === 'en_revision' && 'Estamos revisando cómo demostraste que sabes hacer este trabajo. Te avisamos por correo.'}
                {(st === 'observado' || st === 'rechazado') && 'No pudimos aprobar esta categoría con lo que enviaste. Puedes volver a enviarla con otro certificado o más fotos de tus trabajos.'}
              </p>
            )}
          </div>
        );
      })}

      {err && !adding && <p role="alert" className="form-error">{err}</p>}
      {msg && <p role="status" className="notice">{msg}</p>}
      {p.categories.some((c) => statusOf(c) === 'aprobado') && (
        <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={save}>
          {busy ? 'Guardando…' : 'Guardar tarifas y trabajos'}
        </button>
      )}

      {adding
        ? <AddCategory uid={uid} p={p} onCancel={() => setAdding(false)} onDone={async () => { setAdding(false); setMsg('Enviamos tu nueva categoría a revisión. Te avisamos por correo cuando la aprobemos.'); await load(); }} />
        : <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => { setMsg(''); setErr(''); setAdding(true); }}>+ Ofrecer otra categoría</button>}
    </section>
  );
}

function AddCategory({ uid, p, onCancel, onDone }: { uid: string; p: ProviderServices; onCancel: () => void; onDone: () => Promise<void> }) {
  const open = categories.filter((c) => !p.categories.includes(c.slug) || ['observado', 'rechazado'].includes(p.catStatus?.[c.slug] ?? ''));
  const [cat, setCat] = useState<CategorySlug | ''>('');
  const [svc, setSvc] = useState<string[]>([]);
  const [rate, setRate] = useState<number | undefined>();
  const [ev, setEv] = useState<CategoryEvidence | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    setErr('');
    if (!cat) { setErr('Elige la categoría.'); return; }
    const name = getCategory(cat)?.name ?? cat;
    if (!svc.length) { setErr(`Marca qué trabajos haces en ${name}.`); return; }
    const r = rateProblem(name, rate);
    if (r) { setErr(r); return; }
    const e = evidenceProblem(cat, ev);
    if (e) { setErr(e); return; }
    setBusy(true);
    try {
      const { updateServices } = await import('@hulul/shared/firebase');
      await updateServices({ action: 'agregar', category: cat, visitRate: rate!, services: svc, evidence: ev! });
      await onDone();
    } catch (x) {
      setErr(errMsg(x));
    } finally {
      setBusy(false);
    }
  };

  if (!open.length) return <p className="muted">Ya ofreces todas las categorías de HULUL.</p>;

  return (
    <div className="card stack gap-12" style={{ padding: 18 }}>
      <strong style={{ fontSize: 17 }}>Ofrecer otra categoría</strong>
      <div className="field">
        <label htmlFor="new-cat">Categoría</label>
        <select id="new-cat" value={cat} onChange={(e) => { setCat(e.target.value as CategorySlug); setSvc([]); setRate(undefined); setEv(undefined); }}>
          <option value="">Elige…</option>
          {open.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      {cat && (
        <>
          <ServicesPicker category={cat} value={svc} onChange={setSvc} />
          <div className="form-2"><RateField category={cat} uid={uid} value={rate} onChange={setRate} /></div>
          <EvidenceEditor category={cat} uid={uid} value={ev} onChange={setEv} />
        </>
      )}
      {err && <p role="alert" className="form-error">{err}</p>}
      <div className="row gap-12">
        <button type="button" className="btn btn-primary" disabled={busy || !cat} onClick={send}>{busy ? 'Enviando…' : 'Enviar a revisión'}</button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
