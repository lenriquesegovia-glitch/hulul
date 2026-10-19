'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AFTER_VISIT_NOTE, appointmentTime, formatUSD, getCategory, hhmmEcuador, HOME_SAFETY_NOTICE, HOME_SAFETY_TITLE, usd } from '@hulul/shared';
import type { ClientBooking } from '@hulul/shared/firebase';
import { Icon } from '@/components/Icon';
import { RescheduleBox, shortDay } from '@/components/RescheduleBox';
import { SafetyNotice, VisitReport } from '@/components/VisitReport';
import { LiveMap } from '@/components/LiveMap';
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
  const message: Record<string, string> = {
    pendiente: `Esperando que ${first} acepte tu reserva. Te avisamos por correo apenas lo haga.`,
    confirmada: `${first} confirmó. Saldrá hacia tu dirección con el tiempo justo para llegar a las ${b.slot} (puede salir desde las ${hhmmEcuador(new Date(at.getTime() - 120 * 60_000))}). Te avisamos cuando vaya en camino.`,
    en_camino: `${first} va en camino a tu dirección. Míralo en el mapa en vivo.`,
    en_curso: `${first} está trabajando. Al terminar te deja el resultado y un diagnóstico con fotos.`,
    por_aprobar: `${first} terminó la visita. Revisa su diagnóstico; tienes 48 horas para calificarlo o reportar un problema.`,
    completada: 'Servicio completado. ¡Gracias por usar HULUL!',
    cancelada: b.cancelledBy === 'profesional' ? `${first} canceló esta reserva. No se te cobra nada.` : `Cancelaste esta reserva${b.cancelFee ? ` con un cargo de ${usd(b.cancelFee)}${b.demo ? ' (prueba, no se cobra)' : ''}` : ' sin costo'}.`,
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
      {b.status === 'por_aprobar' && <ConfirmBox id={b.id} />}

      {['confirmada', 'en_camino', 'en_curso'].includes(b.status) && <SafetyNotice title={HOME_SAFETY_TITLE} items={HOME_SAFETY_NOTICE} />}

      {changeable && (
        <RescheduleBox id={b.id} date={b.date} slot={b.slot} proposal={b.proposal} me="cliente" other={first} />
      )}

      <div className="card stack gap-8" style={{ fontSize: 15 }}>
        {b.address && <span>📍 {b.address}</span>}
        {b.notes && <span style={{ color: 'var(--text-2)' }}>{b.notes}</span>}
        <span>{b.visit ? <>Visita {formatUSD(b.visit)} · </> : null}Total: <strong>{formatUSD(b.total)}</strong> · Código {b.id.slice(0, 8).toUpperCase()}</span>
        {b.professionalId && <Link href={`/profesional/${b.professionalId}?c=${b.category}`}>Ver perfil de {first}</Link>}
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
      <strong>¿Todo en orden?</strong>
      <span className="muted" style={{ fontSize: 14 }}>Confirma para cerrar el servicio. Si no lo haces, se cierra solo 24 horas después de terminado.</span>
      {msg && <p role="alert" className="form-error">{msg}</p>}
      <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={go}>{busy ? 'Guardando…' : 'Confirmar y cerrar el servicio'}</button>
    </div>
  );
}
