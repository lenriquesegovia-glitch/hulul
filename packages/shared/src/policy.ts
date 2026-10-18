import { COMMISSION_RATE, PROTECTION_FEE } from './pricing';

/**
 * Reglas del servicio (cancelaciones, retrasos, reclamos, efectivo).
 * Un solo lugar: los Términos, las preguntas frecuentes, el registro de
 * profesionales y, más adelante, los cobros automáticos leen de aquí.
 * Valores iniciales aprobados por Luis el 17 de octubre de 2026.
 */
export const POLICY = {
  /** Cargo de plataforma por reserva (USD), lo paga el cliente. */
  platformFee: PROTECTION_FEE,
  /** Comisión de HULUL sobre el servicio (visita + horas). */
  commission: COMMISSION_RATE,
  /** El cliente cancela gratis hasta estos minutos después de que el profesional acepta. */
  freeCancelMinutes: 5,
  /** El cliente cancela gratis una reserva programada hasta estas horas antes. */
  freeCancelHoursBefore: 2,
  /** Cargo por cancelación tardía del cliente (USD). */
  lateCancelFee: 3,
  /** Minutos que espera el profesional antes de marcar "cliente ausente". */
  clientNoShowWaitMinutes: 10,
  /** Parte de los cargos al cliente que va al profesional. */
  proShareOfClientFees: 0.8,
  /** Tolerancia de llegada del profesional (minutos). */
  lateToleranceMinutes: 15,
  /** Descuento al cliente si el profesional llega entre la tolerancia y 30 minutos tarde. */
  lateDiscount: 0.1,
  /** Minutos de retraso desde los que el cliente puede cancelar gratis. */
  veryLateMinutes: 30,
  /** Crédito al cliente si el profesional llega muy tarde o cancela tarde (USD). */
  lateCredit: 5,
  /** Multa al profesional por llegar muy tarde o cancelar con menos de 2 horas (USD). */
  proLateFine: 5,
  /** Multa al profesional que no llega y no avisa (USD). */
  proNoShowFine: 10,
  /** Faltas en la ventana que llevan a suspensión temporal. */
  strikesToSuspend: 3,
  strikesWindowDays: 30,
  /** Horas para reportar un problema después de terminado el servicio. */
  claimWindowHours: 48,
  /** Garantía de mano de obra (días). */
  warrantyDays: 30,
  /** Si el cliente no aprueba ni reclama, el trabajo se aprueba solo a las… (horas). */
  autoApproveHours: 24,
  /** Deuda máxima del profesional por servicios en efectivo antes de desactivar el efectivo (USD). */
  cashDebtLimit: 30,
} as const;

export const pct = (n: number) => `${Math.round(n * 100)} %`;
export const usd = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/* ------------------------------ Cancelación ------------------------------ */

/** Estados en los que el cliente todavía puede cancelar desde la app o la web. */
export const CANCELLABLE_STATUSES = ['pendiente', 'confirmada', 'en_camino'] as const;

export interface CancelTerms {
  /** false si ya empezó o terminó (entonces se reporta un problema). */
  allowed: boolean;
  /** Cargo por cancelar ahora (USD); 0 = gratis. */
  fee: number;
  /** Explicación para el cliente. */
  reason: string;
  /** Hasta cuándo se cancela gratis (ISO), si aplica. */
  freeUntil?: string;
}

/** Fecha y hora de la cita en Ecuador (UTC-5) como instante. */
export function appointmentTime(date: string, slot: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = slot.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, h + 5, min));
}

