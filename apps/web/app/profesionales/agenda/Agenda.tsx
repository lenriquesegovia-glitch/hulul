'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { COMMISSION_RATE, departPlan, durationLabel, formatUSD, getCategory, hhmmEcuador, JOB_OUTCOMES, MAX_DIAGNOSIS_CHARS, MAX_DIAGNOSIS_PHOTOS, MIN_DIAGNOSIS_CHARS, MIN_DIAGNOSIS_PHOTOS, travelEstimate, type JobOutcome, type ProviderStatus } from '@hulul/shared';
import { RescheduleBox } from '@/components/RescheduleBox';
import type { ProAction, ProBooking, VisitReport as Report } from '@hulul/shared/firebase';

/** Mismos estados que CHAT_OPEN_STATUSES (firebase.ts): en ellos se puede escribir en el chat. */
const CHAT_OPEN_STATUSES = ['pendiente', 'confirmada', 'en_camino', 'en_curso', 'por_aprobar'];
import { VisitReport } from '@/components/VisitReport';
import { ExtraForPro } from '@/components/ExtraCharge';
import { RateClientBox } from '@/components/Rating';
import { Chat } from '@/components/Chat';
import { DelayPro } from '@/components/Delay';
import { SignIn } from '@/components/SignIn';
import { logout, useUser } from '@/lib/auth';
import { AgendaMap } from './AgendaMap';

/**
 * Agenda del profesional (como la app de repartidor de Pedidos Ya):
 * solicitudes nuevas para aceptar o rechazar, trabajos de hoy y de la semana,
 * dirección con "Cómo llegar", mapa con todos sus clientes y los botones
 * Voy en camino → Llegué → Terminé. Se actualiza en vivo.
 */

const DAY = 86_400_000;
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const PAY: Record<string, string> = { tarjeta: 'Tarjeta (pagado en la app)', transferencia: 'Transferencia', deuna: 'DeUna', efectivo: 'Efectivo' };
const STATUS: Record<string, string> = {
  pendiente: 'Nueva', confirmada: 'Aceptada', en_camino: 'En camino', en_curso: 'Trabajando',
  por_aprobar: 'Terminada', completada: 'Pagada', cancelada: 'Cancelada', en_disputa: 'En revisión',
};
const ACTIVE = ['pendiente', 'confirmada', 'en_camino', 'en_curso'];

/** Fecha AAAA-MM-DD de hoy en Ecuador (+ offset días). */
function ecDay(offset = 0): string {
  return new Date(Date.now() - 5 * 3_600_000 + offset * DAY).toISOString().slice(0, 10);
}

