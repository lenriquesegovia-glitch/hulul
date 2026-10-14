import type { CategorySlug } from './categories';

/**
 * Modelos de datos. Pensados para Firestore: cada interfaz es un documento
 * de la colección indicada en el comentario.
 */

/** Colección `professionals` */
export interface Professional {
  id: string;
  name: string;
  initials: string;
  /** true = empresa con varios técnicos */
  isCompany: boolean;
  category: CategorySlug;
  cities: string[];
  zone: string;
  bio: string;
  years: number;
  hourlyRate: number;
  minimumBooking: number;
  rating: number;
  reviewCount: number;
  jobsDone: number;
  verified: boolean;
  availableToday: boolean;
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

export type PaymentMethod = 'tarjeta' | 'transferencia' | 'deuna';

/** Colección `bookings` */
export interface Booking {
  id: string;
  clientId: string;
  professionalId: string;
  category: CategorySlug;
  /** ISO 8601, hora de Ecuador */
  scheduledAt: string;
  hours: number;
  address: string;
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
