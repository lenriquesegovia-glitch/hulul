'use client';

import { useCallback, useEffect, useState } from 'react';
import { categories, CATEGORY_REVIEW_LABEL, getCategory, rateRange, serviceCity, TAX_REGIME_LABEL, WEEKDAY_NAMES, type CategorySlug, type TaxRegime } from '@hulul/shared';
import type { ProFile, ProListItem, ProReviewDecision, ProReviewStatus } from '@hulul/shared/firebase';
import { SignIn } from '@/components/SignIn';
import { logout, useUser } from '@/lib/auth';

/**
 * Panel privado de registros de profesionales. Solo entra una cuenta cuyo
 * correo está en ADMIN_EMAILS (lo valida el servidor, igual que reclamos).
 * Cada decisión le llega al profesional por correo y notificación.
 */

const TABS: { status: ProReviewStatus; label: string }[] = [
  { status: 'en_revision', label: 'Por revisar' },
  { status: 'observado', label: 'Observados' },
  { status: 'aprobado', label: 'Aprobados' },
  { status: 'rechazado', label: 'Rechazados' },
  { status: 'borrador', label: 'Sin terminar' },
];

const STATUS_LABEL: Record<string, string> = {
  en_revision: 'Por revisar', observado: 'Observado', aprobado: 'Aprobado', rechazado: 'Rechazado', borrador: 'Sin terminar',
};

const NOTE_TEMPLATES = [
  'La foto de la cédula está borrosa o cortada. Súbela de nuevo, con buena luz y que se lean todos los datos.',
  'El certificado de antecedentes tiene más de 3 meses. Descarga uno nuevo en la web del Ministerio del Interior.',
  'El certificado del RUC no coincide con tus datos. Sube el certificado de tu RUC actualizado.',
  'Faltan fotos de trabajos que hayas hecho (mínimo 2 por categoría) o un certificado.',
  'La foto de tu rostro no se ve clara. Tómala de frente, con buena luz y sin lentes oscuros.',
];

const errMsg = (e: unknown) => ((e as { message?: string }).message || 'No se pudo cargar.').replace(/\s*\[\d{3}\]\s*$/, '');
const catName = (slug: string) => getCategory(slug as never)?.name ?? slug;
const cityName = (slug: string) => serviceCity(slug)?.name ?? slug;
const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const wa = (phone: string) => `https://wa.me/593${String(phone).replace(/\D/g, '').replace(/^0/, '')}`;

