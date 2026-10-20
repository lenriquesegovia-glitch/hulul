/**
 * Régimen tributario del profesional y reglas de facturación.
 *
 * Modelo decidido por Luis el 20-oct-2026 (HULUL como intermediario o
 * "mercado en línea"):
 * - El profesional factura la visita al cliente (con IVA solo si su régimen
 *   lo cobra).
 * - HULUL factura al cliente solo el cargo de plataforma (+ IVA).
 * - HULUL factura al profesional su comisión (+ IVA), una vez por semana.
 * - El dinero de la visita es del profesional (valores por cuenta de
 *   terceros): HULUL lo recauda, lo retiene durante la ventana de reclamos y
 *   se lo paga en la liquidación semanal, menos comisión, retenciones, multas
 *   y deuda de efectivo.
 *
 * Porcentajes de retención: los define el contador según la norma de
 * mercados en línea (Resolución NAC-DGERCGC21-00000026 y reformas) y la
 * tabla de retenciones vigente. Mientras tanto quedan en 0 y marcados como
 * pendientes (`RETENTIONS_DEFINED = false`).
 */

export type TaxRegime = 'general' | 'rimpe_emprendedor' | 'rimpe_popular';

export const TAX_REGIMES: { value: TaxRegime; label: string; help: string }[] = [
  { value: 'rimpe_popular', label: 'RIMPE · Negocio popular', help: 'Vendes hasta $20.000 al año. Emites notas de venta o facturas sin IVA.' },
  { value: 'rimpe_emprendedor', label: 'RIMPE · Emprendedor', help: 'Facturas con IVA y declaras el RIMPE.' },
  { value: 'general', label: 'Régimen general', help: 'Facturas con IVA (personas obligadas a llevar contabilidad, empresas y el resto).' },
];

export const TAX_REGIME_LABEL: Record<TaxRegime, string> = Object.fromEntries(TAX_REGIMES.map((r) => [r.value, r.label])) as Record<TaxRegime, string>;

/** Régimen válido o el que se asume si no lo indicó (cobra IVA: lo más conservador). */
export function regimeOf(v: unknown): TaxRegime {
  return v === 'rimpe_popular' || v === 'rimpe_emprendedor' || v === 'general' ? v : 'general';
}

/** ¿Su factura de la visita lleva IVA? */
export function chargesVat(regime: TaxRegime | undefined): boolean {
  return regimeOf(regime) !== 'rimpe_popular';
}

/**
 * Retenciones que HULUL practica al profesional sobre lo que le paga (como
 * agente de retención en el régimen de mercados en línea). Fracción de la
 * base (renta) y del IVA facturado (iva). POR DEFINIR CON EL CONTADOR.
 */
export const RETENTIONS: Record<TaxRegime, { renta: number; iva: number }> = {
  general: { renta: 0, iva: 0 },
  rimpe_emprendedor: { renta: 0, iva: 0 },
  rimpe_popular: { renta: 0, iva: 0 },
};
export const RETENTIONS_DEFINED = false;

/** Horas que el dinero de una visita queda retenido antes de poder pagarse (ventana de reclamos). */
export const PAYOUT_HOLD_HOURS = 48;
/** Día de cierre de la liquidación semanal (1 = lunes, en Ecuador). */
export const PAYOUT_WEEKDAY = 1;
