'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AFTER_VISIT_NOTE, cancelledText, clientAlert, appointmentTime, formatUSD, getCategory, hhmmEcuador, HOME_SAFETY_NOTICE, HOME_SAFETY_TITLE, usd } from '@hulul/shared';
import type { ClientBooking } from '@hulul/shared/firebase';
import { Icon } from '@/components/Icon';
import { RescheduleBox, shortDay } from '@/components/RescheduleBox';
import { SafetyNotice, VisitReport } from '@/components/VisitReport';
import { LiveMap } from '@/components/LiveMap';
import { ExtraForClient } from '@/components/ExtraCharge';
import { RatingBox } from '@/components/Rating';
import { Chat } from '@/components/Chat';
import { DelayClient } from '@/components/Delay';
import { ArrivalCode, ProblemBox } from '@/components/ArrivalCode';
import { useUser } from '@/lib/auth';
import { CancelBox } from '../../Account';

/**
 * Detalle de una reserva para el cliente, en vivo: en qué paso va (como el
 * seguimiento de un paquete), cambio de hora y cancelación.
 */
const STEPS = [
  { status: 'pendiente', t: 'Reserva recibida' },
  { status: 'confirmada', t: 'Profesional confirmado' },
  { status: 'en_camino', t: 'En camino' },
  { status: 'en_curso', t: 'Trabajando' },
  { status: 'por_aprobar', t: 'Terminado' },
];

