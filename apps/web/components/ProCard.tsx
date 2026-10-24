import Link from 'next/link';
import { formatPrice, proHref, ratingLabel, type Professional } from '@hulul/shared';
import { ProAvatar } from './ProAvatar';
import { Icon } from './Icon';

/** `job`: trabajo elegido en la categoría; se pasa a la reserva. */
export function ProCard({ pro, job }: { pro: Professional; job?: string }) {
  const bookHref = proHref('reservar', pro, job);
  return (
    <article className="card pro-card">
      <Link href={proHref('profesional', pro, job)} className="stack gap-12" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="row gap-12">
          <ProAvatar name={pro.name} initials={pro.initials} photoUrl={pro.photoUrl}/>
          <div className="stack gap-4" style={{ minWidth: 0 }}>
            <strong className="row gap-8" style={{ fontSize: 16 }}>
              {pro.name}
              {pro.verified && <Icon name="shield" size={18} color="#685943" label="Verificado" />}
            </strong>
            <span style={{ fontSize: 14, color: 'var(--text-2)' }}>
              {ratingLabel(pro)}{pro.jobsDone > 0 ? ` · ${pro.jobsDone} servicios` : ` · ${pro.years} años de experiencia`}
            </span>
            <span className="muted" style={{ fontSize: 13.5 }}>{pro.zone}</span>
          </div>
        </div>
        <p className="clamp-2" style={{ fontSize: 14.5, color: 'var(--text-2)' }}>{pro.bio}</p>
        {pro.availableToday && <span className="pill pill-success" style={{ alignSelf: 'flex-start' }}>Disponible hoy</span>}
      </Link>
      <div className="row gap-12" style={{ justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div className="stack">
          <span className="price">{formatPrice(pro.visitRate)}<span className="muted" style={{ fontSize: 13, fontFamily: 'var(--font-body)' }}> por visita</span></span>
          <span className="muted" style={{ fontSize: 13 }}>Incluye el traslado</span>
        </div>
        <Link href={bookHref} className="btn btn-primary" aria-label={`Reservar a ${pro.name}`}>Reservar</Link>
      </div>
    </article>
  );
}
