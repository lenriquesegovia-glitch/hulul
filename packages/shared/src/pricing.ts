/** IVA vigente en Ecuador. */
export const IVA = 0.15;

/**
 * Cargo de plataforma: fijo, lo paga el cliente en cada reserva.
 * Valor provisional: definir antes del lanzamiento.
 */
export const PROTECTION_FEE = 1.99;

/**
 * Comisión que HULUL retiene al profesional sobre el subtotal.
 * Valor provisional: definir antes del lanzamiento.
 */
export const COMMISSION_RATE = 0.15;

import { CATEGORY_PRICING } from './provider';
import type { CategorySlug } from './categories';

export interface Quote {
  /** Tarifa por visita del profesional. */
  visit: number;
  /** Recargo nocturno o de feriado del profesional (monto fijo, 0 si no aplica). */
  surcharge: number;
  subtotal: number;
  fee: number;
  iva: number;
  total: number;
  /** Lo que recibe el profesional después de la comisión. */
  proPayout: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Precio por cita, como un taxi: tarifa por visita del profesional + cargo de
 * plataforma + IVA. La visita cubre traslado, diagnóstico y el trabajo que se
 * pueda resolver en ella. Lo que haga falta después (repuestos, más trabajo)
 * lo acuerdan directamente el cliente y el profesional.
 * Fuera de horario o en feriado se suma el recargo fijo del profesional; la
 * comisión de HULUL aplica sobre visita + recargo.
 */
export function quote(visitRate: number, surchargeAmount = 0): Quote {
  const visit = round2(visitRate);
  const surcharge = round2(Math.max(0, surchargeAmount || 0));
  const subtotal = round2(visit + surcharge);
  const fee = PROTECTION_FEE;
  const iva = round2((subtotal + fee) * IVA);
  const total = round2(subtotal + fee + iva);
  const proPayout = round2(subtotal * (1 - COMMISSION_RATE));
  return { visit, surcharge, subtotal, fee, iva, total, proPayout };
}

/**
 * Cobro adicional (repuestos, más trabajo u otra visita) que el profesional
 * agrega en la app y el cliente acepta. Lleva IVA; HULUL retiene la misma
 * comisión que en la visita. No lleva otro cargo de plataforma.
 */
export interface ExtraQuote { amount: number; iva: number; total: number; commission: number; proPayout: number }

export function extraQuote(amount: number): ExtraQuote {
  const a = round2(amount);
  const iva = round2(a * IVA);
  const commission = round2(a * COMMISSION_RATE);
  return { amount: a, iva, total: round2(a + iva), commission, proPayout: round2(a - commission) };
}

/** Límites del cobro adicional (USD). */
export const MIN_EXTRA = 1;
export const MAX_EXTRA = 2000;

export function formatUSD(n: number): string {
  return '$' + n.toFixed(2);
}

/** "$36" o "$36.50": precios cortos para tarjetas y etiquetas. */
export function formatPrice(n: number): string {
  return '$' + (Number.isInteger(n) ? String(n) : n.toFixed(2));
}

/** Tarifa sugerida y duración estimada de la categoría. */
export function categoryPricing(slug: CategorySlug) {
  return CATEGORY_PRICING[slug];
}

/** "$20 por visita" (o "Tarifa por visita" si aún no la tiene). */
export function visitLabel(rate: number | undefined): string {
  return rate && rate > 0 ? `${formatPrice(rate)} por visita` : 'Tarifa por visita';
}