function dayTitle(iso: string): string {
  if (iso === ecDay()) return 'Hoy';
  if (iso === ecDay(1)) return 'Mañana';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[dt.getUTCDay()][0].toUpperCase()}${WEEKDAYS[dt.getUTCDay()].slice(1)} ${d} ${MONTHS[m - 1]}`;
}

/** Lo que gana: la visita y el cobro adicional aceptado, menos la comisión. */
const earnings = (b: ProBooking) => (b.visit ?? b.subtotal ?? 0) * (1 - COMMISSION_RATE)
  + (b.extra && ['por_cobrar', 'pagado', 'efectivo_pendiente', 'pagado_efectivo'].includes(b.extra.status) ? b.extra.amount - b.extra.commission : 0);

export function Agenda() {
  const user = useUser();
  const [status, setStatus] = useState<ProviderStatus | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [rows, setRows] = useState<ProBooking[] | null>(null);
  const [error, setError] = useState('');

  // Estado de su cuenta de profesional.
  useEffect(() => {
    if (!user) { setStatus(undefined); return; }
    let off = false;
    (async () => {
      const [{ firestore }, fs] = await Promise.all([import('@hulul/shared/firebase'), import('firebase/firestore')]);
      const snap = await fs.getDoc(fs.doc(firestore(), 'providers', user.uid));
      if (off) return;
      setStatus(snap.exists() ? (snap.data().status as ProviderStatus) : null);
      setName(snap.exists() ? String(snap.data().firstName ?? '') : '');
    })().catch(() => { if (!off) setStatus(null); });
    return () => { off = true; };
  }, [user]);

  // Sus reservas, en vivo.
  useEffect(() => {
    if (!user || status !== 'aprobado') return;
    let unsub = () => {};
    (async () => {
      const [{ firestore }, fs] = await Promise.all([import('@hulul/shared/firebase'), import('firebase/firestore')]);
      unsub = fs.onSnapshot(
        fs.query(fs.collection(firestore(), 'bookings'), fs.where('professionalId', '==', user.uid)),
        (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProBooking, 'id'>) }))),
        () => setError('No pudimos cargar tu agenda. Revisa tu conexión.'),
      );
    })();
    return () => unsub();
  }, [user, status]);

  if (user === undefined || (user && status === undefined)) return <p className="muted">Cargando…</p>;
  if (!user) {
    return <div className="card"><SignIn title="Entra a tu agenda" lead="Con la misma cuenta con la que te registraste como profesional." /></div>;
  }
  if (status !== 'aprobado') {
    const text: Record<string, string> = {
      borrador: 'Aún no terminas tu registro.',
      en_revision: 'Tu registro está en revisión. Cuando te aprobemos, aquí verás tus trabajos.',
      observado: 'Tu registro tiene observaciones. Corrígelas para que te aprobemos.',
      rechazado: 'Tu registro no fue aprobado.',
      suspendido: 'Tu cuenta está suspendida.',
    };
    return (
      <div className="card stack gap-12">
        <h1 style={{ fontSize: 26 }}>Mi agenda</h1>
        <p style={{ color: 'var(--text-2)' }}>{status ? text[status] ?? '' : 'Esta cuenta no está registrada como profesional.'}</p>
        <div className="row gap-12" style={{ flexWrap: 'wrap' }}>
          <Link href="/profesionales/registro" className="btn btn-primary">{status ? 'Ver mi registro' : 'Registrarme como profesional'}</Link>
          <button type="button" className="link-btn" onClick={logout}>Usar otra cuenta</button>
        </div>
      </div>
    );
  }

  return <AgendaBody uid={user.uid} name={name} rows={rows} error={error} />;
}

function AgendaBody({ uid, name, rows, error }: { uid: string; name: string; rows: ProBooking[] | null; error: string }) {
  const today = ecDay();
  const weekEnd = ecDay(7);
  const [tab, setTab] = useState<'agenda' | 'historial'>('agenda');

  const groups = useMemo(() => {
    const list = [...(rows ?? [])].sort((a, b) => (a.date + a.slot > b.date + b.slot ? 1 : -1));
    const nuevas = list.filter((b) => b.status === 'pendiente' && b.date >= today);
    const activas = list.filter((b) => ACTIVE.includes(b.status) && b.status !== 'pendiente');
    const history = list.filter((b) => !ACTIVE.includes(b.status) || (b.status === 'pendiente' && b.date < today)).reverse();
    const byDay = new Map<string, ProBooking[]>();
    for (const b of activas) byDay.set(b.date, [...(byDay.get(b.date) ?? []), b]);
    const week = activas.filter((b) => b.date >= today && b.date < weekEnd);
    return { nuevas, activas, history, byDay, week };
  }, [rows, today, weekEnd]);

  const now = groups.activas.find((b) => b.status === 'en_camino' || b.status === 'en_curso');
  const points = useMemo(() => [...groups.nuevas, ...groups.activas].filter((b) => b.location).map((b) => ({
    id: b.id, lat: b.location!.lat, lng: b.location!.lng,
    label: `${dayTitle(b.date)} ${b.slot} · ${getCategory(b.category)?.name ?? ''}`, pending: b.status === 'pendiente',
  })), [groups]);

  return (
    <>
      <div className="row gap-16" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="stack gap-4">
          <h1 style={{ fontSize: 'clamp(26px, 4vw, 34px)' }}>Hola{name ? `, ${name}` : ''}</h1>
          <span className="muted">Tu agenda se actualiza sola.</span>
        </div>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          <Link href="/profesionales/registro" className="btn btn-ghost">Mis servicios y tarifas</Link>
          <Link href={`/profesional/${uid}`} className="btn btn-ghost">Mi perfil público</Link>
          <Link href="/" className="btn btn-ghost">Contratar un servicio</Link>
        </div>
      </div>

      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <Stat v={String(groups.nuevas.length)} l="por aceptar" />
        <Stat v={String(groups.week.length)} l="trabajos en 7 días" />
        <Stat v={formatUSD(groups.week.reduce((s, b) => s + earnings(b), 0))} l="ganas esta semana" />
      </div>

      {error && <p role="alert" className="form-error">{error}</p>}
      {!rows && !error && <p className="muted">Cargando tu agenda…</p>}

      {now && (
        <div className="stack gap-8">
          <h2 style={{ fontSize: 20 }}>Ahora</h2>
          <BookingCard b={now} highlight />
        </div>
      )}

      {groups.nuevas.length > 0 && (
        <div className="stack gap-12">
          <h2 style={{ fontSize: 22 }}>Solicitudes nuevas</h2>
          {groups.nuevas.map((b) => <BookingCard key={b.id} b={b} highlight />)}
        </div>
      )}

      {points.length > 0 && (
        <div className="stack gap-8">
          <h2 style={{ fontSize: 20 }}>Tus clientes en el mapa</h2>
          <AgendaMap points={points} />
        </div>
      )}

      <div className="seg" role="tablist" style={{ alignSelf: 'flex-start' }}>
        <button type="button" role="tab" aria-selected={tab === 'agenda'} className={tab === 'agenda' ? 'on' : ''} onClick={() => setTab('agenda')}>Agenda</button>
        <button type="button" role="tab" aria-selected={tab === 'historial'} className={tab === 'historial' ? 'on' : ''} onClick={() => setTab('historial')}>Historial</button>
      </div>

      {tab === 'agenda' && rows && (
        groups.byDay.size === 0 ? (
          <div className="card stack gap-8">
            <strong>No tienes trabajos aceptados por ahora.</strong>
            <span className="muted">Cuando un cliente te reserve te llega un correo y la solicitud aparece arriba para aceptarla.</span>
          </div>
        ) : (
          [...groups.byDay.entries()].map(([day, list]) => (
            <div key={day} className="stack gap-12">
              <h2 style={{ fontSize: 20 }}>{dayTitle(day)} <span className="muted" style={{ fontSize: 15, fontWeight: 400 }}>· {list.length} {list.length === 1 ? 'trabajo' : 'trabajos'}</span></h2>
              {list.map((b) => <BookingCard key={b.id} b={b} />)}
            </div>
          ))
        )
      )}

      {tab === 'historial' && rows && (
        groups.history.length === 0
          ? <p className="muted">Aún no tienes trabajos terminados o cancelados.</p>
          : groups.history.slice(0, 30).map((b) => <BookingCard key={b.id} b={b} compact />)
      )}
    </>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 14 }}>
      <div className="price" style={{ fontSize: 20 }}>{v}</div>
      <div className="muted" style={{ fontSize: 13 }}>{l}</div>
    </div>
  );
}

function directions(b: ProBooking) {
  const dest = b.location ? `${b.location.lat},${b.location.lng}` : encodeURIComponent(`${b.address}, Ecuador`);
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
    waze: b.location ? `https://waze.com/ul?ll=${b.location.lat},${b.location.lng}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(b.address)}&navigate=yes`,
  };
}


