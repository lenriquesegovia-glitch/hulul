import type { PaymentMethod } from './models';

/** Horas de llegada que puede elegir el cliente: cada hora de 08:00 a 18:00. */
export const SLOTS = Array.from({ length: 11 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`);

/** Cuántos días hacia adelante se puede reservar. */
export const BOOKING_DAYS = 30;

export const MIN_HOURS = 1;
export const MAX_HOURS = 8;

export const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'tarjeta', label: 'Tarjeta de crédito o débito' },
  { value: 'transferencia', label: 'Transferencia bancaria' },
  { value: 'deuna', label: 'DeUna' },
];

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export interface BookingDay {
  top: string;
  num: string;
  /** "hoy martes 14" o "el jueves 16 de octubre" */
  long: string;
  /** Mes abreviado ("nov") solo en el primer día y cuando empieza un mes; si no, vacío. */
  month: string;
}

/** Próximos `n` días a partir de hoy. */
export function nextDays(n = BOOKING_DAYS, from: Date = new Date()): BookingDay[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    return {
      top: i === 0 ? 'Hoy' : WEEKDAYS[d.getDay()],
      num: String(d.getDate()),
      long: i === 0
        ? `hoy ${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()}`
        : `el ${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`,
      month: i === 0 || d.getDate() === 1 ? MONTHS[d.getMonth()] : '',
    };
  });
}

/** Anticipación mínima para reservar hoy: el profesional necesita tiempo para llegar. */
export const LEAD_TIME_HOURS = 2;

/** ¿Se puede reservar esa hora? Las de hoy deben empezar al menos 2 horas después de ahora. */
export function slotAvailable(dayIndex: number, slotIndex: number, now: Date = new Date()): boolean {
  if (dayIndex > 0) return true;
  const [h, m] = SLOTS[slotIndex].split(':').map(Number);
  const start = new Date(now);
  start.setHours(h, m, 0, 0);
  return start.getTime() - now.getTime() >= LEAD_TIME_HOURS * 3_600_000;
}

/** ¿Queda alguna hora libre ese día? */
export function dayAvailable(dayIndex: number, now: Date = new Date()): boolean {
  return SLOTS.some((_, i) => slotAvailable(dayIndex, i, now));
}

/** Primer día y hora que se pueden reservar. */
export function firstAvailable(now: Date = new Date()): { day: number; slot: number } {
  for (let d = 0; d < 2; d++) {
    const s = SLOTS.findIndex((_, i) => slotAvailable(d, i, now));
    if (s >= 0) return { day: d, slot: s };
  }
  return { day: 1, slot: 0 };
}
