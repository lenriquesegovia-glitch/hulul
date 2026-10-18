'use client';

import { useMemo, useState } from 'react';
import { SLOTS } from '@hulul/shared';
import type { Proposal, RescheduleAction } from '@hulul/shared/firebase';

const DAY = 86_400_000;
const WD = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "sáb 18 oct" */
export function shortDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MO[m - 1]}`;
}

/**
 * Cambiar la fecha u hora de una reserva: una parte propone, la otra acepta o
 * rechaza. Lo usan el cliente (Mi cuenta) y el profesional (agenda).
 */
export function RescheduleBox({ id, date, slot, proposal, me, other }: {
  id: string; date: string; slot: string; proposal?: Proposal; me: 'cliente' | 'profesional'; other: string;
}) {
  const days = useMemo(() => Array.from({ length: 30 }, (_, i) => new Date(Date.now() - 5 * 3_600_000 + i * DAY).toISOString().slice(0, 10)), []);
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(date);
  const [s, setS] = useState(slot);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const run = async (action: RescheduleAction) => {
    setBusy(true); setMsg('');
    try {
      const { reschedule } = await import('@hulul/shared/firebase');
      await reschedule(id, action, action === 'proponer' ? d : undefined, action === 'proponer' ? s : undefined);
      setOpen(false);
    } catch (e) {
      setMsg((e as { message?: string }).message || 'No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  if (proposal) {
    const mine = proposal.by === me;
    return (
      <div className="stack gap-8" style={{ padding: 14, borderRadius: 12, background: 'var(--surface-warm)' }}>
        <strong style={{ fontSize: 15 }}>{mine ? 'Propusiste cambiar la hora' : `${other} propone cambiar la hora`}</strong>
        <span style={{ fontSize: 14, color: 'var(--text-2)' }}>
          De {shortDay(date)} a las {slot} → <strong>{shortDay(proposal.date)} a las {proposal.slot}</strong>.
          {mine ? ` Esperando la respuesta de ${other}. Hasta entonces vale la hora original.` : ''}
        </span>
        {msg && <p role="alert" className="form-error">{msg}</p>}
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          {mine ? (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run('retirar')}>Retirar propuesta</button>
          ) : (
            <>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run('aceptar')}>{busy ? 'Guardando…' : 'Aceptar nueva hora'}</button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run('rechazar')}>Mantener la hora original</button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!open) {
    return <button type="button" className="link-btn" style={{ padding: 0, alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>Cambiar fecha u hora</button>;
  }

  return (
    <div className="stack gap-12" style={{ padding: 14, borderRadius: 12, background: 'var(--surface-warm)' }}>
      <strong style={{ fontSize: 15 }}>Proponer otra fecha u hora</strong>
      <span className="muted" style={{ fontSize: 13.5 }}>Puedes adelantar o atrasar. {other} debe aceptar; hasta entonces vale la hora original.</span>
      <div className="form-2">
        <div className="field">
          <label htmlFor={`rd-${id}`}>Día</label>
          <select id={`rd-${id}`} value={d} onChange={(e) => setD(e.target.value)}>
            {days.map((x, i) => <option key={x} value={x}>{i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : shortDay(x)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`rs-${id}`}>Hora</label>
          <select id={`rs-${id}`} value={s} onChange={(e) => setS(e.target.value)}>
            {SLOTS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
      </div>
      {msg && <p role="alert" className="form-error">{msg}</p>}
      <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" disabled={busy || (d === date && s === slot)} onClick={() => run('proponer')}>{busy ? 'Enviando…' : 'Enviar propuesta'}</button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setOpen(false)}>Volver</button>
      </div>
    </div>
  );
}