/** "1 h 20 min", "45 min", "3 días". */
export function durationLabel(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min >= 2880) return `${Math.floor(min / 1440)} días`;
  if (min >= 60) return `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;
  return `${min} min`;
}

/**
 * Cuánto cuesta cancelar ahora. Regla (la misma que aplica el servidor):
 * - Sin profesional confirmado: gratis.
 * - Confirmada: gratis hasta 2 horas antes; después, cargo de $3.
 * - Profesional en camino: cargo de $3.
 * - En curso o terminada: no se cancela; se reporta un problema.
 */
export function cancelTerms(b: { date: string; slot: string; status: string }, now: Date = new Date()): CancelTerms {
  if (!(CANCELLABLE_STATUSES as readonly string[]).includes(b.status)) {
    return { allowed: false, fee: 0, reason: b.status === 'cancelada' ? 'Esta reserva ya está cancelada.' : 'El servicio ya empezó o terminó. Si algo salió mal, repórtalo desde la reserva.' };
  }
  const at = appointmentTime(b.date, b.slot);
  const freeUntil = new Date(at.getTime() - POLICY.freeCancelHoursBefore * 3_600_000);
  const fee = POLICY.lateCancelFee;
  if (b.status === 'en_camino') {
    return { allowed: true, fee, reason: `El profesional ya va en camino: cancelar ahora tiene un cargo de ${usd(fee)}, que compensa su traslado.` };
  }
  if (b.status === 'pendiente') {
    return { allowed: true, fee: 0, reason: 'Aún ningún profesional confirmó tu reserva: cancelar es gratis.', freeUntil: freeUntil.toISOString() };
  }
  if (now < freeUntil) {
    return { allowed: true, fee: 0, reason: `Faltan ${durationLabel(at.getTime() - now.getTime())} para tu cita: cancelar es gratis (hasta ${POLICY.freeCancelHoursBefore} horas antes).`, freeUntil: freeUntil.toISOString() };
  }
  return { allowed: true, fee, reason: `Faltan menos de ${POLICY.freeCancelHoursBefore} horas para tu cita y el profesional ya la confirmó: cancelar ahora tiene un cargo de ${usd(fee)}.` };
}

/* ------------------------- Salida del profesional ------------------------- */

/** Lo antes que el profesional puede marcar "Voy en camino" (minutos antes de la cita). */
export const EARLIEST_DEPART_MINUTES = 120;
/** Margen para estacionar, subir y presentarse (minutos). */
export const ARRIVAL_BUFFER_MINUTES = 10;
/** Un cambio de hora debe quedar al menos a esta distancia de ahora (minutos). */
export const RESCHEDULE_LEAD_MINUTES = 60;

/**
 * Tiempo de viaje estimado en Guayaquil, Samborondón y Daule: distancia en
 * línea recta × 1,4 (calles reales) a 22 km/h promedio con tráfico, + 5 min.
 * Es una estimación prudente; Google Maps o Waze dan el tiempo exacto.
 */
export function travelEstimate(from: { lat: number; lng: number }, to: { lat: number; lng: number }): { km: number; minutes: number } {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((from.lat * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const km = 2 * R * Math.asin(Math.sqrt(a)) * 1.4;
  return { km: Math.round(km * 10) / 10, minutes: Math.round((km / 22) * 60 + 5) };
}

export interface DepartPlan {
  /** Desde cuándo puede marcar "Voy en camino". */
  earliest: Date;
  /** A más tardar debe salir a esta hora para llegar puntual (si se conoce el viaje). */
  latest?: Date;
  /** ¿Ya puede salir? */
  canGo: boolean;
  /** Minutos que llegaría tarde si sale ahora (0 si llega a tiempo). */
  lateBy: number;
}

/**
 * Cuándo debe salir el profesional. Sin ubicación: puede salir desde 2 horas
 * antes. Con ubicación: desde el viaje + 30 min antes (máx. 2 h), y debe salir
 * a más tardar con el viaje + 10 min de margen.
 */
export function departPlan(b: { date: string; slot: string }, now: Date = new Date(), tripMinutes?: number): DepartPlan {
  const at = appointmentTime(b.date, b.slot).getTime();
  const lead = tripMinutes != null ? Math.min(EARLIEST_DEPART_MINUTES, tripMinutes + 30) : EARLIEST_DEPART_MINUTES;
  const earliest = new Date(at - lead * 60_000);
  const latest = tripMinutes != null ? new Date(at - (tripMinutes + ARRIVAL_BUFFER_MINUTES) * 60_000) : undefined;
  const lateBy = tripMinutes != null ? Math.max(0, Math.round((now.getTime() + tripMinutes * 60_000 - at) / 60_000)) : 0;
  return { earliest, latest, canGo: now >= earliest, lateBy };
}

/** "16:25" en hora de Ecuador. */
export function hhmmEcuador(d: Date): string {
  const e = new Date(d.getTime() - 5 * 3_600_000);
  return `${String(e.getUTCHours()).padStart(2, '0')}:${String(e.getUTCMinutes()).padStart(2, '0')}`;
}
