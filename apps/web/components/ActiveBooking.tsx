'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCategory } from '@hulul/shared';
import { useUser } from '@/lib/auth';

type Row = { id: string; category: string; professionalName: string; date: string; slot: string; status: string };

/** Arriba del inicio: la reserva activa del cliente y en qué paso va. */
export function ActiveBooking() {
  const user = useUser();
  const [b, setB] = useState<Row | null>(null);
  const [steps, setSteps] = useState<{ status: string; label: string }[]>([]);

  useEffect(() => {
    if (!user) { setB(null); return; }
    import('@hulul/shared/firebase').then(async (m) => {
      setSteps(m.TRACK_STEPS);
      setB(m.activeBooking(await m.clientBookings(user.uid)));
    }).catch(() => {});
  }, [user]);

  if (!b) return null;
  // Al terminar (por aprobar), todos los pasos quedan en verde.
  const idx = b.status === 'por_aprobar' ? steps.length : Math.max(0, steps.findIndex((s) => s.status === b.status));
  return (
    <Link href={`/cuenta/reserva/${b.id}`} className="active-booking container" aria-label="Ver mi reserva">
      <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
        <strong>Tu reserva · {getCategory(b.category)?.name}</strong>
        <span className="muted" style={{ fontSize: 13 }}>{b.date} · {b.slot}</span>
      </div>
      <strong>AHORA · {b.status === 'por_aprobar' ? 'Terminado · pendiente de tu revisión' : steps.find(s=>s.status===b.status)?.label || 'En revisión'}</strong><div className="ab-steps">
        {steps.map((s, i) => (
          <div key={s.status} className={`ab-step ${i < idx ? 'done' : i === idx ? 'now' : ''}`}>
            <span className="ab-bar" />
            <span className="ab-label">{s.label}</span>
          </div>
        ))}
      </div>
      <span className="muted" style={{ fontSize: 13 }}>{b.professionalName} · toca para ver el detalle</span>
    </Link>
  );
}
