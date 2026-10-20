import type { CategorySlug } from './categories';
import { cities } from './cities';
import type { Professional } from './models';
import { CATEGORY_PRICING, clampRate } from './provider';

/**
 * Directorio de profesionales REALES.
 *
 * Ya no hay profesionales de ejemplo: solo aparecen quienes se registraron y
 * HULUL aprobó. Al aprobar (status "aprobado" en `providers/{uid}`), una
 * función copia sus datos públicos a `pros/{uid}`, que cualquiera puede leer.
 * Cédula, RUC, celular, correo, documentos y banco nunca salen de `providers`.
 */
export interface PublicPro {
  uid: string;
  name: string;
  initials: string;
  isCompany: boolean;
  categories: CategorySlug[];
  services: Partial<Record<CategorySlug, string[]>>;
  /** Tarifa por visita por categoría. */
  visitRates: Partial<Record<CategorySlug, number>>;
  cities: string[];
  years: number;
  bio: string;
  days: number[];
  from: string;
  to: string;
  acceptsCash: boolean;
  rating: number;
  reviewCount: number;
  jobsDone: number;
  /** Profesional de pruebas: horario libre durante el periodo de prueba. */
  tester?: boolean;
  offHours?: number[];
  holidays?: boolean;
  surcharges?: { nocturno?: number; feriado?: number };
}

/** Día de la semana en Ecuador (0 = domingo). */
function weekdayEcuador(now = new Date()): number {
  return new Date(now.getTime() - 5 * 3_600_000).getUTCDay();
}

/** Ficha pública → tarjeta de profesional para una categoría. */
export function toProfessional(p: PublicPro, category?: CategorySlug): Professional {
  const cat = category && p.categories.includes(category) ? category : p.categories[0];
  return {
    id: p.uid,
    name: p.name,
    initials: p.initials,
    isCompany: p.isCompany,
    category: cat,
    categories: p.categories,
    services: p.services?.[cat] ?? [],
    cities: p.cities,
    zone: p.cities.map((c) => cities.find((x) => x.slug === c)?.name ?? c).join(' · '),
    bio: p.bio,
    years: p.years,
    // Fichas publicadas antes del precio por visita (18-oct-2026): tarifa sugerida.
    // Siempre dentro de la banda permitida de la categoría.
    visitRate: cat ? clampRate(cat, p.visitRates?.[cat] ?? CATEGORY_PRICING[cat]?.suggested ?? 20) : 0,
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    jobsDone: p.jobsDone ?? 0,
    verified: true,
    availableToday: (p.days ?? []).includes(weekdayEcuador()),
    hours: p.from && p.to ? `${p.from} a ${p.to}` : undefined,
    workDays: p.days,
    from: p.from || undefined,
    to: p.to || undefined,
    tester: !!p.tester,
    offHours: Array.isArray(p.offHours) ? p.offHours : [],
    holidays: !!p.holidays,
    surcharges: p.surcharges ?? {},
  };
}

/** Los mejor calificados primero; los nuevos, después. */
export function sortPros(list: Professional[]): Professional[] {
  return [...list].sort((a, b) => (b.reviewCount > 0 ? 1 : 0) - (a.reviewCount > 0 ? 1 : 0) || b.rating - a.rating || b.jobsDone - a.jobsDone);
}

export function formatRating(r: number): string {
  return r.toFixed(1).replace('.', ',');
}

/** "★ 4,9 (12)" o "Nuevo en HULUL" si aún no tiene reseñas. */
export function ratingLabel(p: Pick<Professional, 'rating' | 'reviewCount'>): string {
  return p.reviewCount > 0 ? `★ ${formatRating(p.rating)} (${p.reviewCount})` : 'Nuevo en HULUL';
}

/** Enlace a la ficha o a la reserva, con la categoría elegida. */
export function proHref(kind: 'profesional' | 'reservar', p: Pick<Professional, 'id' | 'category'>, job?: string): string {
  const q = new URLSearchParams({ c: p.category });
  if (job) q.set('trabajo', job);
  return `/${kind}/${p.id}?${q.toString()}`;
}
