/**
 * Conexión con Firebase, compartida por la web y la app.
 *
 * Estos valores son identificadores públicos del proyecto (van dentro de toda
 * web o app que usa Firebase). La seguridad de los datos la dan las reglas de
 * `firestore.rules`, no este archivo.
 *
 * Se importa por separado (`@hulul/shared/firebase`) para que las páginas que
 * no guardan datos no carguen Firebase.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, query, serverTimestamp, setDoc, where, type Firestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { PRIVACY_VERSION } from './legal';
import type { CategorySlug } from './categories';
import type { LatLng, PaymentMethod, Professional } from './models';
import { sortPros, toProfessional, type PublicPro } from './demo-data';

export const firebaseConfig = {
  apiKey: 'AIzaSyAR2w6K7JXPHyPvfLb3piv--48T3gvlL2o',
  authDomain: 'hulul-59081.firebaseapp.com',
  projectId: 'hulul-59081',
  storageBucket: 'hulul-59081.firebasestorage.app',
  messagingSenderId: '1070795690327',
  appId: '1:1070795690327:web:7efec3345f19e7fc6d6e12',
  measurementId: 'G-ET4BRZTT43',
};

export function firebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

let db: Firestore | null = null;
export function firestore(): Firestore {
  if (!db) db = getFirestore(firebaseApp());
  return db;
}

/** Tiempo máximo de espera para que el servidor confirme un guardado. */
const SAVE_TIMEOUT_MS = 20_000;

/**
 * Firestore no falla sin conexión: deja el guardado en espera. Para no dejar
 * al usuario esperando indefinidamente, se corta a los 20 segundos.
 */
function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), SAVE_TIMEOUT_MS);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Datos de una reserva tal como la envía la web o la app. */
export interface NewBooking {
  source: 'web' | 'app';
  /** Cuenta del cliente (uid de Firebase Authentication). */
  clientId?: string;
  professionalId: string;
  professionalName: string;
  category: CategorySlug;
  /** Fecha del servicio, AAAA-MM-DD */
  date: string;
  /** Hora de llegada, HH:MM */
  slot: string;
  hours: number;
  address: string;
  /** Punto marcado en el mapa (opcional). */
  location?: LatLng;
  notes: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  paymentMethod: PaymentMethod;
  subtotal: number;
  fee: number;
  iva: number;
  total: number;
  consentMarketing: boolean;
  /** true mientras los profesionales sean de ejemplo. */
  demo: boolean;
}

/**
 * Guarda una reserva en la colección `bookings`.
 * Incluye la prueba del consentimiento (versión de la política y fecha del
 * servidor), como exige la LOPDP.
 */
export async function saveBooking({ location, ...b }: NewBooking): Promise<string> {
  const ref = await withTimeout(addDoc(collection(firestore(), 'bookings'), {
    ...b,
    // Firestore no acepta campos vacíos (undefined): solo se envía si existe.
    ...(location ? { location: { lat: location.lat, lng: location.lng } } : {}),
    status: 'pendiente',
    consentPrivacy: true,
    privacyVersion: PRIVACY_VERSION,
    createdAt: serverTimestamp(),
  }));
  return ref.id;
}

/** Solicitud de un profesional que quiere trabajar con HULUL. */
export interface NewApplication {
  name: string;
  phone: string;
  category: CategorySlug;
  city: string;
  experience: string;
  consentMarketing: boolean;
}

/** Guarda la solicitud en la colección `applications` para revisarla. */
export async function saveApplication(a: NewApplication): Promise<string> {
  const ref = await withTimeout(addDoc(collection(firestore(), 'applications'), {
    ...a,
    status: 'nueva',
    consentPrivacy: true,
    privacyVersion: PRIVACY_VERSION,
    createdAt: serverTimestamp(),
  }));
  return ref.id;
}

