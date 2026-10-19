'use client';

import { useMemo, useState } from 'react';
import { RESCHEDULE_HOURS, RESCHEDULE_MINUTES } from '@hulul/shared';
import type { Proposal, RescheduleAction } from '@hulul/shared/firebase';
import { Stepper } from '@/components/Stepper';

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
        <div className="actions">
          {mine ? (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run('retirar')}>Retirar propuesta</button>
          ) : (
            <>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run('aceptar')}>{busy ? 'Guardando…' : 'Aceptar nueva hora'}</button>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run('rechazar')}>Mantener la hora original</button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!open) {
    return <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>Cambiar fecha u hora</button>;
  }
  const di = Math.max(0, days.indexOf(d));
  const hi = Math.max(0, RESCHEDULE_HOURS.indexOf(s.slice(0, 2)));
  const mi = Math.max(0, RESCHEDULE_MINUTES.indexOf(s.slice(3, 5)));
  const setH = (i: number) => setS(`${RESCHEDULE_HOURS[i]}:${RESCHEDULE_MINUTES[mi]}`);
  const setM = (i: number) => setS(`${RESCHEDULE_HOURS[hi]}:${RESCHEDULE_MINUTES[i]}`);

  return (
    <div className="stack gap-12" style={{ padding: 14, borderRadius: 12, background: 'var(--surface-warm)' }}>
      <strong style={{ fontSize: 15 }}>Proponer otra fecha u hora</strong>
      <span className="muted" style={{ fontSize: 13.5 }}>Puedes adelantar o atrasar. {other} debe aceptar; hasta entonces vale la hora original.</span>
      <Stepper label="Día" value={di === 0 ? 'Hoy' : di === 1 ? 'Mañana' : shortDay(days[di])}
        onMinus={() => setD(days[di - 1])} onPlus={() => setD(days[di + 1])} canMinus={di > 0} canPlus={di < days.length - 1} minusLabel="Día anterior" plusLabel="Día siguiente" />
      <div className="row gap-12">
        <Stepper label="Hora" value={RESCHEDULE_HOURS[hi]} onMinus={() => setH(hi - 1)} onPlus={() => setH(hi + 1)}
          canMinus={hi > 0} canPlus={hi < RESCHEDULE_HOURS.length - 1} minusLabel="Hora anterior" plusLabel="Hora siguiente" />
        <Stepper label="Minutos" value={`:${RESCHEDULE_MINUTES[mi]}`} onMinus={() => setM(mi - 1)} onPlus={() => setM(mi + 1)}
          canMinus={mi > 0} canPlus={mi < RESCHEDULE_MINUTES.length - 1} minusLabel="Menos minutos" plusLabel="Más minutos" />
      </div>
      <span style={{ textAlign: 'center', fontSize: 14.5 }}>Nueva hora: <strong>{shortDay(d)} · {s}</strong></span>
      {msg && <p role="alert" className="form-error">{msg}</p>}
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={busy || (d === date && s === slot)} onClick={() => run('proponer')}>{busy ? 'Enviando…' : 'Enviar propuesta'}</button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setOpen(false)}>Volver</button>
      </div>
    </div>
  );
}
