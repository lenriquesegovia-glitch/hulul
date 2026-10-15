'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  formatUSD,
  getCategory,
  getProfessional,
  MAX_HOURS,
  MIN_HOURS,
  nextDays,
  PAYMENT_OPTIONS,
  quote,
  SLOTS,
  type PaymentMethod,
} from '@hulul/shared';
import { Icon } from '@/components/Icon';
import { DEMO_MODE } from '@/lib/site';

/**
 * Reserva desde la web, el mismo flujo que la app.
 * Guarda la reserva en Firestore (`bookings`) con la prueba del consentimiento.
 * Pendiente: redirigir a la pasarela de pago antes de confirmar.
 */
export function BookingForm({ proId }: { proId: string }) {
  const pro = getProfessional(proId)!;
  const cat = getCategory(pro.category)!;
  const days = useMemo(() => nextDays(7), []);

  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState(1);
  const [hours, setHours] = useState(2);
  const [payment, setPayment] = useState<PaymentMethod>('tarjeta');
  const [done, setDone] = useState<{ name: string; id: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const q = quote(pro.hourlyRate, hours, pro.minimumBooking);
  const belowMinimum = pro.hourlyRate * hours < pro.minimumBooking;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    const data = new FormData(e.currentTarget);
    const get = (k: string) => String(data.get(k) ?? '').trim();
    setSending(true);
    setError('');
    try {
      // Firebase se carga solo al confirmar, para que la página abra rápido.
      const { saveBooking, dateInDays } = await import('@hulul/shared/firebase');
      const id = await saveBooking({
        source: 'web',
        professionalId: pro.id,
        professionalName: pro.name,
        category: pro.category,
        date: dateInDays(day),
        slot: SLOTS[slot],
        hours,
        address: get('direccion'),
        notes: get('descripcion'),
        contactName: get('nombre'),
        contactPhone: get('celular'),
        contactEmail: get('correo'),
        paymentMethod: payment,
        subtotal: q.subtotal,
        fee: q.fee,
        iva: q.iva,
        total: q.total,
        consentMarketing: data.get('acepta_promociones') === 'on',
        demo: DEMO_MODE,
      });
      setDone({ name: get('nombre').split(' ')[0], id });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('No pudimos registrar tu reserva. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="stack gap-24" role="status">
        <div className="card stack gap-12" style={{ alignItems: 'center', textAlign: 'center', padding: 32 }}>
          <span className="avatar" style={{ width: 64, height: 64, background: 'var(--success-soft)' }}>
            <Icon name="check" size={32} color="var(--success)" strokeWidth={2.4} />
          </span>
          <h2 style={{ fontSize: 26 }}>Reserva confirmada{done.name ? `, ${done.name}` : ''}</h2>
          <p style={{ color: 'var(--text-2)' }}>
            {pro.name} llegará {days[day].long} a las {SLOTS[slot]}. {cat.name} · {hours} h · {formatUSD(q.total)}
          </p>
          <p className="muted" style={{ fontSize: 13.5 }}>Código de reserva: {done.id.slice(0, 8).toUpperCase()}</p>
          {DEMO_MODE && (
            <p className="pill pill-warm">Versión de prueba: la reserva quedó registrada, pero no se hizo ningún cobro.</p>
          )}
        </div>
        <div className="card stack gap-12">
          <h3 style={{ fontSize: 18 }}>Qué sigue</h3>
          <ol className="stack gap-8" style={{ margin: 0, paddingLeft: 20, color: 'var(--text-2)' }}>
            <li>Te enviamos la confirmación por WhatsApp y correo.</li>
            <li>El día del servicio verás cuando el profesional esté en camino.</li>
            <li>Al terminar, apruebas el trabajo y recién ahí se libera el pago.</li>
          </ol>
        </div>
        <Link href="/" className="btn btn-ghost" style={{ alignSelf: 'flex-start' }}>Volver al inicio</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="stack gap-32">
      <fieldset className="stack gap-12 fs">
        <legend className="fs-title">1. ¿Cuándo?</legend>
        <span className="muted" style={{ fontSize: 14, fontWeight: 700 }}>Día</span>
        <div className="chip-row" role="radiogroup" aria-label="Día">
          {days.map((d, i) => (
            <button key={i} type="button" role="radio" aria-checked={i === day} aria-label={d.long}
              className={`chip-day ${i === day ? 'on' : ''}`} onClick={() => setDay(i)}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{d.top}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700 }}>{d.num}</span>
            </button>
          ))}
        </div>
        <span className="muted" style={{ fontSize: 14, fontWeight: 700 }}>Hora de llegada</span>
        <div className="slot-grid" role="radiogroup" aria-label="Hora de llegada">
          {SLOTS.map((t, i) => (
            <button key={t} type="button" role="radio" aria-checked={i === slot}
              className={`chip-slot ${i === slot ? 'on' : ''}`} onClick={() => setSlot(i)}>{t}</button>
          ))}
        </div>
        <div className="card row gap-16" style={{ justifyContent: 'space-between', padding: 16, flexWrap: 'wrap' }}>
          <div className="stack">
            <strong>Horas de servicio</strong>
            <span className="muted" style={{ fontSize: 13.5 }}>Puedes ampliar durante el servicio</span>
          </div>
          <div className="row gap-12">
            <button type="button" className="stepper" aria-label="Quitar una hora" onClick={() => setHours((h) => Math.max(MIN_HOURS, h - 1))}>−</button>
            <span aria-live="polite" style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{hours}</span>
            <button type="button" className="stepper" aria-label="Añadir una hora" onClick={() => setHours((h) => Math.min(MAX_HOURS, h + 1))}>+</button>
          </div>
        </div>
      </fieldset>

      <fieldset className="stack gap-16 fs">
        <legend className="fs-title">2. ¿Dónde y qué necesitas?</legend>
        <div className="field">
          <label htmlFor="direccion">Dirección del servicio</label>
          <input id="direccion" name="direccion" required minLength={8} maxLength={300} autoComplete="street-address" placeholder="Urbanización, manzana y villa" />
        </div>
        <div className="field">
          <label htmlFor="descripcion">Describe lo que necesitas</label>
          <textarea id="descripcion" name="descripcion" rows={3} maxLength={1000} placeholder="Ej.: 2 splits de 12.000 BTU, uno gotea agua" />
        </div>
      </fieldset>

      <fieldset className="stack gap-16 fs">
        <legend className="fs-title">3. Tus datos</legend>
        <p className="muted" style={{ fontSize: 14 }}>No necesitas descargar la app. Te enviaremos la confirmación por WhatsApp y correo.</p>
        <div className="field">
          <label htmlFor="nombre">Nombre y apellido</label>
          <input id="nombre" name="nombre" required minLength={2} maxLength={120} autoComplete="name" />
        </div>
        <div className="form-2">
          <div className="field">
            <label htmlFor="celular">Celular (WhatsApp)</label>
            <input id="celular" name="celular" type="tel" inputMode="tel" required pattern="0?9[0-9]{8}" placeholder="09XXXXXXXX" autoComplete="tel" />
          </div>
          <div className="field">
            <label htmlFor="correo">Correo electrónico</label>
            <input id="correo" name="correo" type="email" required maxLength={160} autoComplete="email" />
          </div>
        </div>
      </fieldset>

      <fieldset className="stack gap-12 fs">
        <legend className="fs-title">4. Pago</legend>
        <div className="stack gap-8" role="radiogroup" aria-label="Forma de pago">
          {PAYMENT_OPTIONS.map((m) => (
            <label key={m.value} className={`pay-option ${m.value === payment ? 'on' : ''}`}>
              <input type="radio" name="pago" value={m.value} checked={m.value === payment} onChange={() => setPayment(m.value)} />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
        <div className="card stack gap-8" style={{ padding: 18 }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
            <span>{belowMinimum ? `Reserva mínima (${hours} h × $${pro.hourlyRate})` : `${hours} h × $${pro.hourlyRate}`}</span>
            <span>{formatUSD(q.subtotal)}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}><span>Tarifa de protección HULUL</span><span>{formatUSD(q.fee)}</span></div>
          <div className="row" style={{ justifyContent: 'space-between' }}><span>IVA 15%</span><span>{formatUSD(q.iva)}</span></div>
          <div className="row" style={{ justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)', fontWeight: 700, fontSize: 18 }}>
            <span>Total</span><span>{formatUSD(q.total)}</span>
          </div>
          <p className="muted" style={{ fontSize: 13.5 }}>El pago queda retenido por HULUL y se libera al profesional cuando apruebas el trabajo.</p>
        </div>
      </fieldset>

      <div className="stack gap-12">
        <label className="check">
          <input type="checkbox" name="acepta_privacidad" required />
          <span>
            Acepto la <Link href="/legal/privacidad" target="_blank">Política de privacidad</Link> y los{' '}
            <Link href="/legal/terminos" target="_blank">Términos y condiciones</Link>, y que HULUL comparta mi nombre, la dirección y la descripción con {pro.name} para realizar este servicio.
          </span>
        </label>
        <label className="check">
          <input type="checkbox" name="acepta_promociones" />
          <span>Quiero recibir novedades y promociones de HULUL (opcional).</span>
        </label>
      </div>

      {error && <p role="alert" style={{ color: 'var(--primary)', fontWeight: 600 }}>{error}</p>}
      <button type="submit" className="btn btn-primary" style={{ minHeight: 54, fontSize: 16 }} disabled={sending} aria-busy={sending}>
        {sending ? 'Registrando tu reserva…' : `Confirmar y pagar ${formatUSD(q.total)}`}
      </button>
    </form>
  );
}