/** Fecha AAAA-MM-DD de dentro de `offset` días, en la hora local del dispositivo. */
export function dateInDays(offset: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(from.getDate() + offset);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/* ------------------------------------------------------------------ */
/* Cuentas de cliente (web y app)                                       */
/* ------------------------------------------------------------------ */

/** Perfil del cliente en `clients/{uid}`. */
export interface ClientProfile {
  name: string;
  phone: string;
  email: string;
  consentMarketing: boolean;
}

export async function loadClientProfile(uid: string): Promise<ClientProfile | null> {
  const snap = await getDoc(doc(firestore(), 'clients', uid));
  return snap.exists() ? (snap.data() as ClientProfile) : null;
}

/** Crea el perfil (la primera vez). Guarda la prueba del consentimiento. */
export async function createClientProfile(uid: string, p: ClientProfile): Promise<void> {
  await withTimeout(setDoc(doc(firestore(), 'clients', uid), {
    ...p,
    uid,
    consentPrivacy: true,
    privacyVersion: PRIVACY_VERSION,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
}

export interface ClientBooking {
  id: string;
  category: CategorySlug;
  professionalName: string;
  date: string;
  slot: string;
  total: number;
  status: string;
  notes?: string;
  /** Cargo cobrado al cancelar (USD). */
  cancelFee?: number;
  demo?: boolean;
}

/** Reservas del cliente, de la más próxima a la más antigua. */
export async function clientBookings(uid: string): Promise<ClientBooking[]> {
  const snap = await getDocs(query(collection(firestore(), 'bookings'), where('clientId', '==', uid)));
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClientBooking, 'id'>) }));
  return list.sort((a, b) => (a.date + a.slot < b.date + b.slot ? 1 : -1));
}

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  pendiente: 'Por confirmar', confirmada: 'Confirmada', en_camino: 'En camino', en_curso: 'En curso',
  por_aprobar: 'Por aprobar', completada: 'Completada', cancelada: 'Cancelada', en_disputa: 'En revisión',
};

/** Pasos del seguimiento, en orden (estilo paquete). */
export const TRACK_STEPS: { status: string; label: string }[] = [
  { status: 'pendiente', label: 'Recibida' },
  { status: 'confirmada', label: 'Confirmada' },
  { status: 'en_camino', label: 'En camino' },
  { status: 'en_curso', label: 'En curso' },
  { status: 'por_aprobar', label: 'Terminado' },
];

/** Próxima reserva activa del cliente (no completada ni cancelada), o null. */
export function activeBooking(list: ClientBooking[]): ClientBooking | null {
  const live = list.filter((b) => !['completada', 'cancelada'].includes(b.status));
  return live.length ? [...live].sort((a, b) => (a.date + a.slot > b.date + b.slot ? 1 : -1))[0] : null;
}

/* ------------------------ Directorio de profesionales ------------------------ */

/** Profesionales aprobados de una categoría (y ciudad, si se indica). */
export async function listPros(category: CategorySlug, city?: string): Promise<Professional[]> {
  const snap = await getDocs(query(collection(firestore(), 'pros'), where('categories', 'array-contains', category)));
  const list = snap.docs.map((d) => toProfessional({ ...(d.data() as PublicPro), uid: d.id }, category));
  return sortPros(city ? list.filter((p) => p.cities.includes(city)) : list);
}

/** Un profesional aprobado; `category` elige con qué tarifa se muestra. */
export async function loadPro(id: string, category?: CategorySlug): Promise<Professional | null> {
  const snap = await getDoc(doc(firestore(), 'pros', id));
  return snap.exists() ? toProfessional({ ...(snap.data() as PublicPro), uid: snap.id }, category) : null;
}

/* ------------------------------ Cancelación ------------------------------ */

/** Cancela una reserva del cliente. El servidor calcula y devuelve el cargo. */
export async function cancelBooking(id: string, reason = ''): Promise<{ fee: number }> {
  const fn = httpsCallable<{ id: string; reason: string }, { fee: number }>(getFunctions(firebaseApp(), 'southamerica-east1'), 'cancelarReserva');
  const res = await fn({ id, reason });
  return res.data;
}

/** Mensaje claro para un error al cancelar. */
export function cancelErrorMessage(e: unknown): string {
  const msg = (e as { message?: string }).message ?? '';
  const code = (e as { code?: string }).code ?? '';
  if (code.includes('unavailable') || code.includes('internal') || !msg) return 'No pudimos cancelar en este momento. Revisa tu conexión e inténtalo de nuevo.';
  return msg;
}

/* --------------------------- Agenda del profesional --------------------------- */

export type ProAction = 'aceptar' | 'rechazar' | 'en_camino' | 'llegue' | 'terminar' | 'no_puedo';

/** El profesional cambia el estado de una reserva suya (lo valida el servidor). */
export async function proAction(id: string, action: ProAction, reason = ''): Promise<{ status: string }> {
  const fn = httpsCallable<{ id: string; action: ProAction; reason: string }, { status: string }>(getFunctions(firebaseApp(), 'southamerica-east1'), 'gestionarReserva');
  return (await fn({ id, action, reason })).data;
}

export interface ProBooking {
  id: string;
  category: CategorySlug;
  date: string;
  slot: string;
  hours: number;
  address: string;
  location?: LatLng;
  notes: string;
  contactName: string;
  contactPhone: string;
  paymentMethod: PaymentMethod;
  subtotal: number;
  total: number;
  status: string;
  demo?: boolean;
  cancelledBy?: string;
}
