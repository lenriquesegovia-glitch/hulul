'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { COMMISSION_RATE, formatUSD, getCategory, type ProviderStatus } from '@hulul/shared';
import type { ProAction, ProBooking } from '@hulul/shared/firebase';
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

const earnings = (b: ProBooking) => (b.subtotal ?? 0) * (1 - COMMISSION_RATE);

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

function waLink(phone: string, text: string) {
  const d = phone.replace(/\D/g, '');
  const n = d.startsWith('0') ? `593${d.slice(1)}` : d;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

function BookingCard({ b, highlight = false, compact = false }: { b: ProBooking; highlight?: boolean; compact?: boolean }) {
  const cat = getCategory(b.category);
  const first = (b.contactName ?? '').split(' ')[0];
  const accepted = ['confirmada', 'en_camino', 'en_curso'].includes(b.status);
  const nav = directions(b);
  const [busy, setBusy] = useState<ProAction | ''>('');
  const [msg, setMsg] = useState('');
  const [asking, setAsking] = useState<'' | 'rechazar' | 'no_puedo'>('');
  const [reason, setReason] = useState('');

  const act = async (a: ProAction) => {
    setBusy(a); setMsg('');
    try {
      const { proAction } = await import('@hulul/shared/firebase');
      await proAction(b.id, a, reason.trim());
      setAsking('');
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
          <strong style={{ fontSize: 17 }}>{dayTitle(b.date)} · {b.slot} · {b.hours} h</strong>
          <span style={{ color: 'var(--text-2)' }}>{cat?.name ?? b.category}{first ? ` · ${first}` : ''}</span>
        </div>
        <span className={`pill ${b.status === 'pendiente' ? 'pill-warm' : accepted ? 'pill-success' : ''}`}>{STATUS[b.status] ?? b.status}</span>
      </div>

      {!compact && b.notes && <p style={{ color: 'var(--text-2)', fontSize: 15 }}>{b.notes}</p>}

      {!compact && (
        <div className="stack gap-8">
          <span style={{ fontSize: 15 }}>📍 {b.address}</span>
          {b.status !== 'cancelada' && (
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              <a className="btn btn-ghost" href={nav.google} target="_blank" rel="noreferrer">Cómo llegar (Google Maps)</a>
              <a className="btn btn-ghost" href={nav.waze} target="_blank" rel="noreferrer">Waze</a>
              {accepted && b.contactPhone && (
                <a className="btn btn-ghost" href={waLink(b.contactPhone, `Hola ${first}, soy tu profesional de HULUL para ${cat?.name ?? 'el servicio'} del ${dayTitle(b.date).toLowerCase()} a las ${b.slot}.`)} target="_blank" rel="noreferrer">WhatsApp al cliente</a>
              )}
            </div>
          )}
        </div>
      )}

      <div className="row gap-12" style={{ justifyContent: 'space-between', flexWrap: 'wrap', fontSize: 14 }}>
        <span className="muted">{PAY[b.paymentMethod] ?? b.paymentMethod}{b.demo ? ' · prueba' : ''}</span>
        <span>Te queda <strong>{formatUSD(earnings(b))}</strong></span>
      </div>

      {msg && <p role="alert" className="form-error">{msg}</p>}

      {asking ? (
        <div className="stack gap-8">
          <div className="field">
            <label htmlFor={`r-${b.id}`}>{asking === 'rechazar' ? '¿Por qué no puedes? (opcional)' : 'Cuéntale al cliente qué pasó'}</label>
            <input id={`r-${b.id}`} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {asking === 'no_puedo' && <span className="muted" style={{ fontSize: 13 }}>Cancelar con menos de 2 horas o yendo en camino cuenta como falta y tiene una multa de $5.</span>}
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
          {b.status === 'confirmada' && <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => act('en_camino')}>{busy ? 'Guardando…' : 'Voy en camino'}</button>}
          {b.status === 'en_camino' && <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => act('llegue')}>{busy ? 'Guardando…' : 'Llegué, empiezo'}</button>}
          {b.status === 'en_curso' && <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => act('terminar')}>{busy ? 'Guardando…' : 'Trabajo terminado'}</button>}
          {(b.status === 'confirmada' || b.status === 'en_camino') && (
            <button type="button" className="link-btn" disabled={!!busy} onClick={() => setAsking('no_puedo')}>No puedo ir</button>
          )}
        </div>
      )}
    </article>
  );
}
