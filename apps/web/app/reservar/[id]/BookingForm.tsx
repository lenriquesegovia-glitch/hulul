'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  dayAvailable,
  firstAvailable,
  formatUSD,
  getCategory,
  serviceCopy,
  HOME_SAFETY_ACCEPT,
  HOME_SAFETY_NOTICE,
  HOME_SAFETY_TITLE,
  proHref,
  type Professional,
  BOOKING_DAYS,
  checkSlot,
  MAX_REQUEST_PHOTOS,
  leadMinutes,
  slotInWindow,
  surchargeFor,
  isOffHour,
  SURCHARGE_LABEL,
  visitHours,
  visitLabel,
  nextDays,
  PAYMENT_OPTIONS,
  quoteVisit,
  SLOTS,
  slotAvailable,
  TEST_SLOTS,
  testPeriodOpen,
  timeAvailable,
  type LatLng,
  type PaymentMethod,
} from '@hulul/shared';
import { Icon } from '@/components/Icon';
import { AddressInput } from '@/components/AddressInput';
import { ClientGate, type ClientProfile } from '@/components/ClientGate';
import { PhotoPicker } from '@/components/PhotoPicker';
import { LocationPicker } from '@/components/LocationPicker';
import { Notice } from '@/components/Notice';
import { DEMO_MODE } from '@/lib/site';
import { usePro } from '@/lib/pros';

/**
 * Reserva desde la web, el mismo flujo que la app.
 * Guarda la reserva en Firestore (`bookings`) con la prueba del consentimiento.
 * Pendiente: redirigir a la pasarela de pago antes de confirmar.
 */
const OTHER = 'Otro';

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

/** Para reservar hay que tener cuenta de cliente (como Uber). */
export function BookingForm({ proId }: { proId: string }) {
  const pro = usePro(proId);
  if (pro === undefined) return <p className="muted">Cargando…</p>;
  if (!pro) {
    return (
      <div className="card stack gap-12">
        <h1 style={{ fontSize: 24 }}>Este profesional no está disponible</h1>
        <p className="muted">Puede que aún esté en revisión o que ya no atienda por HULUL.</p>
        <Link href="/" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Ver servicios</Link>
      </div>
    );
  }
  const cat = getCategory(pro.category)!;
  return (
    <>
      <nav className="breadcrumbs" aria-label="Migas de pan">
        <Link href="/">Inicio</Link><span>/</span>
        <Link href={`/servicios/${cat.slug}`}>{cat.name}</Link><span>/</span>
        <Link href={proHref('profesional', pro)}>{pro.name}</Link><span>/</span>
        <span>Reservar</span>
      </nav>
      <div className="row gap-16">
        <span className="avatar" style={{ width: 56, height: 56, fontSize: 19 }}>{pro.initials}</span>
        <div className="stack gap-4">
          <h1 style={{ fontSize: 'clamp(24px, 3.5vw, 32px)' }}>Reservar a {pro.name}</h1>
          <p className="muted">{cat.name} · {visitLabel(pro.visitRate)}</p>
        </div>
      </div>
      <BookingGate pro={pro} />
    </>
  );
}

function BookingGate({ pro }: { pro: Professional }) {
  return (
    <ClientGate title="Crea tu cuenta para reservar" lead="Con Google, Outlook o tu correo. Así sigues tu servicio, recibes la confirmación y el diagnóstico de cada visita.">
      {({ user, profile }) => <BookingFormInner pro={pro} uid={user.uid} profile={profile} />}
    </ClientGate>
  );
}

function BookingFormInner({ pro, uid, profile }: { pro: Professional; uid: string; profile: ClientProfile }) {
  if (pro.id === uid) {
    return (
      <div className="card stack gap-12">
        <strong>Este es tu propio perfil</strong>
        <p className="muted">No puedes reservarte a ti mismo. Con esta misma cuenta sí puedes reservar a otros profesionales.</p>
        <Link href="/profesionales/agenda" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Ir a mi agenda</Link>
      </div>
    );
  }
  return <BookingFormBody pro={pro} uid={uid} profile={profile} />;
}

