import { createContext, useContext, useState, type ReactNode } from 'react';
import type { PaymentMethod } from '@hulul/shared';

/**
 * Estado de la reserva en curso, compartido entre la pantalla de reserva y la
 * de confirmación. Cuando se conecte Firebase, `confirm` creará el documento
 * en la colección `bookings` y el pago se hará con la pasarela elegida.
 */
export interface DraftBooking {
  professionalId: string;
  dayIndex: number;
  slotIndex: number;
  hours: number;
  address: string;
  notes: string;
  payment: PaymentMethod;
  total: number;
}

interface Ctx {
  last: DraftBooking | null;
  confirm: (b: DraftBooking) => void;
}

const BookingContext = createContext<Ctx>({ last: null, confirm: () => {} });

export function BookingProvider({ children }: { children: ReactNode }) {
  const [last, setLast] = useState<DraftBooking | null>(null);
  return <BookingContext.Provider value={{ last, confirm: setLast }}>{children}</BookingContext.Provider>;
}

export const useBooking = () => useContext(BookingContext);

export const SLOTS = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Próximos 7 días a partir de hoy. */
export function nextDays(n = 7) {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      top: i === 0 ? 'Hoy' : WEEKDAYS[d.getDay()],
      num: String(d.getDate()),
      long: i === 0 ? `hoy ${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()}` : `el ${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()}`,
    };
  });
}

export const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'tarjeta', label: 'Tarjeta de crédito o débito' },
  { value: 'transferencia', label: 'Transferencia bancaria' },
  { value: 'deuna', label: 'DeUna' },
];
