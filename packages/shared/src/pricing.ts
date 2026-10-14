/** IVA vigente en Ecuador. */
export const IVA = 0.15;

/**
 * Tarifa fija que paga el cliente por reserva (protección del pago).
 * Valor provisional: definir antes del lanzamiento.
 */
export const PROTECTION_FEE = 1.99;

/**
 * Comisión que HULUL retiene al profesional sobre el subtotal.
 * Valor provisional: definir antes del lanzamiento.
 */
export const COMMISSION_RATE = 0.15;

export interface Quote {
  subtotal: number;
  fee: number;
  iva: number;
  total: number;
  /** Lo que recibe el profesional después de la comisión. */
  proPayout: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function quote(hourlyRate: number, hours: number, minimum = 0): Quote {
  const subtotal = round2(Math.max(hourlyRate * hours, minimum));
  const fee = PROTECTION_FEE;
  const iva = round2((subtotal + fee) * IVA);
  const total = round2(subtotal + fee + iva);
  const proPayout = round2(subtotal * (1 - COMMISSION_RATE));
  return { subtotal, fee, iva, total, proPayout };
}

export function formatUSD(n: number): string {
  return '$' + n.toFixed(2);
}