export function ProsPanel() {
  const user = useUser();
  const [tab, setTab] = useState<ProReviewStatus>('en_revision');
  const [items, setItems] = useState<ProListItem[] | null>(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState('');

  useEffect(() => { const q = new URLSearchParams(window.location.search).get('uid'); if (q) setOpen(q); }, []);

  const load = useCallback(async () => {
    setErr(''); setItems(null);
    try {
      const { adminListPros } = await import('@hulul/shared/firebase');
      setItems(await adminListPros(tab));
    } catch (e) { setErr(errMsg(e)); setItems([]); }
  }, [tab]);
  useEffect(() => { if (user) load(); }, [user, load]);

  if (user === undefined) return null;
  if (!user) return <SignIn title="Panel de profesionales" lead="Entra con la cuenta de HULUL autorizada." />;

  if (open) {
    return <ProDetail uid={open} onBack={() => { setOpen(''); window.history.replaceState(null, '', '/admin/profesionales'); load(); }} />;
  }

  return (
    <div className="stack gap-16">
      <div className="row gap-12" style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <h1 style={{ margin: 0 }}>Profesionales</h1>
        <span className="muted" style={{ fontSize: 13.5 }}>{user.email} · <button type="button" className="link-btn" onClick={() => logout()}>Salir</button></span>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>Revisa cada registro con sus documentos. Al aprobar, observar o rechazar, el profesional recibe el aviso por correo y en la app, con el motivo que escribas.</p>
      <div className="chip-row" style={{ flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.status} type="button" className={`btn ${tab === t.status ? 'btn-primary' : 'btn-ghost'}`} style={{ minHeight: 40, padding: '0 14px', fontSize: 14 }} onClick={() => setTab(t.status)}>
            {t.label}{tab === t.status && items ? ` (${items.length})` : ''}
          </button>
        ))}
      </div>
      {err && <p role="alert" className="form-error">{err}</p>}
      {items === null ? <p className="muted">Cargando…</p> : items.length === 0 ? <p className="muted">No hay registros en esta vista.</p> : (
        <div className="stack gap-8">
          {items.map((p) => (
            <button key={p.uid} type="button" className="card" onClick={() => { setOpen(p.uid); window.history.replaceState(null, '', `/admin/profesionales?uid=${p.uid}`); }}
              style={{ textAlign: 'left', cursor: 'pointer', padding: 16, display: 'grid', gap: 6 }}>
              <div className="row gap-8" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <strong>{p.name || 'Sin nombre'}</strong>
                <span className="muted" style={{ fontSize: 13 }}>Enviado {when(p.submittedAt)}</span>
              </div>
              <span style={{ fontSize: 13.5 }}>
                {p.categories.map(catName).join(' · ') || 'Sin categorías'}
                {p.proposals.length > 0 && <> · <span style={{ color: 'var(--copper)', fontWeight: 700 }}>Nuevas: {p.proposals.join(', ')}</span></>}
              </span>
              <span className="muted" style={{ fontSize: 13 }}>{p.cities.map(cityName).join(', ') || 'Sin ciudades'} · {p.docs} documento(s){p.reviewNote ? ` · Nota: ${p.reviewNote.slice(0, 80)}` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProDetail({ uid, onBack }: { uid: string; onBack: () => void }) {
  const [f, setF] = useState<ProFile | null>(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [cats, setCats] = useState<Record<string, string>>({});
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const { adminGetPro } = await import('@hulul/shared/firebase');
      const r = await adminGetPro(uid);
      setF(r);
      setCats(Object.fromEntries(r.provider.categories.map((c) => [c, ['aprobado', 'observado', 'rechazado'].includes(r.provider.catStatus[c]) ? r.provider.catStatus[c] : 'aprobado'])));
    } catch (e) { setErr(errMsg(e)); }
  }, [uid]);
  useEffect(() => { load(); }, [load]);

  const markSign = async (tiene: boolean) => {
    setBusy(true); setErr('');
    try { const { adminMarkESignature } = await import('@hulul/shared/firebase'); await adminMarkESignature(uid, tiene); setDone(tiene ? 'Firma electrónica marcada como verificada.' : 'Marcado: no tiene firma electrónica.'); await load(); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  const decide = async (decision: ProReviewDecision) => {
    if (decision !== 'aprobado' && note.trim().length < 10) { setErr('Escribe el motivo para el profesional (al menos 10 caracteres). Lo va a leer.'); return; }
    const label = { aprobado: 'aprobar', observado: 'pedir corrección a', rechazado: 'rechazar' }[decision];
    if (!window.confirm(`¿Seguro que quieres ${label} este registro? Le llegará el aviso al profesional.`)) return;
    setBusy(true); setErr('');
    try {
      const { adminDecidePro } = await import('@hulul/shared/firebase');
      await adminDecidePro(uid, decision, note.trim(), cats, assign);
      setAssign({});
      setDone({ aprobado: 'Aprobado. Ya aparece en HULUL y le llegó el aviso.', observado: 'Marcado como observado. Le llegó el aviso con lo que debe corregir.', rechazado: 'Rechazado. Le llegó el aviso con el motivo.' }[decision]);
      setNote('');
      await load();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  if (!f) return (
    <div className="stack gap-12">
      <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Volver</button>
      {err ? <p role="alert" className="form-error">{err}</p> : <p className="muted">Cargando registro…</p>}
    </div>
  );

  const p = f.provider;
  const name = p.kind === 'empresa' ? `${p.businessName} (${p.firstName} ${p.lastName})` : `${p.firstName} ${p.lastName}`;
  const canDecide = p.status !== 'borrador';

  return (
    <div className="stack gap-16">
      <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Volver a la lista</button>
      <div className="row gap-12" style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>{name}</h1>
        <span className="pill-review">{STATUS_LABEL[p.status] ?? p.status}</span>
      </div>
      {f.duplicates.length > 0 && <p className="notice" style={{ borderLeftColor: 'var(--danger, #B42318)' }}><strong>Ojo:</strong> hay {f.duplicates.length} registro(s) más con la misma cédula.</p>}
      {done && <p role="status" className="notice">{done}</p>}

      <Section title="Datos">
        <Row k="Tipo" v={p.kind === 'empresa' ? 'Empresa' : 'Persona'} />
        <Row k="Cédula" v={p.cedula} />
        <Row k="RUC" v={p.ruc} />
        <Row k="Régimen SRI" v={TAX_REGIME_LABEL[p.taxRegime as TaxRegime] ?? (p.taxRegime || '—')} />
        <Row k="Firma electrónica" v={<span className="row gap-8" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          {p.eSignature ? (p.eSignatureVerified === false ? 'Dice que la tiene (sin verificar)' : p.eSignatureVerified ? 'Verificada' : 'Sí (declarada en el registro)')
            : p.submittedAt ? `No · plazo hasta ${when(p.submittedAt + 30 * 86_400_000)}${p.submittedAt + 30 * 86_400_000 < Date.now() ? ' (vencido)' : ''}` : 'No'}
          {!p.eSignatureVerified && <button type="button" className="btn btn-secondary" style={{ minHeight: 34, padding: '4px 12px' }} disabled={busy} onClick={() => markSign(true)}>Marcar verificada</button>}
          {p.eSignature && <button type="button" className="link-btn" disabled={busy} onClick={() => markSign(false)}>No la tiene</button>}
        </span>} />
        <Row k="Celular" v={<>{p.phone} · <a href={wa(p.phone)} target="_blank" rel="noreferrer">WhatsApp</a></>} />
        <Row k="Correo" v={<a href={`mailto:${p.email}`}>{p.email}</a>} />
        <Row k="Experiencia" v={`${p.years} año(s)`} />
        <Row k="Presentación" v={p.bio || '—'} />
        <Row k="Ciudades" v={p.cities.map(cityName).join(', ') || '—'} />
        <Row k="Horario" v={`${p.days.map((d) => WEEKDAY_NAMES[d]?.slice(0, 3)).join(' ')} · ${p.from} a ${p.to}`} />
        <Row k="Efectivo" v={p.acceptsCash ? 'Acepta' : 'No'} />
        <Row k="Cuenta bancaria" v={f.bank ? `${f.bank.bank} · ${f.bank.type} ${f.bank.number} · ${f.bank.holder} (${f.bank.holderId})` : 'No registrada'} />
        <Row k="Enviado" v={when(p.submittedAt)} />
      </Section>

      {f.alerts.length > 0 && (
        <p className="notice" style={{ borderLeftColor: '#B42318' }}><strong>Revisar a mano:</strong> {f.alerts.join(' · ')}</p>
      )}

      <Section title="Documentos">
        {f.files.length === 0 ? <span className="muted">No subió documentos.</span> : (
          <div className="file-grid">
            {f.files.map((x) => <FileView key={x.path} uid={uid} file={x} check={x.key ? f.verification[x.key] : undefined} />)}
          </div>
        )}
      </Section>

      {p.categories.length > 0 && (
        <Section title="Categorías">
          {p.categories.map((c) => {
            const ev = p.catEvidence[c];
            return (
              <div key={c} className="stack gap-8" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div className="row gap-8" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <strong>{catName(c)} · ${p.visitRates[c] ?? '—'} por visita</strong>
                  <select value={cats[c] ?? 'aprobado'} onChange={(e) => setCats({ ...cats, [c]: e.target.value })} disabled={!canDecide} aria-label={`Decisión para ${catName(c)}`}>
                    <option value="aprobado">Aprobar</option>
                    <option value="observado">Observar</option>
                    <option value="rechazado">Rechazar</option>
                  </select>
                </div>
                <span style={{ fontSize: 13.5 }}>{(p.services[c] ?? []).join(' · ') || 'Sin trabajos marcados'}</span>
                <span className="muted" style={{ fontSize: 13.5 }}>
                  {ev ? `${ev.kind === 'certificado' ? 'Certificado' : 'Experiencia'}: ${ev.note || '—'}${ev.reference ? ` · Referencia: ${ev.reference}` : ''} · ${ev.files?.length ?? 0} archivo(s)` : 'Sin validación'}
                  {p.catStatus[c] ? ` · Estado actual: ${CATEGORY_REVIEW_LABEL[p.catStatus[c] as keyof typeof CATEGORY_REVIEW_LABEL] ?? p.catStatus[c]}` : ''}
                </span>
              </div>
            );
          })}
        </Section>
      )}

      {p.proposals.length > 0 && (
        <Section title="Actividades nuevas que propone">
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>No están en HULUL todavía. Para aprobarlas, elige en «Aprobar dentro de…» la categoría existente donde entra cada una. Si ninguna encaja, déjalas como propuesta.</p>
          {p.proposals.map((a) => {
            const to = assign[a.id] as CategorySlug | undefined;
            const range = to ? rateRange(to) : null;
            return (
              <div key={a.id} className="stack gap-8" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <strong>{a.name} · ${a.rate ?? '—'} por visita</strong>
                <span style={{ fontSize: 13.5 }}>{a.services.join(' · ')}</span>
                <span className="muted" style={{ fontSize: 13.5 }}>{a.note}</span>
                {canDecide && (
                  <label className="stack gap-4" style={{ fontSize: 13.5 }}>
                    <span style={{ fontWeight: 700 }}>Aprobar dentro de…</span>
                    <select value={to ?? ''} onChange={(e) => setAssign({ ...assign, [a.id]: e.target.value })} aria-label={`Categoría para ${a.name}`}>
                      <option value="">Dejar como propuesta (no se aprueba)</option>
                      {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                    </select>
                    {to && range && (
                      <span className="muted" style={{ fontSize: 12.5 }}>
                        Sus trabajos pasan a {catName(to)} y se aprueba junto con el registro. En {catName(to)} la tarifa va de ${range.min} a ${range.max}
                        {Number(a.rate) > range.max || Number(a.rate) < range.min ? `: los clientes verán $${Math.min(range.max, Math.max(range.min, Number(a.rate) || range.min))}, no $${a.rate}.` : '.'}
                      </span>
                    )}
                  </label>
                )}
              </div>
            );
          })}
        </Section>
      )}

      {canDecide && (
        <Section title="Decisión">
          <span className="muted" style={{ fontSize: 13.5 }}>El motivo lo lee el profesional. Es obligatorio para observar o rechazar; al aprobar puedes dejarlo vacío.</span>
          <div className="tag-row">
            {NOTE_TEMPLATES.map((t) => <button key={t} type="button" className="tag" onClick={() => setNote(note ? `${note} ${t}` : t)}>{t.split('.')[0]}</button>)}
          </div>
          <textarea rows={4} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: La foto de la cédula está borrosa. Súbela de nuevo con buena luz." aria-label="Motivo para el profesional" />
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => decide('aprobado')}>Aprobar</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => decide('observado')}>Pedir corrección</button>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => decide('rechazado')}>Rechazar</button>
          </div>
          {err && <p role="alert" className="form-error">{err}</p>}
        </Section>
      )}

      {f.history.length > 0 && (
        <Section title="Historial">
          {f.history.map((h, i) => <Row key={i} k={when(h.at)} v={`${STATUS_LABEL[h.decision] ?? h.decision} por ${h.by}${h.note ? ` · ${h.note}` : ''}${h.assigned?.length ? ` · Actividades sumadas: ${h.assigned.map((x) => `${x.name} → ${catName(x.category)}`).join(', ')}` : ''}`} />)}
        </Section>
      )}
    </div>
  );
}

const CHECK_TONE: Record<string, { bg: string; fg: string; t: string }> = {
  ok: { bg: '#E6F2E9', fg: '#206344', t: 'Verificado' },
  revisar: { bg: '#FFF4E5', fg: '#9A5B00', t: 'Revisar' },
  rechazado: { bg: '#FDECEA', fg: '#B42318', t: 'No pasó' },
};

function FileView({ uid, file, check }: { uid: string; file: { label: string; path: string }; check?: ProFile['verification'][string] }) {
  const [url, setUrl] = useState('');
  const [type, setType] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const open = async () => {
    setState('loading');
    try {
      const { adminProFile } = await import('@hulul/shared/firebase');
      const r = await adminProFile(uid, file.path);
      const bytes = Uint8Array.from(atob(r.data), (ch) => ch.charCodeAt(0));
      setUrl(URL.createObjectURL(new Blob([bytes], { type: r.contentType })));
      setType(r.contentType);
      setState('idle');
    } catch (e) { setMsg(errMsg(e)); setState('error'); }
  };
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  return (
    <div className="file-card">
      <strong style={{ fontSize: 13.5 }}>{file.label}</strong>
      {check && CHECK_TONE[check.status] && (
        <span title={check.msg} style={{ alignSelf: 'flex-start', background: CHECK_TONE[check.status].bg, color: CHECK_TONE[check.status].fg, borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
          {CHECK_TONE[check.status].t}{check.current ? '' : ' (archivo anterior)'}
        </span>
      )}
      {check?.flag && <span className="muted" style={{ fontSize: 12 }}>{check.flag}</span>}
      {check && typeof check.checks.distancia === 'number' && <span className="muted" style={{ fontSize: 12 }}>Distancia de rostro: {String(check.checks.distancia)}{check.checks.pruebaDeVida ? ' · con prueba de vida' : ' · sin prueba de vida'}</span>}
      {url ? (
        type.startsWith('image/')
          // eslint-disable-next-line @next/next/no-img-element
          ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={file.label} /></a>
          : <a href={url} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ minHeight: 40 }}>Abrir PDF</a>
      ) : (
        <button type="button" className="btn btn-ghost" style={{ minHeight: 40 }} disabled={state === 'loading'} onClick={open}>{state === 'loading' ? 'Cargando…' : 'Ver'}</button>
      )}
      {state === 'error' && <span className="form-error" style={{ fontSize: 12.5 }}>{msg}</span>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card stack gap-8" style={{ padding: 18 }}><strong style={{ fontSize: 16 }}>{title}</strong>{children}</div>;
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 32%) 1fr', gap: 10, fontSize: 14 }}><span className="muted">{k}</span><span style={{ overflowWrap: 'anywhere' }}>{v}</span></div>
);
