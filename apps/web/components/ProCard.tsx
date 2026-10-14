import Link from 'next/link';
import { formatRating, type Professional } from '@hulul/shared';
import { Icon } from './Icon';

export function ProCard({ pro }: { pro: Professional }) {
  return (
    <Link href={`/profesional/${pro.id}`} className="card pro-card">
      <div className="row gap-12">
        <span className="avatar" style={{ width: 52, height: 52, fontSize: 17 }}>{pro.initials}</span>
        <div className="stack gap-4" style={{ minWidth: 0 }}>
          <strong className="row gap-8" style={{ fontSize: 16 }}>
            {pro.name}
            {pro.verified && <Icon name="shield" size={18} color="#9A5B34" label="Verificado" />}
          </strong>
          <span style={{ fontSize: 14, color: 'var(--text-2)' }}>
            ★ {formatRating(pro.rating)} ({pro.reviewCount}) · {pro.jobsDone} servicios
          </span>
          <span className="muted" style={{ fontSize: 13.5 }}>{pro.zone}</span>
        </div>
      </div>
      <p className="clamp-2" style={{ fontSize: 14.5, color: 'var(--text-2)' }}>{pro.bio}</p>
      <div className="row" style={{ justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <span className="muted" style={{ fontSize: 14 }}>Reserva mín. ${pro.minimumBooking}</span>
        <span className="price">${pro.hourlyRate}<span className="muted" style={{ fontSize: 13, fontFamily: 'var(--font-body)' }}>/hora</span></span>
      </div>
      {pro.availableToday && <span className="pill pill-success" style={{ alignSelf: 'flex-start' }}>Disponible hoy</span>}
    </Link>
  );
}
