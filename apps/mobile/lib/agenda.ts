import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { COMMISSION_RATE } from '@hulul/shared';
import { firestore, type ProBooking } from '@hulul/shared/firebase';

/** Reservas del profesional, en vivo. `null` mientras carga. */
export function useProBookings(uid?: string | null): ProBooking[] | null {
  const [rows, setRows] = useState<ProBooking[] | null>(null);
  useEffect(() => {
    if (!uid) { setRows(null); return; }
    const q = query(collection(firestore(), 'bookings'), where('professionalId', '==', uid));
    return onSnapshot(q, (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProBooking, 'id'>) }))), () => setRows([]));
  }, [uid]);
  return rows;
}

/** Una reserva, en vivo. `undefined` mientras carga, `null` si no existe o no es suya. */
export function useBooking(id?: string): ProBooking | null | undefined {
  const [b, setB] = useState<ProBooking | null | undefined>(undefined);
  useEffect(() => {
    if (!id) { setB(null); return; }
    return onSnapshot(doc(firestore(), 'bookings', id),
      (snap) => setB(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<ProBooking, 'id'>) }) : null),
      () => setB(null));
  }, [id]);
  return b;
}

export const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Nueva solicitud', confirmada: 'Confirmada', en_camino: 'En camino', en_curso: 'En curso',
  por_aprobar: 'Terminada', completada: 'Completada', cancelada: 'Cancelada', en_disputa: 'En revisión',
};

/** Lo que gana: visita + cobro adicional aceptado, menos la comisión. */
export const earned = (b: ProBooking) => ((b.visit ?? b.subtotal ?? 0) + (b.surcharge ?? 0)) * (1 - COMMISSION_RATE)
  + (b.extra && ['por_cobrar', 'pagado', 'efectivo_pendiente', 'pagado_efectivo'].includes(b.extra.status) ? b.extra.amount - b.extra.commission : 0);

/** Hoy en Ecuador (AAAA-MM-DD). */
export const todayEc = () => new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
