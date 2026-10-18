'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  dayAvailable,
  firstAvailable,
  formatUSD,
  getCategory,
  getProfessional,
  MAX_HOURS,
  MIN_HOURS,
  BOOKING_DAYS,
  categoryPricing,
  nextDays,
  PAYMENT_OPTIONS,
  quote,
  SLOTS,
  slotAvailable,
  type LatLng,
  type PaymentMethod,
} from '@hulul/shared';
import { Icon } from '@/components/Icon';
import { AddressInput } from '@/components/AddressInput';
import { LocationPicker } from '@/components/LocationPicker';
import { Notice } from '@/components/Notice';
import { DEMO_MODE } from '@/lib/site';

/**
 * Reserva desde la web, el mismo flujo que la app.
 * Guarda la reserva en Firestore (`bookings`) con la prueba del consentimiento.
 * Pendiente: redirigir a la pasarela de pago antes de confirmar.
 */
const OTHER = 'Otro trabajo';

/** Estado del servicio, estilo seguimiento de paquetes. */
function Timeline({ steps }: { steps: { t: string; d: string; state?: 'done' | 'now' }[] }) {
  return (
    <ol className="timeline">
      {steps.map((s) => (
        <li key={s.t} className={s.state ?? ''}>
          <span className="tl-dot">{s.state === 'done' && <Icon name="check" size={14} color="#fff" strokeWidth={3} />}</span>
          <div className="stack">
            <strong>{s.t}</strong>
            <span className="muted" style={{ fontSize: 13.5 }}>{s.d}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Fecha AAAA-MM-DD de dentro de `offset` días (hora local). */
function isoDay(from: Date, offset: number): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Días entre hoy y una fecha AAAA-MM-DD. */
function dayOffset(from: Date, iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return -1;
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000);
}

/** Largo máximo de la descripción (el mismo límite que las reglas de Firestore). */
const NOTES_MAX = 1000;

export function BookingForm({ proId }: { proId: string }) {
  const pro = getProfessional(proId)!;
  const cat = getCategory(pro.category)!;
  // La hora real se toma en el navegador, no al publicar la página.
  const [now, setNow] = useState<Date | null>(null);
  const days = useMemo(() => (now ? nextDays(BOOKING_DAYS, now) : []), [now]);

  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState(-1);

  useEffect(() => {
    const n = new Date();
    const first = firstAvailable(n);
    setNow(n);
    setDay(first.day);
    setSlot(first.slot);
  }, []);

  const dayRow = useRef<HTMLDivElement>(null);
  const pickDay = (i: number) => {
    setDay(i);
    // Si se eligió en el calendario, lleva ese día a la vista.
    (dayRow.current?.children[i] as HTMLElement | undefined)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    if (now && (slot < 0 || !slotAvailable(i, slot, now))) {
      setSlot(SLOTS.findIndex((_, s) => slotAvailable(i, s, now)));
    }
  };
  // Horas mínimas y cargo de visita: los fija HULUL por categoría.
  const price = categoryPricing(pro.category);
  const minH = Math.max(MIN_HOURS, price.hours);
  const [hours, setHours] = useState(minH);
  const [service, setService] = useState('');
  const [location, setLocation] = useState<LatLng | null>(null);
  const [notesLen, setNotesLen] = useState(0);
  const [payment, setPayment] = useState<PaymentMethod>('tarjeta');
  const [done, setDone] = useState<{ name: string; id: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const q = quote(pro.hourlyRate, hours, price.visit);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    const data = new FormData(e.currentTarget);
    const get = (k: string) => String(data.get(k) ?? '').trim();
    if (!service) {
      setError('Elige qué trabajo necesitas (o "Otro trabajo").');
      document.getElementById('trabajo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (service === OTHER && get('descripcion').length < 10) {
      setError('Describe el trabajo que necesitas (al menos 10 caracteres).');
      return;
    }
    if (slot < 0 || !slotAvailable(day, slot, new Date())) {
      setError('Esa hora ya no está disponible. Elige otra hora de llegada.');
      return;
    }
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
        location: location ?? undefined,
        // El trabajo elegido va delante de la descripción: "Mantenimiento de split. 2 equipos…"
        notes: [service === OTHER ? '' : service, get('descripcion')].filter(Boolean).join('. ').slice(0, NOTES_MAX),
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
        <div className="card stack gap-16">
          <h3 style={{ fontSize: 18 }}>Sigue tu servicio</h3>
          <Timeline steps={[
            { t: 'Reserva recibida', d: `Código ${done.id.slice(0, 8).toUpperCase()}`, state: 'done' },
            { t: 'Profesional confirmado', d: DEMO_MODE ? 'Te escribimos por WhatsApp para confirmar.' : `${pro.name} acepta tu reserva.`, state: 'now' },
            { t: 'En camino', d: 'Verás en el mapa por dónde viene y cuánto falta.' },
            { t: 'Llegó', d: 'Le das tu código de 4 dígitos para empezar.' },
            { t: 'Trabajo en curso', d: 'El tiempo se cuenta en la app.' },
            { t: 'Terminado', d: 'Apruebas el trabajo y calificas. Recién ahí se libera el pago.' },
          ]} />
        </div>
        <Link href="/" className="btn btn-ghost" style={{ alignSelf: 'flex-start' }}>Volver al inicio</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="stack gap-32">
      <Notice text={cat.aviso} />
      <fieldset className="stack gap-12 fs">
        <legend className="fs-title">1. ¿Cuándo?</legend>
        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <span className="muted" style={{ fontSize: 14, fontWeight: 700 }}>Día · desliza para ver más</span>
          {now && (
            <label className="date-pick">
              <Icon name="calendar" size={18} color="var(--primary)" strokeWidth={2} />
              Ver calendario
              <input type="date" aria-label="Elegir fecha en el calendario"
                min={isoDay(now, 0)} max={isoDay(now, BOOKING_DAYS - 1)} value={isoDay(now, day)}
                onChange={(e) => {
                  const off = dayOffset(now, e.target.value);
                  if (off >= 0 && off < BOOKING_DAYS && dayAvailable(off, now)) pickDay(off);
                }} />
            </label>
          )}
        </div>
        <div className="chip-row" role="radiogroup" aria-label="Día" ref={dayRow}>
          {days.map((d, i) => (
            <button key={i} type="button" role="radio" aria-checked={i === day} aria-label={d.long}
              disabled={!now || !dayAvailable(i, now)}
              className={`chip-day ${i === day ? 'on' : ''}`} onClick={() => pickDay(i)}>
              <span className="chip-month">{d.month}</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{d.top}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700 }}>{d.num}</span>
            </button>
          ))}
        </div>
        <span className="muted" style={{ fontSize: 14, fontWeight: 700 }}>Hora de llegada</span>
        <div className="slot-grid" role="radiogroup" aria-label="Hora de llegada">
          {SLOTS.map((t, i) => (
            <button key={t} type="button" role="radio" aria-checked={i === slot}
              disabled={!now || !slotAvailable(day, i, now)}
              className={`chip-slot ${i === slot ? 'on' : ''}`} onClick={() => setSlot(i)}>{t}</button>
          ))}
        </div>
        <div className="card row gap-16" style={{ justifyContent: 'space-between', padding: 16, flexWrap: 'wrap' }}>
          <div className="stack">
            <strong>Horas de servicio</strong>
            <span className="muted" style={{ fontSize: 13.5 }}>Mínimo {minH} h en {cat.name.toLowerCase()} · puedes ampliar durante el servicio</span>
          </div>
          <div className="row gap-12">
            <button type="button" className="stepper" aria-label="Quitar una hora" disabled={hours <= minH} onClick={() => setHours((h) => Math.max(minH, h - 1))}>−</button>
            <span aria-live="polite" style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{hours}</span>
            <button type="button" className="stepper" aria-label="Añadir una hora" onClick={() => setHours((h) => Math.min(MAX_HOURS, h + 1))}>+</button>
          </div>
        </div>
      </fieldset>

      <fieldset className="stack gap-16 fs">
        <legend className="fs-title">2. ¿Dónde y qué necesitas?</legend>
        <AddressInput onPlace={(p) => setLocation(p)} />
        <LocationPicker value={location} onChange={setLocation} />
        <div className="field" id="trabajo">
          <span className="field-label">¿Qué trabajo necesitas?</span>
          <div className="tag-row" role="radiogroup" aria-label="Trabajo">
            {[...cat.servicios, OTHER].map((s) => (
              <button key={s} type="button" role="radio" aria-checked={service === s} className={`tag ${service === s ? 'on' : ''}`} onClick={() => setService(s)}>
                {service === s && '✓ '}{s}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="descripcion">{service === OTHER ? 'Describe el trabajo' : 'Detalles (opcional)'}</label>
          <textarea id="descripcion" name="descripcion" rows={3} maxLength={NOTES_MAX - 60}
            aria-describedby="descripcion-ayuda"
            onChange={(e) => setNotesLen(e.target.value.length)}
            placeholder={service === OTHER ? 'Cuéntanos qué necesitas' : 'Ej.: 2 splits de 12.000 BTU, uno gotea agua'} />
          <div id="descripcion-ayuda" className="row muted" style={{ justifyContent: 'space-between', fontSize: 13, gap: 12 }}>
            <span>Qué equipo, qué falla y cualquier dato que ayude al profesional.</span>
            <span aria-live="polite" style={{ flexShrink: 0, color: notesLen >= NOTES_MAX - 60 ? 'var(--primary)' : undefined }}>
              {notesLen}/{NOTES_MAX - 60}
            </span>
          </div>
        </div>
      </fieldset>

      <fieldset className="stack gap-16 fs">
        <legend className="fs-title">3. Tus datos</legend>
        <p className="muted" style={{ fontSize: 14 }}>No necesitas descargar la app. Usaremos estos datos para confirmar tu reserva.</p>
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
          {q.visit > 0 && (
            <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <span>Visita técnica <span className="muted" style={{ fontSize: 13 }}>(traslado y diagnóstico)</span></span>
              <span>{formatUSD(q.visit)}</span>
            </div>
          )}
          <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
            <span>{`${hours} h × $${pro.hourlyRate}`}</span>
            <span>{formatUSD(q.labor)}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}><span>Cargo de plataforma HULUL</span><span>{formatUSD(q.fee)}</span></div>
          <div className="row" style={{ justifyContent: 'space-between' }}><span>IVA 15%</span><span>{formatUSD(q.iva)}</span></div>
          <div className="row" style={{ justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)', fontWeight: 700, fontSize: 18 }}>
            <span>Total</span><span>{formatUSD(q.total)}</span>
          </div>
          <p className="muted" style={{ fontSize: 13.5 }}>Materiales y repuestos no están incluidos: el profesional te los cotiza en la app y tú decides. Cualquier trabajo extra se agrega y se paga en la app, para que quede cubierto por la garantía.</p>
          {DEMO_MODE ? (
            <p className="pill pill-warm" style={{ alignSelf: 'flex-start' }}>Versión de prueba: no se pide la tarjeta ni se cobra nada.</p>
          ) : (
            <p className="muted" style={{ fontSize: 13.5 }}>Al confirmar ingresas tu tarjeta en la pasarela segura. El monto queda retenido y se cobra cuando apruebas el trabajo.</p>
          )}
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
      <button type="submit" className="btn btn-primary" style={{ minHeight: 54, fontSize: 16 }} disabled={sending || slot < 0} aria-busy={sending}>
        {sending ? 'Registrando tu reserva…' : DEMO_MODE ? `Confirmar reserva de prueba · ${formatUSD(q.total)}` : `Confirmar y pagar ${formatUSD(q.total)}`}
      </button>
    </form>
  );
}
