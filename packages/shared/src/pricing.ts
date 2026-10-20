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
import { chargesVat, regimeOf, type TaxRegime } from './tax';

/** Una factura: base, IVA y total. */
export interface InvoiceLine { base: number; iva: number; total: number }

export interface Quote {
  /** Tarifa por visita del profesional. */
  visit: number;
  /** Recargo nocturno o de feriado del profesional (monto fijo, 0 si no aplica). */
  surcharge: number;
  /** Visita + recargo (base de la factura del profesional, sin IVA). */
  subtotal: number;
  /** Cargo de plataforma de HULUL (sin IVA). */
  fee: number;
  /** IVA total que paga el cliente (visita, si el régimen lo cobra, + plataforma). */
  iva: number;
  total: number;
  /** Régimen del profesional con que se calculó. */
  regime: TaxRegime;
  /** Factura del profesional al cliente por la visita. */
  proInvoice: InvoiceLine;
  /** Factura de HULUL al cliente por el cargo de plataforma. */
  platformInvoice: InvoiceLine;
  /** Comisión de HULUL que se le factura al profesional. */
  commission: InvoiceLine;
  /** Ingreso del profesional por la visita, después de la comisión (sin IVA). */
  proPayout: number;
  /** Lo que HULUL le transfiere por esta visita pagada con tarjeta (antes de retenciones). */
  proTransfer: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function line(base: number, vat: boolean): InvoiceLine {
  const b = round2(base);
  const iva = vat ? round2(b * IVA) : 0;
  return { base: b, iva, total: round2(b + iva) };
}

/**
 * Precio por cita, como un taxi: tarifa por visita del profesional + cargo de
 * plataforma + IVA. La visita cubre traslado, diagnóstico y el trabajo que se
 * pueda resolver en ella. Lo que haga falta después (repuestos, más trabajo)
 * lo acuerdan directamente el cliente y el profesional.
 * Fuera de horario o en feriado se suma el recargo fijo del profesional; la
 * comisión de HULUL aplica sobre visita + recargo (sin IVA).
 * La visita lleva IVA solo si el régimen del profesional lo cobra (RIMPE
 * negocio popular no cobra IVA). Misma fórmula en functions/index.js.
 */
export function quote(visitRate: number, surchargeAmount = 0, regime?: TaxRegime): Quote {
  const reg = regimeOf(regime);
  const visit = round2(visitRate);
  const surcharge = round2(Math.max(0, surchargeAmount || 0));
  const subtotal = round2(visit + surcharge);
  const fee = PROTECTION_FEE;
  const proInvoice = line(subtotal, chargesVat(reg));
  const platformInvoice = line(fee, true);
  const commission = line(subtotal * COMMISSION_RATE, true);
  const iva = round2(proInvoice.iva + platformInvoice.iva);
  const total = round2(proInvoice.total + platformInvoice.total);
  const proPayout = round2(subtotal - commission.base);
  const proTransfer = round2(proInvoice.total - commission.total);
  return { visit, surcharge, subtotal, fee, iva, total, regime: reg, proInvoice, platformInvoice, commission, proPayout, proTransfer };
}

/**
 * Cobro adicional (repuestos, más trabajo u otra visita) que el profesional
 * agrega en la app y el cliente acepta. Lo factura el profesional (con IVA si
 * su régimen lo cobra); HULUL retiene la misma comisión que en la visita. No
 * lleva otro cargo de plataforma.
 */
export interface ExtraQuote { amount: number; iva: number; total: number; commission: number; commissionIva: number; proPayout: number }

export function extraQuote(amount: number, regime?: TaxRegime): ExtraQuote {
  const inv = line(amount, chargesVat(regime));
  const com = line(inv.base * COMMISSION_RATE, true);
  return { amount: inv.base, iva: inv.iva, total: inv.total, commission: com.base, commissionIva: com.iva, proPayout: round2(inv.base - com.base) };
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
