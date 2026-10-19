'use client';

import { useState } from 'react';
import type { Delay } from '@hulul/shared/firebase';
import { Stepper } from '@/components/Stepper';

const OPTIONS = [10, 15, 20, 30, 45, 60, 90];
const plus = (slot: string, min: number) => {
  const [h, m] = slot.split(':').map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
async function run(data: Parameters<typeof import('@hulul/shared/firebase').delayAction>[0]) {
  const { delayAction } = await import('@hulul/shared/firebase');
  await delayAction(data);
}
const errText = (e: unknown) => (e as { message?: string }).message || 'No se pudo guardar.';

/** Profesional: avisar que llegará tarde (el cliente acepta o cancela sin costo). */
export function DelayPro({ id, slot, delay, client }: { id: string; slot: string; delay?: Delay; client: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [i, setI] = useState(1);
  if (delay?.status === 'propuesto') return <span className="muted" style={{ fontSize: 13.5 }}>⏱ Avisaste {delay.added ?? delay.minutes} min de retraso. Esperando que {client} acepte.</span>;
  const accepted = delay?.status === 'aceptado';
  return (
    <div className="stack gap-8" style={{ width: '100%' }}>
      {accepted && <span style={{ fontSize: 14 }}>⏱ {client} aceptó tu retraso: te espera a las <strong>{plus(slot, delay!.minutes)}</strong>. Si llegas más tarde, es falta.</span>}
      {!open ? (
        <div className="actions"><button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>Avisar que llegaré tarde</button></div>
      ) : (
        <div className="notice stack gap-8">
          <strong>¿Cuántos minutos tarde?</strong>
          <div style={{ maxWidth: 320 }}>
            <Stepper value={`+${OPTIONS[i]} min`} onMinus={() => setI(i - 1)} onPlus={() => setI(i + 1)} canMinus={i > 0} canPlus={i < OPTIONS.length - 1} minusLabel="Menos minutos" plusLabel="Más minutos" />
          </div>
          <span style={{ fontSize: 14 }}>Llegarías a las <strong>{plus(slot, (accepted ? delay!.minutes : 0) + OPTIONS[i])}</strong></span>
          <span className="muted" style={{ fontSize: 13 }}>{client} decide: si acepta, la cita se corre; si no puede esperar, se cancela sin costo para él y es una falta para ti. Avisar a tiempo te protege: si no avisas y llegas tarde, no podrás cobrar "cliente ausente".</span>
          {msg && <p role="alert" className="form-error">{msg}</p>}
          <div className="actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={async () => {
              setBusy(true); setMsg('');
              try { await run({ id, action: 'proponer', minutes: OPTIONS[i] }); setOpen(false); } catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
            }}>{busy ? 'Enviando…' : 'Enviar aviso al cliente'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Volver</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Cliente: aceptar o rechazar el retraso que avisó el profesional. */
export function DelayClient({ id, slot, delay, pro }: { id: string; slot: string; delay?: Delay; pro: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!delay || delay.status === 'rechazado') return null;
  if (delay.status === 'aceptado') return <p className="muted" style={{ fontSize: 14 }}>⏱ Aceptaste que {pro} llegue a las {plus(slot, delay.minutes)}.</p>;
  const act = async (action: 'aceptar' | 'rechazar') => {
    setBusy(true); setMsg('');
    try { await run({ id, action }); } catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="notice stack gap-8" role="alert">
      <strong>⏱ {pro} llegará {delay.added ?? delay.minutes} min tarde (aprox. {plus(slot, delay.minutes)})</strong>
      <span style={{ fontSize: 14 }}>Si aceptas, la cita se corre a esa hora y después ya no podrás cancelar gratis por el retraso. Si no puedes esperar, cancela ahora sin costo.</span>
      {msg && <p role="alert" className="form-error">{msg}</p>}
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act('aceptar')}>Acepto, lo espero</button>
        <button type="button" className="btn btn-danger" disabled={busy} onClick={() => act('rechazar')}>No puedo esperar: cancelar sin costo</button>
      </div>
    </div>
  );
}
