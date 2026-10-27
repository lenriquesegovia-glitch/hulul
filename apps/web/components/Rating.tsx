'use client';

import { useEffect, useState } from 'react';
import type { PublicReview } from '@hulul/shared/firebase';
import { hasProfanity, PROFANITY_MESSAGE } from '@hulul/shared';

const LABELS = ['', 'Muy mal', 'Mal', 'Regular', 'Bien', 'Excelente'];

/** Cinco estrellas para elegir (botones accesibles). */
export function StarInput({ value, onChange, label, size = 34 }: { value: number; onChange: (n: number) => void; label: string; size?: number }) {
  return (
    <div className="stack gap-4">
      <div role="radiogroup" aria-label={label} className="row" style={{ gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} de 5 · ${LABELS[n]}`}
            onClick={() => onChange(n)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: size, lineHeight: 1, color: n <= value ? '#E0A100' : 'var(--border)' }}>
            ★
          </button>
        ))}
      </div>
      <span className="muted" style={{ fontSize: 13.5, minHeight: 18 }}>{LABELS[value] ?? ''}</span>
    </div>
  );
}

/**
 * El cliente califica al profesional (obligatorio) y a HULUL (opcional). Al
 * enviar se cierra el servicio. Sirve para que otros clientes elijan bien y
 * para que HULUL mejore y suspenda a quien trabaja mal.
 */
export function RatingBox({ id, proName, onDone }: { id: string; proName: string; onDone?: () => void }) {
  const [pro, setPro] = useState(0);
  const [proText, setProText] = useState('');
  const [app, setApp] = useState(0);
  const [appText, setAppText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const send = async () => {
    setMsg('');
    if (!pro) { setMsg(`Elige cuántas estrellas le das a ${proName}.`); return; }
    if (pro <= 2 && proText.trim().length < 10) { setMsg('Cuéntanos qué no te gustó (al menos 10 caracteres). Nos ayuda a mejorar.'); return; }
    if (hasProfanity(proText) || hasProfanity(appText)) { setMsg(PROFANITY_MESSAGE); return; }
    setBusy(true);
    try {
      const { rateService } = await import('@hulul/shared/firebase');
      await rateService({ id, proStars: pro, proComment: proText.trim(), ...(app ? { appStars: app, appComment: appText.trim() } : {}) });
      onDone?.();
    } catch (e) {
      setMsg((e as { message?: string }).message || 'No se pudo enviar. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card stack gap-16" style={{ borderColor: 'var(--primary)', borderWidth: 2 }}>
      <div className="stack gap-4">
        <strong style={{ fontSize: 18 }}>¿Cómo te fue con {proName}?</strong>
        <span className="muted" style={{ fontSize: 14 }}>Tu calificación es pública en su perfil y ayuda a otros a elegir. Quien acumula malas calificaciones deja de recibir trabajos.</span>
      </div>
      <StarInput value={pro} onChange={setPro} label={`Calificación de ${proName}`} />
      <div className="field">
        <label htmlFor={`rp-${id}`}>{pro && pro <= 2 ? '¿Qué no te gustó?' : 'Comentario (opcional)'}</label>
        <textarea id={`rp-${id}`} rows={2} maxLength={600} value={proText} onChange={(e) => setProText(e.target.value)}
          placeholder="Puntual, amable, muy cuidadoso…" />
      </div>
      <div className="stack gap-8" style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <strong>¿Y la app HULUL? (opcional)</strong>
        <StarInput value={app} onChange={setApp} label="Calificación de la app HULUL" size={28} />
        {app > 0 && (
          <div className="field">
            <label htmlFor={`ra-${id}`}>¿Qué mejorarías?</label>
            <textarea id={`ra-${id}`} rows={2} maxLength={600} value={appText} onChange={(e) => setAppText(e.target.value)} placeholder="Lo que te gustó o lo que te costó usar" />
          </div>
        )}
      </div>
      {msg && <p role="alert" className="form-error">{msg}</p>}
      <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={send}>{busy ? 'Enviando…' : 'Enviar calificación'}</button>
    </div>
  );
}

/** El profesional califica al cliente; el promedio es visible para sus profesionales, los comentarios siguen privados. */
export function RateClientBox({ id, clientName }: { id: string; clientName: string }) {
  const [n, setN] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const send = async () => {
    if (!n) { setMsg('Elige las estrellas.'); return; }
    if (hasProfanity(text)) { setMsg(PROFANITY_MESSAGE); return; }
    setBusy(true); setMsg('');
    try {
      const { rateClient } = await import('@hulul/shared/firebase');
      await rateClient({ id, stars: n, comment: text.trim() });
    } catch (e) {
      setMsg((e as { message?: string }).message || 'No se pudo enviar.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack gap-8" style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <strong>Califica a {clientName || 'el cliente'}</strong>
      <span className="muted" style={{ fontSize: 13 }}>El promedio y la cantidad de calificaciones serán visibles para los profesionales de sus reservas. Tu comentario queda privado para HULUL.</span>
      <StarInput value={n} onChange={setN} label="Calificación del cliente" size={28} />
      {n > 0 && <textarea rows={2} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} placeholder="Comentario (opcional)" aria-label="Comentario sobre el cliente" />}
      {msg && <p role="alert" className="form-error">{msg}</p>}
      <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={send}>{busy ? 'Enviando…' : 'Enviar'}</button>
    </div>
  );
}

/** Reseñas públicas de un profesional. */
export function ReviewsList({ uid, first }: { uid: string; first: string }) {
  const [list, setList] = useState<PublicReview[] | null>(null);
  useEffect(() => {
    import('@hulul/shared/firebase').then(({ proReviews }) => proReviews(uid)).then(setList).catch(() => setList([]));
  }, [uid]);
  if (list === null) return <p className="muted">Cargando reseñas…</p>;
  if (!list.length) return <p className="muted">{first} es nuevo en HULUL. Las reseñas aparecen aquí después de cada servicio.</p>;
  return (
    <div className="stack gap-12">
      {list.map((r) => (
        <div key={r.id} className="card stack gap-4" style={{ padding: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
            <strong>{r.clientName}</strong>
            <span style={{ color: '#E0A100' }} aria-label={`${r.rating} de 5`}>{'★'.repeat(r.rating)}<span style={{ color: 'var(--border)' }}>{'★'.repeat(5 - r.rating)}</span></span>
          </div>
          {r.text && <p style={{ margin: 0, color: 'var(--text-2)' }}>{r.text}</p>}
          {r.createdAt && <span className="muted" style={{ fontSize: 12.5 }}>{r.createdAt.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
        </div>
      ))}
    </div>
  );
}
