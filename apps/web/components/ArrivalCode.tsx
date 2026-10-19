'use client';

import { useEffect, useState } from 'react';
import { ABSENT_PROBLEM_OPTIONS } from '@hulul/shared/firebase';
import { serviceCopy } from '@hulul/shared';

/** Código de llegada del cliente: se lo da al profesional cuando llega, para que empiece. */
export function ArrivalCode({ id, pro }: { id: string; pro: string }) {
  const [code, setCode] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let unsub = () => {};
    let off = false;
    import('@hulul/shared/firebase').then(({ watchArrivalCode }) => { if (!off) unsub = watchArrivalCode(id, setCode); });
    return () => { off = true; unsub(); };
  }, [id]);
  if (!code) return null;
  return (
    <div className="card row gap-16" style={{ alignItems: 'center', flexWrap: 'wrap', borderColor: 'var(--primary)', borderWidth: 2 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, letterSpacing: 8, fontWeight: 800 }} aria-label={`Código ${code.split('').join(' ')}`}>{code}</div>
      <div className="stack gap-4" style={{ flex: 1, minWidth: 200 }}>
        <strong>Tu código de llegada</strong>
        <span className="muted" style={{ fontSize: 14 }}>Dáselo a {pro} cuando esté en tu casa. Sin este código no puede empezar ni cerrar el trabajo. No lo compartas antes.</span>
      </div>
    </div>
  );
}

/** Pedir ayuda con el servicio (hasta 48 h): el pago queda en espera y HULUL revisa. */
export function ProblemBox({ id, category, absent = false }: { id: string; category?: string; absent?: boolean }) {
  const copy = serviceCopy(category);
  const options: { value: string; label: string }[] = absent ? ABSENT_PROBLEM_OPTIONS : copy.helpOptions;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!open) return <div className="actions"><button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>{absent ? 'Yo sí estaba en casa' : copy.helpButton}</button></div>;
  const send = async () => {
    setMsg('');
    if (!kind) { setMsg('Elige una opción.'); return; }
    if (text.trim().length < 15) { setMsg('Cuéntanos qué pasó (al menos 15 caracteres).'); return; }
    setBusy(true);
    try {
      const { reportProblem } = await import('@hulul/shared/firebase');
      await reportProblem({ id, kind, text: text.trim() });
    } catch (e) {
      setMsg((e as { message?: string }).message || 'No se pudo enviar.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card stack gap-12">
      <strong>{absent ? '¿Estabas en casa?' : copy.helpTitle}</strong>
      <span className="muted" style={{ fontSize: 14 }}>{absent ? 'El cobro queda en espera y HULUL revisa la llegada del profesional, el chat y las horas. Si estabas, no pagas nada.' : 'Cuéntanos y lo revisamos contigo. Mientras tanto el pago queda en espera; si el servicio no se realizó, te devolvemos lo pagado.'}</span>
      <div className="stack gap-8">
        {options.map((o) => (
          <label key={o.value} className="check"><input type="radio" name={`pb-${id}`} checked={kind === o.value} onChange={() => setKind(o.value)} /><span>{o.label}</span></label>
        ))}
      </div>
      <textarea rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Cuéntanos qué pasó" aria-label="Cuéntanos qué pasó" />
      {msg && <p role="alert" className="form-error">{msg}</p>}
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={send}>{busy ? 'Enviando…' : 'Enviar a HULUL'}</button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setOpen(false)}>Volver</button>
      </div>
    </div>
  );
}