function BookingCard({ b, highlight = false, compact = false }: { b: ProBooking; highlight?: boolean; compact?: boolean }) {
  const cat = getCategory(b.category);
  const first = (b.contactName ?? '').split(' ')[0];
  const accepted = ['confirmada', 'en_camino', 'en_curso'].includes(b.status);
  const nav = directions(b);
  const [busy, setBusy] = useState<ProAction | ''>('');
  const [msg, setMsg] = useState('');
  const [asking, setAsking] = useState<'' | 'rechazar' | 'no_puedo' | 'cliente_ausente'>('');
  const [finishing, setFinishing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [reason, setReason] = useState('');

  const [code, setCode] = useState('');
  const act = async (a: ProAction, report?: Report) => {
    setBusy(a); setMsg('');
    try {
      const { proAction } = await import('@hulul/shared/firebase');
      await proAction(b.id, a, reason.trim(), report, a === 'llegue' ? code.trim() : undefined);
      setAsking('');
      setFinishing(false);
    } catch (e) {
      setMsg((e as { message?: string }).message || 'No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setBusy('');
    }
  };

  return (
    <article className="card stack gap-12" style={{ padding: 16, borderColor: highlight ? 'var(--primary)' : undefined, borderWidth: highlight ? 2 : undefined }}>
      <div className="row gap-12" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stack gap-4">
          <strong style={{ fontSize: 17 }}>{dayTitle(b.date)} · {b.slot}</strong>
          <span style={{ color: 'var(--text-2)' }}>{cat?.name ?? b.category}{first ? ` · ${first}` : ''}</span>
        </div>
        <span className={`pill ${b.status === 'pendiente' ? 'pill-warm' : accepted ? 'pill-success' : ''}`}>{STATUS[b.status] ?? b.status}</span>
      </div>

      {!compact && b.notes && <p style={{ color: 'var(--text-2)', fontSize: 15 }}>{b.notes}</p>}
      {!compact && !!b.photos?.length && (
        <div className="row gap-8" style={{ flexWrap: 'wrap' }} aria-label="Fotos del cliente">
          {b.photos.map((u, i) => (
            <a key={u} href={u} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Foto ${i + 1} del cliente`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
            </a>
          ))}
        </div>
      )}

      {!compact && (
        <div className="stack gap-8">
          <span style={{ fontSize: 15 }}>📍 {b.address}</span>
          {b.status !== 'cancelada' && (
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              <a className="btn btn-ghost" href={nav.google} target="_blank" rel="noreferrer">Cómo llegar (Google Maps)</a>
              <a className="btn btn-ghost" href={nav.waze} target="_blank" rel="noreferrer">Waze</a>
              {b.professionalId && (
                <button type="button" className="btn btn-ghost" onClick={() => setChatOpen((v) => !v)} aria-expanded={chatOpen}>
                  💬 {chatOpen ? 'Ocultar chat' : `Chat con ${first || 'el cliente'}`}
                </button>
              )}
            </div>
          )}
          {chatOpen && b.professionalId && (
            <Chat bookingId={b.id} uid={b.professionalId} me="profesional" otherName={first || 'el cliente'} open={CHAT_OPEN_STATUSES.includes(b.status)} />
          )}
        </div>
      )}

      <div className="row gap-12" style={{ justifyContent: 'space-between', flexWrap: 'wrap', fontSize: 14 }}>
        <span className="muted">{PAY[b.paymentMethod] ?? b.paymentMethod}{b.demo ? ' · prueba' : ''}</span>
        <span>{b.extra && b.extra.status !== 'propuesto' && b.extra.status !== 'rechazado' ? 'Visita + adicional' : 'Visita'}: te queda <strong>{formatUSD(earnings(b))}</strong></span>
      </div>

      {b.outcome && <VisitReport outcome={b.outcome} diagnosis={b.diagnosis} photos={b.diagnosisPhotos} title="Tu diagnóstico" />}
      {!compact && <ExtraForPro id={b.id} status={b.status} extra={b.extra} />}
      {b.rating ? <span className="muted" style={{ fontSize: 13.5 }}>El cliente te calificó {'★'.repeat(b.rating)}</span> : null}
      {(!compact || b.cancelledBy === 'cliente_ausente') && (['por_aprobar', 'completada'].includes(b.status) || b.cancelledBy === 'cliente_ausente') && !b.clientRating && <RateClientBox id={b.id} clientName={first} />}
      {b.status === 'pendiente' && !compact && <span className="muted" style={{ fontSize: 13.5 }}>Lee bien qué necesita el cliente y acepta solo si sabes hacerlo. Cobras la visita; lo que haga falta después lo acuerdas con el cliente.</span>}

      {msg && <p role="alert" className="form-error">{msg}</p>}

      {!compact && ['pendiente', 'confirmada'].includes(b.status) && (
        <RescheduleBox id={b.id} date={b.date} slot={b.slot} proposal={b.proposal} me="profesional" other={first || 'El cliente'} />
      )}

      {finishing ? (
        <FinishPanel bookingId={b.id} busy={!!busy} onCancel={() => setFinishing(false)} onSend={(r) => act('terminar', r)} />
      ) : asking ? (
        <div className="stack gap-8">
          <div className="field">
            <label htmlFor={`r-${b.id}`}>{asking === 'rechazar' ? '¿Por qué no puedes? (opcional)' : asking === 'cliente_ausente' ? '¿Qué pasó? (opcional)' : 'Cuéntale al cliente qué pasó'}</label>
            <input id={`r-${b.id}`} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {asking === 'no_puedo' && <span className="muted" style={{ fontSize: 13 }}>Cancelar con menos de 2 horas o yendo en camino cuenta como falta y tiene una multa de $5.</span>}
          {asking === 'cliente_ausente' && <span className="muted" style={{ fontSize: 13 }}>Se cancela la reserva y al cliente se le cobra la visita, que es para ti (menos la comisión). Después podrás calificarlo.</span>}
          <div className="row gap-8">
            <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => act(asking)}>{busy ? 'Guardando…' : 'Confirmar'}</button>
            <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => setAsking('')}>Volver</button>
          </div>
        </div>
      ) : (
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          {b.status === 'pendiente' && b.date >= ecDay() && (
            <>
              <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => act('aceptar')}>{busy === 'aceptar' ? 'Aceptando…' : 'Aceptar'}</button>
              <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => setAsking('rechazar')}>Rechazar</button>
            </>
          )}
          {b.status === 'confirmada' && <DepartPanel b={b} busy={!!busy} onGo={() => act('en_camino')} />}
          {['confirmada', 'en_camino'].includes(b.status) && <DelayPro id={b.id} slot={b.slot} delay={b.delay} client={first || 'El cliente'} />}
          {b.status === 'en_camino' && <LiveShare bookingId={b.id} />}
          {b.status === 'en_camino' && !b.arrivedAt && <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => act('en_puerta')}>{busy ? 'Guardando…' : 'Estoy en la dirección'}</button>}
          {b.status === 'en_camino' && b.arrivedAt && (
            <div className="row gap-8" style={{ width: '100%', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor={`code-${b.id}`}>Código del cliente</label>
                <input id={`code-${b.id}`} inputMode="numeric" maxLength={4} value={code} placeholder="0000" style={{ width: 110, letterSpacing: 4, fontSize: 20 }} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              </div>
              <button type="button" className="btn btn-primary" disabled={!!busy || code.length !== 4} onClick={() => act('llegue')}>{busy === 'llegue' ? 'Verificando…' : 'Empezar el trabajo'}</button>
              <span className="muted" style={{ fontSize: 13, width: '100%' }}>Pídele al cliente el código de 4 dígitos que ve en su reserva. Sin código no puedes empezar ni terminar.</span>
            </div>
          )}
          {b.status === 'en_curso' && <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => setFinishing(true)}>Terminar la visita</button>}
          {b.status === 'en_camino' && b.arrivedAt && <AbsentButton from={absentFrom(b)} late={arrivedLate(b)} disabled={!!busy} onClick={() => setAsking('cliente_ausente')} />}
          {(b.status === 'confirmada' || b.status === 'en_camino') && (
            <button type="button" className="link-btn" disabled={!!busy} onClick={() => setAsking('no_puedo')}>No puedo ir</button>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * Mientras va en camino, comparte su ubicación con el cliente (cada 15
 * segundos o cuando se mueve más de 40 m). Funciona con la agenda abierta.
 */
function LiveShare({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<'buscando' | 'ok' | 'denegado' | 'sin_gps'>('buscando');
  const [sentAt, setSentAt] = useState<Date | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setState('sin_gps'); return; }
    let last: { lat: number; lng: number; t: number } | null = null;
    let wake: { release: () => Promise<void> } | null = null;
    // Que la pantalla no se apague mientras maneja (si el navegador lo permite).
    (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
      ?.request('screen').then((w) => { wake = w; }).catch(() => {});
    const id = navigator.geolocation.watchPosition(async (p) => {
      const cur = { lat: p.coords.latitude, lng: p.coords.longitude, t: Date.now() };
      const moved = last ? Math.hypot((cur.lat - last.lat) * 111_000, (cur.lng - last.lng) * 111_000 * Math.cos((cur.lat * Math.PI) / 180)) : Infinity;
      if (last && cur.t - last.t < 15_000 && moved < 40) return;
      last = cur;
      try {
        const { shareLivePosition } = await import('@hulul/shared/firebase');
        await shareLivePosition(bookingId, { lat: cur.lat, lng: cur.lng, accuracy: p.coords.accuracy, heading: p.coords.heading });
        setState('ok');
        setSentAt(new Date());
      } catch {
        /* sin conexión: se reintenta con la siguiente posición */
      }
    }, (e) => setState(e.code === e.PERMISSION_DENIED ? 'denegado' : 'sin_gps'), { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 });
    return () => { navigator.geolocation.clearWatch(id); wake?.release().catch(() => {}); };
  }, [bookingId]);

  const text = {
    buscando: 'Activando tu ubicación para que el cliente te vea en el mapa…',
    ok: `📍 El cliente te ve en el mapa en vivo${sentAt ? ` (última señal ${hhmmEcuador(sentAt)})` : ''}. Deja esta página abierta mientras manejas.`,
    denegado: 'Tu navegador bloqueó la ubicación. Permítela (candado junto a la dirección de la página) para que el cliente te vea llegar.',
    sin_gps: 'No pudimos leer tu GPS. Revisa que la ubicación del celular esté encendida.',
  }[state];
  return <span className={state === 'ok' ? 'muted' : 'form-error'} style={{ fontSize: 13.5, width: '100%' }}>{text}</span>;
}

/**
 * "El cliente no está": se habilita 10 minutos después de marcar "Llegué"
 * (el tiempo de espera de las reglas). Muestra cuánto falta.
 */
/** ¿Llegó más de 15 min después de la hora (contando el retraso aceptado)? Entonces no se cobra al cliente. */
function effectiveAt(b: ProBooking): number {
  const [y, m, d] = b.date.split('-').map(Number);
  const [h, mi] = b.slot.split(':').map(Number);
  return Date.UTC(y, m - 1, d, h + 5, mi) + (b.delay?.status === 'aceptado' ? b.delay.minutes * 60_000 : 0);
}
function arrivedLate(b: ProBooking): boolean {
  return (b.arrivedAt?.toMillis?.() ?? 0) > effectiveAt(b) + 15 * 60_000;
}
/** La espera de 10 min cuenta desde la hora de la cita o desde que llegó, lo que sea más tarde. */
function absentFrom(b: ProBooking): number {
  return Math.max(b.arrivedAt?.toMillis?.() ?? 0, effectiveAt(b));
}

function AbsentButton({ from: startedAt, late, disabled, onClick }: { from?: number; late: boolean; disabled: boolean; onClick: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);
  const left = startedAt ? Math.ceil((startedAt + 10 * 60_000 - now) / 60_000) : 0;
  return (
    <button type="button" className="link-btn" disabled={disabled || left > 0} onClick={onClick}>
      {left > 0 ? `El cliente no está (disponible en ${left} min)` : late ? 'El cliente no está (llegaste tarde: sin cobro al cliente)' : 'El cliente no está'}
    </button>
  );
}

/**
 * Al terminar la visita: cómo quedó, diagnóstico escrito y fotos. Queda como
 * respaldo para el cliente y el profesional; HULUL cobra solo la visita.
 */
function FinishPanel({ bookingId, busy, onCancel, onSend }: { bookingId: string; busy: boolean; onCancel: () => void; onSend: (r: Report) => void }) {
  const [outcome, setOutcome] = useState<JobOutcome | ''>('');
  const [diagnosis, setDiagnosis] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr('');
    const list = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, MAX_DIAGNOSIS_PHOTOS - photos.length);
    if (!list.length) { setErr(photos.length >= MAX_DIAGNOSIS_PHOTOS ? `Máximo ${MAX_DIAGNOSIS_PHOTOS} fotos.` : 'Sube fotos (imágenes).'); return; }
    if (list.some((f) => f.size > 20 * 1024 * 1024)) { setErr('Cada foto debe pesar menos de 20 MB.'); return; }
    setUploading(true);
    try {
      const [{ firebaseApp }, au, { uploadPhotos }] = await Promise.all([import('@hulul/shared/firebase'), import('firebase/auth'), import('@/components/PhotoPicker')]);
      const uid = au.getAuth(firebaseApp()).currentUser?.uid;
      if (!uid) throw new Error('auth');
      const urls = await uploadPhotos(`diagnosticos/${uid}/${bookingId}`, list);
      setPhotos((p) => [...p, ...urls]);
    } catch (e) {
      setErr(`No se pudieron subir las fotos (${(e as { code?: string })?.code ?? 'error'}). Revisa tu conexión e inténtalo de nuevo.`);
    } finally {
      setUploading(false);
    }
  };

  const send = () => {
    setErr('');
    if (!outcome) { setErr('Elige cómo quedó el trabajo.'); return; }
    if (outcome !== 'resuelto' && diagnosis.trim().length < MIN_DIAGNOSIS_CHARS) { setErr('Explica qué encontraste y qué hace falta, para que el cliente lo entienda.'); return; }
    if (photos.length < MIN_DIAGNOSIS_PHOTOS) { setErr('Sube al menos una foto del trabajo, haya quedado resuelto o no. Es tu respaldo.'); return; }
    onSend({ outcome, diagnosis: diagnosis.trim(), photos });
  };

  return (
    <div className="stack gap-12" style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <strong>¿Cómo quedó?</strong>
      <div className="stack gap-8">
        {JOB_OUTCOMES.map((o) => (
          <label key={o.value} className="check">
            <input type="radio" name={`out-${bookingId}`} checked={outcome === o.value} onChange={() => setOutcome(o.value)} />
            <span><strong>{o.label}.</strong> {o.help}</span>
          </label>
        ))}
      </div>
      <div className="field">
        <label htmlFor={`dx-${bookingId}`}>Diagnóstico {outcome === 'resuelto' ? '(opcional)' : ''}</label>
        <textarea id={`dx-${bookingId}`} rows={4} maxLength={MAX_DIAGNOSIS_CHARS} value={diagnosis}
          placeholder="Qué encontraste, qué hiciste y qué recomiendas. Ej.: La bomba tiene el capacitor dañado. Se cambió el sello. Falta un capacitor de 35 µF."
          onChange={(e) => setDiagnosis(e.target.value)} />
        <span className="muted" style={{ fontSize: 12.5 }}>El cliente lo ve en su reserva. Es tu respaldo de lo que encontraste.</span>
      </div>
      <div className="doc-row" style={{ alignItems: 'center' }}>
        <div className="stack gap-4" style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 14.5 }}>Fotos del trabajo (mínimo 1, hasta {MAX_DIAGNOSIS_PHOTOS})</strong>
          <span className="muted" style={{ fontSize: 13 }}>{photos.length ? `✓ ${photos.length} foto(s)` : 'Antes y después, la falla, la pieza dañada…'}</span>
        </div>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          {/* capture abre la cámara directamente en el celular */}
          <label className="btn btn-primary doc-btn" aria-busy={uploading}>
            {uploading ? 'Subiendo…' : '📷 Tomar foto'}
            <input type="file" accept="image/*" capture="environment" disabled={uploading || photos.length >= MAX_DIAGNOSIS_PHOTOS}
              onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
          </label>
          <label className="btn btn-ghost doc-btn" aria-busy={uploading}>
            Galería
            <input type="file" accept="image/*" multiple disabled={uploading || photos.length >= MAX_DIAGNOSIS_PHOTOS}
              onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
          </label>
        </div>
      </div>
      {err && <p role="alert" className="form-error">{err}</p>}
      <div className="row gap-8">
        <button type="button" className="btn btn-primary" disabled={busy || uploading} onClick={send}>{busy ? 'Guardando…' : 'Terminar y enviar al cliente'}</button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>Volver</button>
      </div>
    </div>
  );
}

/**
 * Cuándo salir: con su ubicación calcula el viaje hasta el cliente y le dice
 * desde qué hora puede marcar "Voy en camino" y a más tardar cuándo salir.
 * Si ya no alcanza, le sugiere avisar, proponer otra hora o cancelar.
 */
function DepartPanel({ b, busy, onGo }: { b: ProBooking; busy: boolean; onGo: () => void }) {
  const [trip, setTrip] = useState<{ km: number; minutes: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState('');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);
  const plan = departPlan(b, now, trip?.minutes);

  const locate = () => {
    if (!b.location) { setGeoMsg('El cliente no marcó su ubicación en el mapa. Usa "Cómo llegar" para ver el tiempo.'); return; }
    if (!('geolocation' in navigator)) { setGeoMsg('Tu navegador no permite ver tu ubicación.'); return; }
    setGeoMsg('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      (p) => { setTrip(travelEstimate({ lat: p.coords.latitude, lng: p.coords.longitude }, b.location!)); setGeoMsg(''); },
      () => setGeoMsg('No pudimos ver tu ubicación. Permite el acceso a la ubicación e inténtalo de nuevo.'),
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  };

  return (
    <div className="stack gap-8" style={{ width: '100%' }}>
      {trip && (
        <div style={{ padding: 12, borderRadius: 12, background: plan.lateBy > 0 ? '#F6E7E9' : 'var(--success-soft)', fontSize: 14.5 }}>
          Estás a <strong>{trip.km} km</strong>, unos <strong>{durationLabel(trip.minutes * 60_000)}</strong> de viaje.{' '}
          {plan.lateBy > 0
            ? <>Si sales ahora llegarías <strong>{plan.lateBy} min tarde</strong>. Propón otra hora al cliente o, si no alcanzas, marca &ldquo;No puedo ir&rdquo;.</>
            : plan.latest && <>Para llegar a las {b.slot}, sal a más tardar a las <strong>{hhmmEcuador(plan.latest)}</strong>.</>}
        </div>
      )}
      {geoMsg && <span className="muted" style={{ fontSize: 13.5 }}>{geoMsg}</span>}
      <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" disabled={busy || !plan.canGo} onClick={onGo}>
          {busy ? 'Guardando…' : plan.canGo ? 'Voy en camino' : `Podrás salir desde las ${hhmmEcuador(plan.earliest)}`}
        </button>
        <button type="button" className="btn btn-ghost" onClick={locate}>{trip ? 'Recalcular' : '¿Cuándo debo salir?'}</button>
      </div>
    </div>
  );
}
