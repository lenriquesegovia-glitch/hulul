import type { PaymentMethod } from './models';

/** Horas de llegada que puede elegir el cliente. */
export const SLOTS = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];

export const MIN_HOURS = 1;
export const MAX_HOURS = 8;

export const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'tarjeta', label: 'Tarjeta de crédito o débito' },
  { value: 'transferencia', label: 'Transferencia bancaria' },
  { value: 'deuna', label: 'DeUna' },
];

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export interface BookingDay {
  top: string;
  num: string;
  /** "hoy martes 14" o "el jueves 16" */
  long: string;
}

/** Próximos `n` días a partir de hoy. */
export function nextDays(n = 7, from: Date = new Date()): BookingDay[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    return {
      top: i === 0 ? 'Hoy' : WEEKDAYS[d.getDay()],
      num: String(d.getDate()),
      long: i === 0 ? `hoy ${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()}` : `el ${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()}`,
    };
  });
}