function BookingFormBody({ pro, uid, profile }: { pro: Professional; uid: string; profile: ClientProfile }) {
  // Modo prueba: solo profesionales marcados (providers/{uid}.tester) y solo durante el periodo de prueba.
  const tester = !!pro.tester && testPeriodOpen();
  const slots = tester ? TEST_SLOTS : SLOTS;
  const cat = getCategory(pro.category)!;
  // La hora real se toma en el navegador, no al publicar la página.
  const [now, setNow] = useState<Date | null>(null);
  const days = useMemo(() => (now ? nextDays(BOOKING_DAYS, now) : []), [now]);

  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState(-1);

  useEffect(() => {
    const n = new Date();
    setNow(n);
    // Primer día y hora que cumplan el horario del servicio y del profesional.
    const first = tester ? { day: 0, slot: 0 } : firstAvailable(n, leadMinutes(pro.category));
    for (let d = first.day; d < BOOKING_DAYS; d++) {
      const sIdx = slots.findIndex((_, i) => okWith(n, d, i, minH));
      if (sIdx >= 0) { setDay(d); setSlot(sIdx); return; }
    }
    setDay(first.day);
    setSlot(-1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** ¿Se puede ese día y hora? Anticipación + horario de la categoría + horario del profesional. */
  function okWith(n: Date, d: number, sIdx: number, h: number): boolean {
    if (tester) return timeAvailable(d, slots[sIdx], n, 0);
    return slotAvailable(d, sIdx, n, leadMinutes(pro.category)) && checkSlot({ category: pro.category, date: isoDay(n, d), slot: slots[sIdx], hours: h, pro }).ok;
  }

  const dayRow = useRef<HTMLDivElement>(null);
  const pickDay = (i: number) => {
    setDay(i);
    // Si se eligió en el calendario, lleva ese día a la vista.
    (dayRow.current?.children[i] as HTMLElement | undefined)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    if (now && (slot < 0 || !okWith(now, i, slot, hours))) {
      setSlot(slots.findIndex((_, s) => okWith(now, i, s, hours)));
    }
  };
  // Se paga por visita. La duración estimada solo sirve para validar el horario.
  const hours = visitHours(pro.category);
  const minH = hours;
  const [service, setService] = useState('');
  // Si ya lo eligió en la categoría, no se vuelve a preguntar (se puede cambiar).
  const [pickJob, setPickJob] = useState(true);
  const copy = serviceCopy(pro.category);
  // Fotos opcionales del problema: el profesional las ve antes de aceptar.
  const [photos, setPhotos] = useState<string[]>([]);
  const draftId = useMemo(() => Math.random().toString(36).slice(2, 12), []);
  // Primero los trabajos que este profesional marcó; luego el resto de la categoría.
  const jobs = useMemo(() => {
    const own = pro.services ?? [];
    return [...own, ...cat.servicios.filter((x) => !own.includes(x))];
  }, [pro.services, cat.servicios]);
  // Si viene elegido desde la categoría (?trabajo=…), queda marcado.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('trabajo');
    if (t && (jobs.includes(t) || t === OTHER)) { setService(t); setPickJob(false); }
  }, [jobs]);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [notesLen, setNotesLen] = useState(0);
  const [payment, setPayment] = useState<PaymentMethod>('tarjeta');
  const [done, setDone] = useState<{ name: string; id: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Recargo nocturno o de feriado del profesional (monto fijo), si aplica.
  const sc = !tester && now && slot >= 0 ? surchargeFor(isoDay(now, day), slots[slot], pro) : { kind: null, amount: 0 };
  const q = quoteVisit(pro.visitRate, sc.amount, pro.taxRegime);
  // Se calcula una vez (no en cada letra que se escribe en la descripción).
  const okDays = useMemo(() => (now ? days.map((_, i) => slots.some((_, sIdx) => okWith(now, i, sIdx, hours))) : []), [now, days, hours, pro, tester]); // eslint-disable-line react-hooks/exhaustive-deps
  const okSlots = useMemo(() => (now ? slots.map((_, i) => okWith(now, day, i, hours)) : []), [now, day, hours, pro, tester]); // eslint-disable-line react-hooks/exhaustive-deps
  const dayOk = (i: number) => !!okDays[i];
  const check = !tester && now && slot >= 0 ? checkSlot({ category: pro.category, date: isoDay(now, day), slot: slots[slot], hours, pro }) : null;
  const [ack, setAck] = useState(false);
  const warnKey = check?.warnings.join('|') ?? '';
  useEffect(() => { setAck(false); }, [warnKey]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    const data = new FormData(e.currentTarget);
    const get = (k: string) => String(data.get(k) ?? '').trim();
    if (!service) {
      setError('Elige qué necesitas.');
      document.getElementById('trabajo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (service === OTHER && get('descripcion').length < 10) {
      setError('Cuéntanos qué necesitas (al menos 10 caracteres).');
      return;
    }
    if (slot < 0 || !okWith(new Date(), day, slot, hours)) {
      setError('Esa hora ya no está disponible. Elige otra hora de llegada.');
      return;
    }
    if (check && !check.ok) { setError(check.reason ?? 'Ese horario no está disponible.'); return; }
    if (!data.get('acepta_seguridad')) {
      setError('Marca la casilla "Para que tu servicio fluya" para continuar.');
      document.getElementById('aviso-seguridad')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (check && check.warnings.length && !ack) {
      setError('Lee el aviso sobre el horario y marca que lo entiendes.');
      document.getElementById('aviso-horario')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
        slot: slots[slot],
        hours,
        pricing: 'visita',
        pricingVersion: 2,
        visit: q.visit,
        ...(sc.kind ? { surcharge: q.surcharge, surchargeKind: sc.kind } : {}),
        ...(check?.noisy ? { noiseAccepted: true as const } : {}),
        safetyAccepted: true,
        ...(photos.length ? { photos } : {}),
        address: get('direccion'),
        location: location ?? undefined,
        // El trabajo elegido va delante de la descripción: "Mantenimiento de split. 2 equipos…"
        notes: [tester ? '[PRUEBA]' : '', service === OTHER ? '' : service, get('descripcion')].filter(Boolean).join('. ').slice(0, NOTES_MAX),
        clientId: uid,
        contactName: profile.name,
        contactPhone: profile.phone,
        contactEmail: profile.email,
        paymentMethod: payment,
        subtotal: q.subtotal,
        fee: q.fee,
        iva: q.iva,
        total: q.total,
        // Régimen del profesional al reservar: define el IVA de la visita y las facturas.
        taxRegime: q.regime,
        visitIva: q.proInvoice.iva,
        consentMarketing: profile.consentMarketing,
        demo: DEMO_MODE,
      });
      setDone({ name: profile.name.split(' ')[0], id });
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
            {pro.name} llegará {days[day].long} a las {slots[slot]}. {cat.name} · visita · {formatUSD(q.total)}
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
            { t: 'Llegó', d: 'Recíbelo y dale tu código de llegada para empezar.' },
            { t: 'En curso', d: copy.inProgress },
            { t: 'Terminado', d: copy.finished },
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
                  if (off >= 0 && off < BOOKING_DAYS && dayOk(off)) pickDay(off);
                }} />
            </label>
          )}
        </div>
        <div className="chip-row" role="radiogroup" aria-label="Día" ref={dayRow}>
          {days.map((d, i) => (
            <button key={i} type="button" role="radio" aria-checked={i === day} aria-label={d.long}
              disabled={!now || (!tester && !dayAvailable(i, now, leadMinutes(pro.category))) || !dayOk(i)}
              className={`chip-day ${i === day ? 'on' : ''}`} onClick={() => pickDay(i)}>
              <span className="chip-month">{d.month}</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{d.top}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700 }}>{d.num}</span>
            </button>
          ))}
        </div>
        <span className="muted" style={{ fontSize: 14, fontWeight: 700 }}>Hora de llegada</span>
        {tester && <p className="pill pill-warm" style={{ alignSelf: 'flex-start' }}>Modo prueba: cualquier hora, sin reglas de horario</p>}
        {!tester && <p className="muted" style={{fontSize:13}}>Horario de {pro.name.split(' ')[0]}: {pro.from || '08:00'}–{pro.to || '18:00'}. Puedes solicitar una hora futura sin anticipación mínima; el profesional confirma si puede atenderte. El horario indica cuándo puede llegar; el trabajo puede terminar después si acepta la solicitud.</p>}
        <div className="slot-grid" role="radiogroup" aria-label="Hora de llegada">
          {slots.map((t, i) => (tester || slotInWindow(pro.category, t, pro)) && (
            <button key={t} type="button" role="radio" aria-checked={i === slot}
              disabled={!now || !okSlots[i]}
              aria-label={!tester && isOffHour(t) ? `${t}, fuera de horario` : t}
              className={`chip-slot ${i === slot ? 'on' : ''}`} onClick={() => setSlot(i)}>{!tester && isOffHour(t) ? `🌙 ${t}` : t}</button>
          ))}
        </div>
        {!tester && (pro.offHours?.length ?? 0) > 0 && (
          <span className="muted" style={{ fontSize: 13.5 }}>🌙 Fuera de horario (antes de las 08:00 o desde las 18:00): tarifa nocturna de {formatUSD(pro.surcharges?.nocturno || pro.visitRate)}.</span>
        )}
        {sc.kind && sc.amount > 0 && (
          <p className="notice" style={{ fontSize: 14 }}><strong>{SURCHARGE_LABEL[sc.kind]}: {formatUSD(sc.amount)}.</strong> Lo fija {pro.name.split(' ')[0]} para atender {sc.kind === 'feriado' ? 'en feriado' : 'fuera de horario'}. Reemplaza la tarifa normal; no se suma.</p>
        )}
        {check && (
          <span className="muted" style={{ fontSize: 14 }}>
            {check.ok ? <>Llega a las <strong>{slots[slot]}</strong>. Una visita de {cat.name.toLowerCase()} suele tomar unas {minH} h.</> : check.reason}
          </span>
        )}
        {slot < 0 && now && <p className="form-error">No quedan horas disponibles ese día. Elige otro día.</p>}
        {check?.ok && check.warnings.length > 0 && (
          <div id="aviso-horario" className="notice stack gap-8">
            {check.warnings.map((w) => <span key={w}>⚠️ {w}</span>)}
            <label className="check"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /><span>Entiendo y reservo bajo mi responsabilidad.</span></label>
          </div>
        )}
      </fieldset>

      <fieldset className="stack gap-16 fs">
        <legend className="fs-title">2. ¿Dónde y qué necesitas?</legend>
        <AddressInput onPlace={(p) => setLocation(p)} />
        <LocationPicker value={location} onChange={setLocation} />
        {!pickJob && service ? (
          <div className="card row gap-12" id="trabajo" style={{ padding: 14, justifyContent: 'space-between' }}>
            <div className="stack"><span className="muted" style={{ fontSize: 13 }}>{copy.jobQuestion}</span><strong style={{ fontSize: 16 }}>{service}</strong></div>
            <button type="button" className="link-btn" onClick={() => setPickJob(true)}>Cambiar</button>
          </div>
        ) : (
        <div className="field" id="trabajo">
          <span className="field-label">{copy.jobQuestion}</span>
          <div className="tag-row" role="radiogroup" aria-label="Trabajo">
            {[...jobs, OTHER].map((s) => (
              <button key={s} type="button" role="radio" aria-checked={service === s} className={`tag ${service === s ? 'on' : ''}`} onClick={() => setService(s)}>
                {service === s && '✓ '}{s}
              </button>
            ))}
          </div>
        </div>
        )}
        <div className="field">
          <label htmlFor="descripcion">{service === OTHER ? 'Cuéntanos qué necesitas' : 'Detalles (opcional)'}</label>
          <textarea id="descripcion" name="descripcion" rows={3} maxLength={NOTES_MAX - 60}
            aria-describedby="descripcion-ayuda"
            onChange={(e) => setNotesLen(e.target.value.length)}
            placeholder={copy.detailsPlaceholder} />
          <div id="descripcion-ayuda" className="row muted" style={{ justifyContent: 'space-between', fontSize: 13, gap: 12 }}>
            <span>{copy.detailsHelp}</span>
            <span aria-live="polite" style={{ flexShrink: 0, color: notesLen >= NOTES_MAX - 60 ? 'var(--primary)' : undefined }}>
              {notesLen}/{NOTES_MAX - 60}
            </span>
          </div>
        </div>
        <PhotoPicker folder={`solicitudes/${uid}/${draftId}`} max={MAX_REQUEST_PHOTOS} value={photos} onChange={setPhotos}
          label={copy.photosLabel} help={copy.photosHelp} />
      </fieldset>

      <fieldset className="stack gap-12 fs">
        <legend className="fs-title">3. Tus datos</legend>
        <div className="card row gap-12" style={{ padding: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div className="stack">
            <strong>{profile.name}</strong>
            <span className="muted" style={{ fontSize: 14 }}>{profile.phone} · {profile.email}</span>
          </div>
          <Link href="/cuenta" className="link-btn" style={{ textDecoration: 'none' }}>Mi cuenta</Link>
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
            <span>{pro.name.split(' ')[0]} <span className="muted" style={{ fontSize: 13 }}>({copy.priceCovers})</span></span>
            <span>{formatUSD(q.visit)}</span>
          </div>
          {q.surcharge > 0 && sc.kind && (
            <div className="row" style={{ justifyContent: 'space-between' }}><span>{SURCHARGE_LABEL[sc.kind]}</span><span>{formatUSD(q.surcharge)}</span></div>
          )}
          <div className="row" style={{ justifyContent: 'space-between' }}><span>Cargo de plataforma HULUL</span><span>{formatUSD(q.fee)}</span></div>
          <div className="row" style={{ justifyContent: 'space-between' }}><span>{q.proInvoice.iva > 0 ? 'IVA 15%' : 'IVA 15% (del cargo de plataforma)'}</span><span>{formatUSD(q.iva)}</span></div>
          <div className="row" style={{ justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)', fontWeight: 700, fontSize: 18 }}>
            <span>Total</span><span>{formatUSD(q.total)}</span>
          </div>
          <p className="muted" style={{ fontSize: 13.5 }}>{copy.priceNote}</p>
          <p className="muted" style={{ fontSize: 13.5 }}>Recibes dos comprobantes electrónicos: la factura de {pro.name.split(' ')[0]} por la visita y la de HULUL por el cargo de plataforma.</p>
          {DEMO_MODE ? (
            <p className="pill pill-warm" style={{ alignSelf: 'flex-start' }}>Versión de prueba: no se pide la tarjeta ni se cobra nada.</p>
          ) : (
            <p className="muted" style={{ fontSize: 13.5 }}>Al confirmar ingresas tu tarjeta en la pasarela segura. El monto queda retenido y se cobra cuando termina la visita.</p>
          )}
        </div>
      </fieldset>

      <div className="stack gap-12">
        <div id="aviso-seguridad" className="card stack gap-8" style={{ padding: 16, background: 'var(--surface-warm, #F6F1EA)' }}>
          <strong>{HOME_SAFETY_TITLE}</strong>
          <ul className="stack gap-4" style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
            {HOME_SAFETY_NOTICE.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <label className="check"><input type="checkbox" name="acepta_seguridad" /><span>{HOME_SAFETY_ACCEPT}</span></label>
        </div>
        <label className="check">
          <input type="checkbox" name="acepta_privacidad" required />
          <span>
            Acepto que HULUL comparta mi nombre, la dirección y la descripción con {pro.name} para realizar este servicio, y las reglas de cancelación de los{' '}
            <Link href="/legal/terminos" target="_blank">Términos y condiciones</Link>.
          </span>
        </label>
      </div>

      {error && <p role="alert" style={{ color: 'var(--primary)', fontWeight: 600 }}>{error}</p>}
      <button type="submit" className="btn btn-primary" style={{ minHeight: 54, fontSize: 16 }} disabled={sending || slot < 0} aria-busy={sending}>
        {sending ? 'Registrando tu reserva…' : DEMO_MODE ? `Confirmar reserva de prueba · ${formatUSD(q.total)}` : `Confirmar y pagar ${formatUSD(q.total)}`}
      </button>
    </form>
  );
}
