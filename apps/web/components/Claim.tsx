'use client';

import { useEffect, useState } from 'react';
import { CLAIM_RULES, CLAIM_STATUS_LABEL, PRO_PROBLEM_OPTIONS, type Claim } from '@hulul/shared/firebase';
import { PhotoPicker } from '@/components/PhotoPicker';
import { useUser } from '@/lib/auth';

/** Fecha y hora en Ecuador: "lun 27 oct, 15:40". */
export const whenEc = (ms: number) => new Date(ms).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Thumbs({ urls }: { urls: string[] }) {
  if (!urls?.length) return null;
  return (
    <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
      {urls.map((u, i) => (
        <a key={u} href={u} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt={`Foto ${i + 1}`} style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
        </a>
      ))}
    </div>
  );
}

/**
 * Expediente del reclamo para el cliente o el profesional: motivo, versiones,
 * plazos y decisión. La otra parte responde aquí (texto y fotos).
 */
export function ClaimCard({ id, side }: { id: string; side: 'cliente' | 'profesional' }) {
  const [c, setC] = useState<Claim | null | undefined>(undefined);
  useEffect(() => {
    let unsub = () => {};
    let off = false;
    import('@hulul/shared/firebase').then(({ watchClaim }) => { if (!off) unsub = watchClaim(id, setC); });
    return () => { off = true; unsub(); };
  }, [id]);
  if (c === undefined) return null;
  if (c === null) {
    return <div className="card stack gap-8"><strong>Reclamo en revisión</strong><span className="muted" style={{ fontSize: 14 }}>HULUL revisa lo que pasó y te avisa la decisión.</span></div>;
  }
  const mine = c.openedBy === side;
  const otherName = side === 'cliente' ? c.proName.split(' ')[0] || 'el profesional' : c.clientName.split(' ')[0] || 'el cliente';
  const iRespond = !mine && !c.response && c.status !== 'resuelto';
  const d = c.decision;
  return (
    <div className="card stack gap-12" style={{ borderColor: c.status === 'resuelto' ? 'var(--border)' : 'var(--copper)', borderWidth: 2 }}>
      <div className="row gap-8" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <strong>Reclamo {c.code}</strong>
        <span className="muted" style={{ fontSize: 13.5, fontWeight: 700 }}>{CLAIM_STATUS_LABEL[c.status] ?? c.status}</span>
      </div>
      <div className="stack gap-4">
        <span style={{ fontSize: 13.5 }} className="muted">{mine ? 'Lo abriste tú' : `Lo abrió ${otherName}`} · {whenEc(c.openedAt)}</span>
        <strong style={{ fontSize: 15 }}>{c.kindLabel}</strong>
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.text}</p>
        <Thumbs urls={c.photos} />
      </div>
      {c.response ? (
        <div className="stack gap-4" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <span style={{ fontSize: 13.5 }} className="muted">{mine ? `Versión de ${otherName}` : 'Tu versión'} · {whenEc(c.response.at)}</span>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.response.text}</p>
          <Thumbs urls={c.response.photos} />
        </div>
      ) : iRespond ? (
        <RespondBox id={id} due={c.responseDueAt} />
      ) : c.status !== 'resuelto' ? (
        <span className="muted" style={{ fontSize: 14 }}>{c.responseMissed ? `${otherName} no respondió a tiempo. HULUL decide con la información que hay.` : `Esperamos la versión de ${otherName} hasta el ${whenEc(c.responseDueAt)}.`}</span>
      ) : null}
      {d ? (
        <div className="stack gap-4" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <strong>Decisión de HULUL: {d.outcome === 'cliente' ? 'a favor del cliente' : 'a favor del profesional'}</strong>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{d.note}</p>
          {side === 'cliente' && !!d.creditoCliente && <span style={{ fontSize: 14 }}>Crédito para tu próximo servicio: ${Number(d.creditoCliente).toFixed(2)}</span>}
          {side === 'profesional' && !!d.multaPro && <span style={{ fontSize: 14 }}>Multa: ${Number(d.multaPro).toFixed(2)}</span>}
          {((side === 'profesional' && d.faltaPro) || (side === 'cliente' && d.faltaCliente)) && <span style={{ fontSize: 14 }}>Se registró una falta en tu cuenta.</span>}
        </div>
      ) : (
        <span className="muted" style={{ fontSize: 13.5 }}>
          HULUL revisa la llegada, los timbres, el código, las fotos, el informe y el chat, y decide a más tardar el {whenEc(c.resolveDueAt)}.
          {c.moneyHeld ? ' Mientras tanto el pago queda retenido.' : ''} Tus datos solo los ve el equipo de HULUL que revisa el caso.
        </span>
      )}
    </div>
  );
}

