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