export function BookingDetail({ id }: { id: string }) {
  const user = useUser();
  const [b, setB] = useState<ClientBooking | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    let unsub = () => {};
    (async () => {
      const [{ firestore }, fs] = await Promise.all([import('@hulul/shared/firebase'), import('firebase/firestore')]);
      unsub = fs.onSnapshot(fs.doc(firestore(), 'bookings', id),
        (snap) => setB(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<ClientBooking, 'id'>) }) : null),
        () => setB(null));
    })();
    return () => unsub();
  }, [user, id]);

  if (user === null) return <div className="card stack gap-12"><p>Inicia sesión para ver tu reserva.</p><Link href="/cuenta" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Entrar</Link></div>;
  if (b === undefined) return <p className="muted">Cargando…</p>;
  if (!b) return <div className="card stack gap-12"><p>No encontramos esta reserva.</p><Link href="/cuenta" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Mis reservas</Link></div>;

  const cat = getCategory(b.category);
  const first = b.professionalName.split(' ')[0];
  const idx = STEPS.findIndex((s) => s.status === b.status);
  const at = appointmentTime(b.date, b.slot);
  const alert = clientAlert(b, first);
  const message: Record<string, string> = {
    pendiente: `Esperando que ${first} acepte tu reserva. Te avisamos por correo apenas lo haga.`,
    confirmada: `${first} confirmó. Saldrá hacia tu dirección con el tiempo justo para llegar a las ${b.slot} (puede salir desde las ${hhmmEcuador(new Date(at.getTime() - 120 * 60_000))}). Te avisamos cuando vaya en camino.`,
    en_camino: b.arrivedAt ? `${first} está en tu dirección. Recíbelo y dale tu código de llegada.` : `${first} va en camino a tu dirección. Míralo en el mapa en vivo.`,
    en_curso: `${first} está trabajando. Al terminar te deja el resultado y un diagnóstico con fotos.`,
    por_aprobar: `${first} terminó la visita. Revisa su diagnóstico; tienes 48 horas para calificarlo o reportar un problema.`,
    completada: 'Servicio completado. ¡Gracias por usar HULUL!',
    en_disputa: 'Reportaste un problema. HULUL lo está revisando y el pago queda retenido mientras tanto. Te escribimos con la respuesta.',
    cancelada: cancelledText(b, first),
  };
  const changeable = ['pendiente', 'confirmada'].includes(b.status);

  return (
    <>
      <nav className="breadcrumbs" aria-label="Migas de pan">
        <Link href="/">Inicio</Link><span>/</span><Link href="/cuenta">Mi cuenta</Link><span>/</span><span>Reserva {b.id.slice(0, 8).toUpperCase()}</span>
      </nav>

      <div className="stack gap-8">
        <h1 style={{ fontSize: 'clamp(24px, 4vw, 32px)' }}>{cat?.name ?? b.category} con {b.professionalName}</h1>
        <p style={{ fontSize: 17 }}><strong>{shortDay(b.date)} · {b.slot}</strong></p>
      </div>

      {['confirmada', 'en_camino'].includes(b.status) && <ArrivalCode id={b.id} pro={first} />}
      {['confirmada', 'en_camino'].includes(b.status) && <DelayClient id={b.id} slot={b.slot} delay={b.delay} pro={first} />}

      {alert && (
        <div className="notice" role="alert" style={alert.tone === 'bad' ? { borderLeftColor: 'var(--primary)', fontWeight: 600 } : undefined}>{alert.text}</div>
      )}

      <div className="card stack gap-16">
        <p style={{ fontSize: 15.5 }}>{message[b.status] ?? ''}</p>
        {b.status !== 'cancelada' && (
          <ol className="timeline">
            {STEPS.map((s, i) => {
              const state = idx > i || ['por_aprobar', 'completada'].includes(b.status) ? 'done' : idx === i ? 'now' : '';
              return (
                <li key={s.status} className={state}>
                  <span className="tl-dot">{state === 'done' && <Icon name="check" size={14} color="#fff" strokeWidth={3} />}</span>
                  <div className="stack"><strong>{s.t}</strong></div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {b.status === 'en_camino' && (
        <div className="card stack gap-8">
          <strong style={{ fontSize: 17 }}>¿Por dónde viene {first}?</strong>
          <LiveMap bookingId={b.id} destination={b.location} name={first} />
        </div>
      )}

      <VisitReport outcome={b.outcome} diagnosis={b.diagnosis} photos={b.diagnosisPhotos} />
      {b.outcome && <p className="muted" style={{ fontSize: 14 }}>{AFTER_VISIT_NOTE}</p>}
      <ExtraForClient id={b.id} extra={b.extra} proName={first} />
      {b.status === 'cancelada' && b.proFault && !b.rating && <RatingBox id={b.id} proName={first} />}
      {['por_aprobar', 'completada'].includes(b.status) && !b.rating && b.extra?.status !== 'propuesto' && <RatingBox id={b.id} proName={first} />}
      {b.rating ? <p className="muted">Calificaste a {first} con {'★'.repeat(b.rating)}. ¡Gracias!</p> : null}
      {b.status === 'por_aprobar' && !b.rating && b.extra?.status !== 'propuesto' && <ConfirmBox id={b.id} />}
      {['por_aprobar', 'completada'].includes(b.status) && !b.dispute && <ProblemBox id={b.id} />}

      {['confirmada', 'en_camino', 'en_curso'].includes(b.status) && <SafetyNotice title={HOME_SAFETY_TITLE} items={HOME_SAFETY_NOTICE} />}

      {b.status !== 'cancelada' && user && (
        <div className="card stack gap-8">
          <strong style={{ fontSize: 17 }}>💬 Chat con {first}</strong>
          <Chat bookingId={b.id} uid={user.uid} me="cliente" otherName={first} open={['pendiente', 'confirmada', 'en_camino', 'en_curso', 'por_aprobar'].includes(b.status)} />
        </div>
      )}

      {changeable && (
        <RescheduleBox id={b.id} date={b.date} slot={b.slot} proposal={b.proposal} me="cliente" other={first} />
      )}

      <div className="card stack gap-8" style={{ fontSize: 15 }}>
        {b.address && <span>📍 {b.address}</span>}
        {b.notes && <span style={{ color: 'var(--text-2)' }}>{b.notes}</span>}
        {!!b.photos?.length && (
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            {b.photos.map((u, i) => (
              <a key={u} href={u} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={`Tu foto ${i + 1}`} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
              </a>
            ))}
          </div>
        )}
        <span>{b.visit ? <>Visita {formatUSD(b.visit)} · </> : null}Total: <strong>{formatUSD(b.total)}</strong> · Código {b.id.slice(0, 8).toUpperCase()}</span>
        {b.professionalId && <Link href={`/profesional/${b.professionalId}?c=${b.category}`}>Ver perfil de {first}</Link>}
      </div>

      <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
        <Link href="/" className="btn btn-ghost">Volver al inicio</Link>
        <Link href="/cuenta" className="btn btn-ghost">Mis reservas</Link>
      </div>

      <CancelBox row={b} onDone={() => {}} />
    </>
  );
}

/** El cliente confirma que el servicio terminó (si no, se cierra solo a las 24 horas). */
function ConfirmBox({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const go = async () => {
    setBusy(true); setMsg('');
    try {
      const { confirmService } = await import('@hulul/shared/firebase');
      await confirmService(id);
    } catch (e) {
      setMsg((e as { message?: string }).message || 'No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card stack gap-8">
      <strong>¿Prefieres no calificar ahora?</strong>
      <span className="muted" style={{ fontSize: 14 }}>Puedes cerrar el servicio sin calificar. Si no haces nada, se cierra solo 24 horas después de terminado.</span>
      {msg && <p role="alert" className="form-error">{msg}</p>}
      <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={go}>{busy ? 'Guardando…' : 'Cerrar sin calificar'}</button>
    </div>
  );
}
