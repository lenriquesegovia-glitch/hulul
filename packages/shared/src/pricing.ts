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

import { CATEGORY_FLOORS } from './provider';
import type { CategorySlug } from './categories';

export interface Quote {
  /** Cargo de visita de la categoría. */
  visit: number;
  /** Horas × tarifa. */
  labor: number;
  subtotal: number;
  fee: number;
  iva: number;
  total: number;
  /** Lo que recibe el profesional después de la comisión. */
  proPayout: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Precio: cargo de visita de la categoría + horas × tarifa del profesional. */
export function quote(hourlyRate: number, hours: number, visit = 0): Quote {
  const labor = round2(hourlyRate * hours);
  const subtotal = round2(visit + labor);
  const fee = PROTECTION_FEE;
  const iva = round2((subtotal + fee) * IVA);
  const total = round2(subtotal + fee + iva);
  const proPayout = round2(subtotal * (1 - COMMISSION_RATE));
  return { visit, labor, subtotal, fee, iva, total, proPayout };
}

export function formatUSD(n: number): string {
  return '$' + n.toFixed(2);
}

/** "$36" o "$36.50": precios cortos para tarjetas y etiquetas. */
export function formatPrice(n: number): string {
  return '$' + (Number.isInteger(n) ? String(n) : n.toFixed(2));
}

/** Precio de la categoría (visita, horas mínimas y tarifa mínima). */
export function categoryPricing(slug: CategorySlug) {
  return CATEGORY_FLOORS[slug];
}

/** "Visita $15 · mín. 1 h" o "Mínimo 4 h" si la categoría no cobra visita. */
export function minimumLabel(p: { category: CategorySlug }): string {
  const f = CATEGORY_FLOORS[p.category];
  return f.visit > 0 ? `Visita ${formatPrice(f.visit)} · mín. ${f.hours} h` : `Mínimo ${f.hours} h`;
}
