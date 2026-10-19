'use client';

import { useEffect, useState } from 'react';
import { ABSENT_PROBLEM_OPTIONS, PROBLEM_OPTIONS } from '@hulul/shared/firebase';

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

/** Reportar un problema (hasta 48 h): el pago queda retenido y HULUL revisa. */
export function ProblemBox({ id, absent = false }: { id: string; absent?: boolean }) {
  const options: { value: string; label: string }[] = absent ? ABSENT_PROBLEM_OPTIONS : PROBLEM_OPTIONS;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!open) return <div className="actions"><button type="button" className="btn btn-danger" onClick={() => setOpen(true)}>Reportar un problema</button></div>;
  const send = async () => {
    setMsg('');
    if (!kind) { setMsg('Elige qué pasó.'); return; }
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
      <strong>Reportar un problema</strong>
      <span className="muted" style={{ fontSize: 14 }}>{absent ? 'El cobro por "cliente ausente" queda retenido y HULUL revisa la ubicación del profesional al marcar su llegada, el chat y las horas. Si estabas, no pagas nada.' : 'El pago queda retenido y HULUL revisa el código de llegada, la ubicación, las fotos y el chat. Si el trabajo no se hizo, te devolvemos lo pagado.'}</span>
      <div className="stack gap-8">
        {options.map((o) => (
          <label key={o.value} className="check"><input type="radio" name={`pb-${id}`} checked={kind === o.value} onChange={() => setKind(o.value)} /><span>{o.label}</span></label>
        ))}
      </div>
      <textarea rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Qué pasó, a qué hora, qué te dijo…" aria-label="Detalle del problema" />
      {msg && <p role="alert" className="form-error">{msg}</p>}
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={send}>{busy ? 'Enviando…' : 'Enviar reporte'}</button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setOpen(false)}>Volver</button>
      </div>
    </div>
  );
}
