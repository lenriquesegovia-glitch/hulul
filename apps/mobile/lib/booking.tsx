import { createContext, useContext, useState, type ReactNode } from 'react';
import type { PaymentMethod } from '@hulul/shared';

// Días, horarios y formas de pago viven en @hulul/shared para que la web y la app usen lo mismo.
export { nextDays, PAYMENT_OPTIONS, SLOTS } from '@hulul/shared';

/**
 * Estado de la reserva en curso, compartido entre la pantalla de reserva y la
 * de confirmación. La reserva ya se guardó en Firestore antes de llamar a
 * `confirm`; aquí solo se guarda para mostrar el resumen.
 */
export interface DraftBooking {
  professionalId: string;
  professionalName: string;
  category: string;
  dayIndex: number;
  slotIndex: number;
  /** Hora elegida "HH:MM" (en modo prueba no sale de SLOTS). */
  slotTime?: string;
  hours: number;
  address: string;
  notes: string;
  payment: PaymentMethod;
  total: number;
  /** Id del documento en Firestore. */
  bookingId?: string;
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
