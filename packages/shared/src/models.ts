import type { CategorySlug } from './categories';
import type { TaxRegime } from './tax';

/**
 * Modelos de datos. Pensados para Firestore: cada interfaz es un documento
 * de la colección indicada en el comentario.
 */

/** Colección `professionals` */
export interface Professional {
  id: string;
  name: string;
  initials: string;
  photoUrl?: string;
  /** true = empresa con varios técnicos */
  isCompany: boolean;
  category: CategorySlug;
  cities: string[];
  zone: string;
  bio: string;
  years: number;
  /** Tarifa por visita en esta categoría (USD). */
  visitRate: number;
  rating: number;
  reviewCount: number;
  jobsDone: number;
  verified: boolean;
  availableToday: boolean;
  /** Todas sus categorías (máx. 3). */
  categories?: CategorySlug[];
  /** Trabajos que marcó en esta categoría. */
  services?: string[];
  /** Horario, p. ej. "08:00 a 18:00". */
  hours?: string;
  /** Días que atiende (0 = domingo) y su horario. */
  workDays?: number[];
  from?: string;
  to?: string;
  /** Profesional de pruebas: horario libre durante el periodo de prueba. */
  tester?: boolean;
  /** Horas fuera de horario (0–7, 18–23) en que acepta llegar. */
  offHours?: number[];
  /** Atiende feriados. */
  holidays?: boolean;
  /** Recargos en monto fijo (USD) para noche y feriado. */
  surcharges?: { nocturno?: number; feriado?: number };
  /** Régimen tributario: define si la visita lleva IVA. */
  taxRegime?: TaxRegime;
}

export type BookingStatus =
  | 'pendiente'      // el cliente reservó, falta que el profesional acepte
  | 'confirmada'     // el profesional aceptó, pago retenido
  | 'en_camino'
  | 'en_curso'
  | 'por_aprobar'    // el profesional terminó, el cliente debe aprobar
  | 'completada'     // pago liberado al profesional
  | 'cancelada'
  | 'en_disputa';

/** Punto en el mapa (grados decimales, WGS 84). */
export interface LatLng {
  lat: number;
  lng: number;
}

export type PaymentMethod = 'tarjeta' | 'transferencia' | 'deuna';

/** Colección `bookings` */
export interface Booking {
  id: string;
  clientId: string;
  professionalId: string;
  category: CategorySlug;
  /** ISO 8601, hora de Ecuador */
  scheduledAt: string;
  /** Duración estimada (horas), solo para el horario. */
  hours: number;
  address: string;
  /** Punto marcado en el mapa, si el cliente lo marcó. */
  location?: LatLng;
  notes: string;
  paymentMethod: PaymentMethod;
  subtotal: number;
  fee: number;
  iva: number;
  total: number;
  status: BookingStatus;
  createdAt: string;
}

/** Colección `reviews` */
export interface Review {
  id: string;
  bookingId: string;
  professionalId: string;
  clientName: string;
  zone: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  createdAt: string;
}
