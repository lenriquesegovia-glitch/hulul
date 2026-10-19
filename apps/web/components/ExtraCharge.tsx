'use client';

import { useState } from 'react';
import { extraQuote, formatUSD, MAX_EXTRA, MIN_EXTRA } from '@hulul/shared';
import { EXTRA_STATUS_LABEL, type ExtraAction, type ExtraCharge } from '@hulul/shared/firebase';

async function run(data: ExtraAction) {
  const { extraCharge } = await import('@hulul/shared/firebase');
  await extraCharge(data);
}
const errText = (e: unknown) => (e as { message?: string }).message || 'No se pudo guardar. Inténtalo de nuevo.';

function Lines({ x, pro = false }: { x: ExtraCharge; pro?: boolean }) {
  return (
    <div className="stack gap-4" style={{ fontSize: 15 }}>
      <span style={{ color: 'var(--text-2)' }}>{x.description}</span>
      <div className="row" style={{ justifyContent: 'space-between' }}><span>Monto</span><span>{formatUSD(x.amount)}</span></div>
      <div className="row" style={{ justifyContent: 'space-between' }}><span>IVA 15%</span><span>{formatUSD(x.iva)}</span></div>
      <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700 }}><span>Total</span><span>{formatUSD(x.total)}</span></div>
      {pro && <span className="muted" style={{ fontSize: 13.5 }}>Te queda {formatUSD(x.amount - x.commission)} (HULUL retiene {formatUSD(x.commission)} de comisión).</span>}
    </div>
  );
}

/** Lo que ve el cliente: aceptar (tarjeta o efectivo) o rechazar el cobro adicional. */
export function ExtraForClient({ id, extra, proName }: { id: string; extra?: ExtraCharge; proName: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!extra) return null;
  const act = async (data: ExtraAction) => {
    setBusy(true); setMsg('');
    try { await run(data); } catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="card stack gap-12">
      <div className="row gap-12" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 17 }}>Cobro adicional de {proName}</strong>
        <span className={`pill ${['pagado', 'pagado_efectivo'].includes(extra.status) ? 'pill-success' : 'pill-warm'}`}>{EXTRA_STATUS_LABEL[extra.status]}</span>
      </div>
      <Lines x={extra} />
      {extra.status === 'propuesto' && (
        <>
          <span className="muted" style={{ fontSize: 13.5 }}>Págalo por la app para que quede registrado en tu reserva. HULUL no garantiza el trabajo adicional: califica al profesional según cómo lo hizo.</span>
          {msg && <p role="alert" className="form-error">{msg}</p>}
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act({ id, action: 'aceptar', method: 'tarjeta' })}>Aceptar y pagar con tarjeta (recomendado)</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => act({ id, action: 'aceptar', method: 'efectivo' })}>Aceptar y pagar en efectivo</button>
            <button type="button" className="link-btn" disabled={busy} onClick={() => act({ id, action: 'rechazar' })}>No acepto</button>
          </div>
        </>
      )}
      {extra.status === 'por_cobrar' && <span className="muted" style={{ fontSize: 13.5 }}>Se cobrará con tu tarjeta. Versión de prueba: todavía no se hace el cobro real.</span>}
      {extra.status === 'efectivo_pendiente' && <span className="muted" style={{ fontSize: 13.5 }}>Págale {formatUSD(extra.total)} en efectivo a {proName}. Él confirmará en su agenda que lo recibió.</span>}
    </div>
  );
}

/** Lo que ve el profesional: agregar un cobro adicional y confirmar el pago en efectivo. */
export function ExtraForPro({ id, status, extra }: { id: string; status: string; extra?: ExtraCharge }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const canAdd = ['en_curso', 'por_aprobar'].includes(status) && (!extra || extra.status === 'rechazado');
  const act = async (data: ExtraAction) => {
    setBusy(true); setMsg('');
    try { await run(data); setOpen(false); } catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
  };

  if (extra && extra.status !== 'rechazado') {
    return (
      <div className="stack gap-8" style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <div className="row gap-12" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <strong>Cobro adicional</strong>
          <span className={`pill ${['pagado', 'pagado_efectivo'].includes(extra.status) ? 'pill-success' : 'pill-warm'}`}>{EXTRA_STATUS_LABEL[extra.status]}</span>
        </div>
        <Lines x={extra} pro />
        {msg && <p role="alert" className="form-error">{msg}</p>}
        {extra.status === 'efectivo_pendiente' && (
          <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => act({ id, action: 'recibi_efectivo' })}>
            {busy ? 'Guardando…' : `Recibí ${formatUSD(extra.total)} en efectivo`}
          </button>
        )}
      </div>
    );
  }
  if (!canAdd) return null;

  const n = Number(amount.replace(',', '.'));
  const q = Number.isFinite(n) && n > 0 ? extraQuote(n) : null;
  const send = () => {
    if (!q || n < MIN_EXTRA || n > MAX_EXTRA) { setMsg(`Escribe un monto entre $${MIN_EXTRA} y $${MAX_EXTRA}.`); return; }
    if (description.trim().length < 10) { setMsg('Explica qué incluye el cobro (al menos 10 caracteres).'); return; }
    act({ id, action: 'proponer', amount: q.amount, description: description.trim() });
  };

  return (
    <div className="stack gap-8" style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      {extra?.status === 'rechazado' && <span className="muted" style={{ fontSize: 13.5 }}>El cliente no aceptó el cobro anterior ({formatUSD(extra.total)}). Puedes proponer otro.</span>}
      {!open ? (
        <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>+ Agregar cobro adicional</button>
      ) : (
        <>
          <strong>Cobro adicional</strong>
          <span className="muted" style={{ fontSize: 13.5 }}>Repuestos, más horas de trabajo u otra visita que acordaste con el cliente. Él lo acepta y lo paga en la app (tarjeta o efectivo). HULUL retiene la misma comisión que en la visita.</span>
          <div className="field">
            <label htmlFor={`xa-${id}`}>Monto sin IVA (USD)</label>
            <input id={`xa-${id}`} inputMode="decimal" value={amount} placeholder="35" onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, '').slice(0, 7))} />
          </div>
          <div className="field">
            <label htmlFor={`xd-${id}`}>¿Qué incluye?</label>
            <textarea id={`xd-${id}`} rows={2} maxLength={300} value={description} placeholder="Ej.: capacitor de 35 µF y 1 hora más de trabajo" onChange={(e) => setDescription(e.target.value)} />
          </div>
          {q && <span className="muted" style={{ fontSize: 13.5 }}>El cliente paga {formatUSD(q.total)} (con IVA). Te queda {formatUSD(q.proPayout)}.</span>}
          {msg && <p role="alert" className="form-error">{msg}</p>}
          <div className="row gap-8">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={send}>{busy ? 'Enviando…' : 'Enviar al cliente'}</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button>
          </div>
        </>
      )}
    </div>
  );
}