function RespondBox({ id, due }: { id: string; due: number }) {
  const user = useUser();
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const send = async () => {
    setMsg('');
    if (text.trim().length < 15) { setMsg('Cuéntanos tu versión (al menos 15 caracteres).'); return; }
    setBusy(true);
    try {
      const { respondClaim } = await import('@hulul/shared/firebase');
      await respondClaim({ id, text: text.trim(), photos });
    } catch (e) {
      setMsg((e as { message?: string }).message || 'No se pudo enviar.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack gap-8" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <strong>Tu versión</strong>
      <span className="muted" style={{ fontSize: 13.5 }}>Tienes hasta el {whenEc(due)}. Cuenta lo que pasó con calma y adjunta fotos si las tienes. Solo se responde una vez.</span>
      <textarea rows={4} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Lo que pasó desde tu lado" aria-label="Tu versión" />
      {user && <PhotoPicker folder={`reclamos/${user.uid}/${id}`} max={CLAIM_RULES.maxPhotos} value={photos} onChange={setPhotos} label="Fotos (opcional)" />}
      {msg && <p role="alert" className="form-error">{msg}</p>}
      <div className="actions"><button type="button" className="btn btn-primary" disabled={busy} onClick={send}>{busy ? 'Enviando…' : 'Enviar mi versión'}</button></div>
    </div>
  );
}

/** Formulario de reclamo con fotos. side = quién reclama. */
export function ReportForm({ id, side, options, title, help, onCancel }: {
  id: string; side: 'cliente' | 'profesional'; options: { value: string; label: string }[]; title: string; help: string; onCancel: () => void;
}) {
  const user = useUser();
  const [kind, setKind] = useState('');
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const send = async () => {
    setMsg('');
    if (!kind) { setMsg('Elige una opción.'); return; }
    if (text.trim().length < 15) { setMsg('Cuéntanos qué pasó (al menos 15 caracteres).'); return; }
    setBusy(true);
    try {
      const fb = await import('@hulul/shared/firebase');
      await (side === 'cliente' ? fb.reportProblem : fb.reportProblemPro)({ id, kind, text: text.trim(), photos });
    } catch (e) {
      setMsg((e as { message?: string }).message || 'No se pudo enviar.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card stack gap-12">
      <strong>{title}</strong>
      <span className="muted" style={{ fontSize: 14 }}>{help}</span>
      <div className="stack gap-8">
        {options.map((o) => (
          <label key={o.value} className="check"><input type="radio" name={`pb-${side}-${id}`} checked={kind === o.value} onChange={() => setKind(o.value)} /><span>{o.label}</span></label>
        ))}
      </div>
      <textarea rows={3} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Cuéntanos qué pasó" aria-label="Cuéntanos qué pasó" />
      {user && <PhotoPicker folder={`reclamos/${user.uid}/${id}`} max={CLAIM_RULES.maxPhotos} value={photos} onChange={setPhotos} label="Fotos de respaldo (opcional)" help="Ayudan a decidir más rápido." />}
      <span className="muted" style={{ fontSize: 13 }}>La otra parte tiene {CLAIM_RULES.responseHours} h para dar su versión y HULUL decide en máximo {CLAIM_RULES.resolveHours} h.</span>
      {msg && <p role="alert" className="form-error">{msg}</p>}
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={send}>{busy ? 'Enviando…' : 'Enviar a HULUL'}</button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>Volver</button>
      </div>
    </div>
  );
}

/** El profesional reporta un problema con el cliente. */
export function ProReportBox({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>Reportar un problema con el cliente</button>;
  return <ReportForm id={id} side="profesional" options={PRO_PROBLEM_OPTIONS} title="¿Qué pasó con el cliente?" help="HULUL revisa el caso con la llegada, los timbres, el chat y las fotos. El cliente podrá dar su versión." onCancel={() => setOpen(false)} />;
}
