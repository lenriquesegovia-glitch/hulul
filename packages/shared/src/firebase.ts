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
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, type Firestore, type Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { PRIVACY_VERSION } from './legal';
import type { CategorySlug } from './categories';
import type { LatLng, PaymentMethod, Professional } from './models';
import { sortPros, toProfessional, type PublicPro } from './demo-data';
import type { JobOutcome } from './policy';
import type { CategoryEvidence } from './provider';
import type { TaxRegime } from './tax';
import { featuredHomeServices, validateHomeDiscovery } from './home-discovery';

/** Read-only aggregate; unavailable or stale recommendations never block booking. */
export async function loadHomeDiscovery() {
  try {
    const response = await httpsCallable<undefined, unknown>(getFunctions(firebaseApp(), 'southamerica-east1'), 'homeDiscovery', { timeout: 5000 })();
    return validateHomeDiscovery(response.data);
  } catch {
    return featuredHomeServices;
  }
}

/**
 * Dominio de las ventanas de Google, Outlook y Facebook. Por defecto el de
 * Firebase. En la web, al poner NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=hululec.com en
 * Vercel, esas ventanas dicen "hululec.com" y el acceso funciona en Safari y en
 * navegadores que bloquean cookies de terceros (next.config.ts reenvía /__/auth).
 * Antes de activarlo, agregar https://hululec.com/__/auth/handler como URI de
 * redirección en Google Cloud, Microsoft Entra y Meta for Developers.
 */
const authDomain = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) || 'hulul-59081.firebaseapp.com';

export const firebaseConfig = {
  apiKey: 'AIzaSyAR2w6K7JXPHyPvfLb3piv--48T3gvlL2o',
  authDomain,
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
/**
 * Función del servidor con mensajes claros: si el servidor no responde o la
 * función aún no está publicada, explica qué hacer en vez de "internal".
 */
export function friendlyError(e: unknown): Error {
  const code = String((e as { code?: string })?.code ?? '');
  const msg = String((e as { message?: string })?.message ?? '');
  if (['functions/internal', 'functions/not-found', 'functions/unavailable', 'functions/deadline-exceeded'].includes(code) || /^internal$/i.test(msg)) {
    return Object.assign(new Error('No pudimos conectar con el servidor de HULUL. Revisa tu internet e inténtalo de nuevo. (Si acabas de actualizar, falta publicar el servidor.)'), { code });
  }
  return e instanceof Error ? e : new Error(msg || 'Algo salió mal. Inténtalo de nuevo.');
}

function callable<I, O>(name: string) {
  const fn = httpsCallable<I, O>(getFunctions(firebaseApp(), 'southamerica-east1'), name);
  return async (data: I) => {
    try {
      return await fn(data);
    } catch (e) {
      throw friendlyError(e);
    }
  };
}

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
  /** Duración estimada de la visita (horas), solo para el horario. */
  hours: number;
  /** Precio por cita (desde el 18-oct-2026). */
  pricing: 'visita';
  pricingVersion?: 2;
  /** Tarifa por visita del profesional. */
  visit: number;
  /** Recargo nocturno o de feriado (monto fijo del profesional), si aplica. */
  surcharge?: number;
  surchargeKind?: 'nocturno' | 'feriado';
  /** Trabajo con ruido fuera de horario: el cliente aceptó responder ante vecinos y administración. */
  noiseAccepted?: true;
  /** El cliente aceptó el aviso de seguridad en el hogar. */
  safetyAccepted: true;
  /** Fotos del problema (enlaces de descarga), opcionales. */
  photos?: string[];
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
  /** Régimen tributario del profesional (define el IVA de la visita) e IVA de la visita. */
  taxRegime?: TaxRegime;
  visitIva?: number;
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
    // Sin campos vacíos (undefined): Firestore no los acepta.
    ...Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)),
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
  arrivedAt?: { toMillis: () => number };
  dispute?: { kind: string; text: string; status: string; by?: string; outcome?: string };
  claimId?: string;
  delay?: Delay;
  /** Falta del profesional que causó la cancelación (no salió, muy tarde, no se presentó). */
  proFault?: string;
  cancelReason?: string;
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
  professionalId?: string;
  hours?: number;
  address?: string;
  location?: LatLng;
  proposal?: Proposal;
  cancelledBy?: string;
  cancelledAt?: { toMillis(): number } | null;
  /** Tarifa por visita (reservas desde el 18-oct-2026). */
  visit?: number;
  /** Recargo nocturno o de feriado. */
  surcharge?: number;
  surchargeKind?: 'nocturno' | 'feriado';
  subtotal?: number;
  outcome?: JobOutcome;
  diagnosis?: string;
  diagnosisPhotos?: string[];
  extra?: ExtraCharge;
  photos?: string[];
  /** Ya calificó al profesional (estrellas que dio). */
  rating?: number;
}

/** Cambio de hora propuesto por una de las partes. */
export interface Proposal { date: string; slot: string; by: 'cliente' | 'profesional' }

/** Aviso de retraso del profesional (minutos totales sobre la hora reservada). */
export interface Delay { minutes: number; added?: number; reason?: string; status: 'propuesto' | 'aceptado' | 'rechazado' }

/** Minutos que el profesional puede avisar de retraso. */
export const DELAY_OPTIONS = [10, 15, 20, 30, 45, 60, 90];

/** El profesional avisa un retraso; el cliente lo acepta o lo rechaza (cancela sin costo). */
export async function delayAction(data: { id: string; action: 'proponer'; minutes: number; reason?: string } | { id: string; action: 'aceptar' | 'rechazar' }): Promise<void> {
  const fn = callable<typeof data, { ok: boolean }>('avisarRetraso');
  await fn(data);
}

/** Reservas del cliente, de la más próxima a la más antigua. */
export async function clientBookings(uid: string): Promise<ClientBooking[]> {
  const snap = await getDocs(query(collection(firestore(), 'bookings'), where('clientId', '==', uid)));
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClientBooking, 'id'>) }));
  return list.sort((a, b) => (a.date + a.slot < b.date + b.slot ? 1 : -1));
}

/**
 * Reserva terminada que el cliente aún no calificó (la más reciente). Mientras
 * exista, no puede hacer otra reserva: la app y la web le piden calificar primero
 * y el servidor anula una reserva nueva si llega sin esa calificación.
 */
export function pendingRating(list: ClientBooking[]): ClientBooking | null {
  return list
    .filter((b) => ['completada', 'por_aprobar'].includes(b.status) && !b.rating && b.extra?.status !== 'propuesto')
    .sort((a, b) => (a.date + a.slot < b.date + b.slot ? 1 : -1))[0] ?? null;
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
  // Terminada (por aprobar), completada, cancelada o en revisión ya no se sigue en el inicio,
  // ni las reservas cuya hora pasó hace más de 12 horas (pruebas viejas o sin respuesta).
  const now = Date.now();
  const at = (b: ClientBooking) => {
    const [y, m, d] = String(b.date).split('-').map(Number);
    const [h, min] = String(b.slot).split(':').map(Number);
    return Date.UTC(y, m - 1, d, h + 5, min || 0);
  };
  const live = list.filter((b) => !['por_aprobar', 'completada', 'cancelada', 'en_disputa'].includes(b.status) && at(b) > now - 12 * 3_600_000);
  return live.length ? [...live].sort((a, b) => (a.date + a.slot > b.date + b.slot ? 1 : -1))[0] : null;
}

/* ------------------------ Directorio de profesionales ------------------------ */

/** Profesionales aprobados de una categoría (y ciudad, si se indica). */
export async function listPros(category: CategorySlug, city?: string): Promise<Professional[]> {
  const snap = await getDocs(query(collection(firestore(), 'pros'), where('categories', 'array-contains', category)));
  // Los suspendidos no aparecen hasta que termine la suspensión.
  const list = snap.docs.filter((d) => !(Number(d.data().suspendedUntil ?? 0) > Date.now())).map((d) => toProfessional({ ...(d.data() as PublicPro), uid: d.id }, category));
  return sortPros(city ? list.filter((p) => p.cities.includes(city)) : list);
}

/** Un profesional aprobado; `category` elige con qué tarifa se muestra. */
export async function loadPro(id: string, category?: CategorySlug): Promise<Professional | null> {
  const snap = await getDoc(doc(firestore(), 'pros', id));
  if (snap.exists() && Number(snap.data().suspendedUntil ?? 0) > Date.now()) return null;
  return snap.exists() ? toProfessional({ ...(snap.data() as PublicPro), uid: snap.id }, category) : null;
}

/** Tarifas por visita de los profesionales aprobados de una categoría (para los precios de referencia). */
export async function categoryRates(category: CategorySlug, exceptUid?: string): Promise<number[]> {
  const snap = await getDocs(query(collection(firestore(), 'pros'), where('categories', 'array-contains', category)));
  return snap.docs
    .filter((d) => d.id !== exceptUid)
    .map((d) => Number((d.data() as PublicPro).visitRates?.[category]))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/* --------------------------- Ubicación en vivo --------------------------- */

/**
 * Ubicación del profesional mientras va en camino: `tracking/{reserva}`.
 * La escribe solo el profesional asignado (con la reserva confirmada, en
 * camino o en curso) y la leen él y el cliente de esa reserva.
 */
export interface LivePosition {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  /** Cuándo se tomó (hora del servidor). */
  at?: Date;
}

/** El profesional comparte su posición actual. */
export async function shareLivePosition(bookingId: string, p: { lat: number; lng: number; accuracy?: number | null; heading?: number | null }): Promise<void> {
  await setDoc(doc(firestore(), 'tracking', bookingId), {
    lat: p.lat,
    lng: p.lng,
    accuracy: typeof p.accuracy === 'number' && Number.isFinite(p.accuracy) ? Math.round(p.accuracy) : 0,
    heading: typeof p.heading === 'number' && Number.isFinite(p.heading) ? Math.round(p.heading) : -1,
    at: serverTimestamp(),
  });
}

/** El cliente (o el profesional) sigue la posición en vivo. Devuelve la función para dejar de escuchar. */
export function watchLivePosition(bookingId: string, cb: (p: LivePosition | null) => void): () => void {
  return onSnapshot(doc(firestore(), 'tracking', bookingId), (snap) => {
    if (!snap.exists()) { cb(null); return; }
    const d = snap.data() as { lat: number; lng: number; accuracy?: number; heading?: number; at?: Timestamp };
    cb({ lat: d.lat, lng: d.lng, accuracy: d.accuracy, heading: d.heading, at: d.at?.toDate?.() });
  }, () => cb(null));
}

/* ---------------------------- Cobro adicional ---------------------------- */

export type ExtraStatus = 'propuesto' | 'por_cobrar' | 'pagado' | 'efectivo_pendiente' | 'pagado_efectivo' | 'rechazado';

/** Cobro adicional de una reserva (lo propone el profesional y lo acepta el cliente). */
export interface ExtraCharge {
  amount: number;
  description: string;
  iva: number;
  total: number;
  commission: number;
  status: ExtraStatus;
  method?: 'tarjeta' | 'efectivo';
}

export const EXTRA_STATUS_LABEL: Record<ExtraStatus, string> = {
  propuesto: 'Esperando que el cliente acepte',
  por_cobrar: 'Aceptado: se cobra con tarjeta',
  pagado: 'Pagado con tarjeta',
  efectivo_pendiente: 'Aceptado: se paga en efectivo',
  pagado_efectivo: 'Pagado en efectivo',
  rechazado: 'El cliente no lo aceptó',
};

export type ExtraAction =
  | { id: string; action: 'proponer'; amount: number; description: string }
  | { id: string; action: 'aceptar'; method: 'tarjeta' | 'efectivo' }
  | { id: string; action: 'rechazar' }
  | { id: string; action: 'recibi_efectivo' };

/** Proponer, aceptar, rechazar o confirmar el pago de un cobro adicional (lo valida el servidor). */
export async function extraCharge(data: ExtraAction): Promise<void> {
  const fn = callable<ExtraAction, { ok: boolean }>('cobroAdicional');
  await fn(data);
}

/* ----------------------------------- Chat ----------------------------------- */

/**
 * Chat dentro de la reserva (como Uber o Pedidos Ya): cliente y profesional
 * hablan sin compartir su número. `bookings/{id}/messages/{mensaje}`.
 */
export type ChatKind = 'texto' | 'foto' | 'pedir_fotos';
export interface ChatMessage {
  id: string;
  from: 'cliente' | 'profesional';
  uid: string;
  kind: ChatKind;
  text?: string;
  photo?: string;
  at?: Date;
}

/** Estados en los que se puede escribir (después solo se lee). */
export const CHAT_OPEN_STATUSES = ['pendiente', 'confirmada', 'en_camino', 'en_curso', 'por_aprobar'];

export async function sendChat(bookingId: string, m: { from: 'cliente' | 'profesional'; uid: string; kind: ChatKind; text?: string; photo?: string }): Promise<void> {
  await addDoc(collection(firestore(), 'bookings', bookingId, 'messages'), {
    from: m.from, uid: m.uid, kind: m.kind,
    ...(m.text ? { text: m.text.slice(0, 1000) } : {}),
    ...(m.photo ? { photo: m.photo } : {}),
    at: serverTimestamp(),
  });
}

export function watchChat(bookingId: string, cb: (list: ChatMessage[]) => void): () => void {
  return onSnapshot(query(collection(firestore(), 'bookings', bookingId, 'messages'), orderBy('at', 'asc'), limit(300)), (snap) => {
    cb(snap.docs.map((d) => {
      const x = d.data() as Omit<ChatMessage, 'id' | 'at'> & { at?: Timestamp };
      return { id: d.id, from: x.from, uid: x.uid, kind: x.kind, text: x.text, photo: x.photo, at: x.at?.toDate?.() };
    }));
  }, () => cb([]));
}

/* ---------------------------- Código de llegada ---------------------------- */

/** Código de 4 dígitos que el cliente le da al profesional para empezar (solo lo lee el cliente). */
export function watchArrivalCode(bookingId: string, cb: (code: string | null) => void): () => void {
  return onSnapshot(doc(firestore(), 'bookings', bookingId, 'private', 'llegada'),
    (snap) => cb(snap.exists() ? String((snap.data() as { code?: string }).code ?? '') || null : null), () => cb(null));
}

/* ---------------------------------- Reclamos ---------------------------------- */

/** Para cuando el profesional marcó "cliente ausente" y el cliente sí estaba. */
export const ABSENT_PROBLEM_OPTIONS: { value: 'si_estaba' | 'otro'; label: string }[] = [
  { value: 'si_estaba', label: 'Yo estaba en casa y no me avisaron' },
  { value: 'otro', label: 'Otra cosa' },
];

export const PROBLEM_OPTIONS: { value: 'no_vino' | 'incompleto' | 'cobro' | 'trato' | 'dano' | 'otro'; label: string }[] = [
  { value: 'no_vino', label: 'No hizo el trabajo o se fue sin hacerlo' },
  { value: 'incompleto', label: 'Marcó como resuelto, pero no quedó resuelto' },
  { value: 'cobro', label: 'Me cobró algo distinto a lo acordado' },
  { value: 'trato', label: 'Me trató mal o fue irrespetuoso' },
  { value: 'dano', label: 'Dañó algo de mi casa' },
  { value: 'otro', label: 'Otro problema' },
];

/** Lo que puede reportar el profesional sobre el cliente. */
export const PRO_PROBLEM_OPTIONS: { value: 'agresion' | 'no_pago' | 'dano' | 'adicional' | 'no_dejo' | 'otro'; label: string }[] = [
  { value: 'agresion', label: 'Me trató mal o fue agresivo' },
  { value: 'no_pago', label: 'No me pagó lo acordado' },
  { value: 'dano', label: 'Dañó mis herramientas o equipo' },
  { value: 'adicional', label: 'Rechazó un cobro adicional justificado' },
  { value: 'no_dejo', label: 'No me dejó trabajar o no me abrió' },
  { value: 'otro', label: 'Otra cosa' },
];

/** Plazos del protocolo de reclamos (los aplica el servidor). */
export const CLAIM_RULES = { windowHours: 48, responseHours: 24, resolveHours: 72, maxPhotos: 6 } as const;

export const CLAIM_STATUS_LABEL: Record<string, string> = {
  esperando_respuesta: 'Esperando la versión de la otra parte',
  en_revision: 'En revisión por HULUL',
  resuelto: 'Resuelto',
};

export interface ClaimDecision {
  outcome: 'cliente' | 'profesional';
  note: string;
  multaPro?: number;
  creditoCliente?: number;
  faltaPro?: boolean;
  faltaCliente?: boolean;
  at: number;
}

export interface Claim {
  id: string;
  code: string;
  bookingId: string;
  openedBy: 'cliente' | 'profesional';
  clientId: string;
  proId: string;
  clientName: string;
  proName: string;
  category: string;
  date: string;
  slot: string;
  kind: string;
  kindLabel: string;
  text: string;
  photos: string[];
  status: 'esperando_respuesta' | 'en_revision' | 'resuelto';
  openedAt: number;
  responseDueAt: number;
  resolveDueAt: number;
  response: { text: string; photos: string[]; at: number; late?: boolean } | null;
  responseMissed?: boolean;
  decision: ClaimDecision | null;
  moneyHeld?: boolean;
}

/** Expediente del reclamo de una reserva (lo ven el cliente y el profesional). null si no hay. */
export function watchClaim(bookingId: string, cb: (c: Claim | null) => void): () => void {
  return onSnapshot(doc(firestore(), 'reclamos', bookingId),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Claim) : null), () => cb(null));
}

/** El cliente reporta un problema (hasta 48 h después): el pago queda retenido y HULUL revisa. */
export async function reportProblem(data: { id: string; kind: string; text: string; photos?: string[] }): Promise<void> {
  const fn = callable<typeof data, { ok: boolean }>('reportarProblema');
  await fn(data);
}

/** El profesional reporta un problema con el cliente (hasta 48 h después). */
export async function reportProblemPro(data: { id: string; kind: string; text: string; photos?: string[] }): Promise<void> {
  await callable<typeof data, { ok: boolean }>('reportarProblemaPro')(data);
}

/** La otra parte da su versión del reclamo (texto y fotos). */
export async function respondClaim(data: { id: string; text: string; photos?: string[] }): Promise<void> {
  await callable<typeof data, { ok: boolean }>('responderReclamo')(data);
}

/** ¿Puede el profesional reportar un problema con el cliente en esta reserva? */
export function proCanReport(b: { status: string; dispute?: unknown; claimId?: string; cancelledBy?: string; finishedAt?: { toMillis: () => number } | null; cancelledAt?: { toMillis: () => number } | null }, now = Date.now()): boolean {
  if (b.dispute || b.claimId) return false;
  const win = CLAIM_RULES.windowHours * 3_600_000;
  const fin = b.finishedAt?.toMillis?.() ?? 0;
  const can = b.cancelledAt?.toMillis?.() ?? 0;
  if (b.status === 'por_aprobar') return true;
  if (b.status === 'completada') return !!fin && now - fin < win;
  if (b.status === 'cancelada') return ['cliente', 'cliente_ausente'].includes(String(b.cancelledBy)) && !!can && now - can < win;
  return false;
}

/* ------------------------- Panel de reclamos (HULUL) ------------------------- */

export interface ClaimListItem {
  id: string; code: string; openedBy: 'cliente' | 'profesional'; kindLabel: string; status: Claim['status']; openedAt: number;
  responseDueAt: number; resolveDueAt: number; hasResponse: boolean; decision: 'cliente' | 'profesional' | null;
  clientName: string; proName: string; category: string; date: string; slot: string; moneyHeld: boolean;
  /** Sugerencia del asistente para reclamos abiertos. */
  suggestion?: { side: 'cliente' | 'profesional' | null; confidence: string } | null;
}

export interface ClaimFile {
  claim: Claim & { privado?: { apertura?: string; respuesta?: string } };
  booking: Record<string, unknown> & {
    status: string; address: string; notes: string; paymentMethod: string; contactName: string; contactPhone: string; contactEmail: string; professionalName: string;
    diagnosis: string; diagnosisPhotos: string[]; photos: string[]; rings: number[]; arrivedPos: { distance?: number; accuracy?: number } | null;
  };
  parties: { client: { reclamos: number; strikes: number }; pro: { reclamos: number; strikes: number; rating: number | null; phone: string } };
  messages: { id: string; from: string; kind: string; text: string; photo: string; at: number; original: string | null }[];
  stats: Record<'cliente' | 'profesional', { count: number; replies: number; avgMin: number | null; maxMin: number | null }>;
  timeline: { at: number; who: string; what: string; detail: string }[];
  accesses: { email: string; action: string; at: number }[];
  revealed: boolean;
  advice?: ClaimAdvice;
}

export interface ClaimDecisionDraft { outcome: 'cliente' | 'profesional'; multaPro: number; creditoCliente: number; faltaPro: boolean; faltaCliente: boolean; note: string }
/** Lectura del asistente de reclamos (reglas sobre la evidencia; HULUL decide). */
export interface ClaimAdvice {
  side: 'cliente' | 'profesional' | null; confidence: 'alta' | 'media' | 'baja' | 'sin_datos'; score: number; summary: string;
  reasons: { side: 'cliente' | 'profesional'; weight: number; text: string }[];
  decisions: { cliente: ClaimDecisionDraft; profesional: ClaimDecisionDraft };
}

export async function adminListClaims(): Promise<ClaimListItem[]> {
  return (await callable<Record<string, never>, { items: ClaimListItem[] }>('adminReclamos')({})).data.items;
}

export async function adminGetClaim(id: string, reveal = false): Promise<ClaimFile> {
  return (await callable<{ id: string; reveal: boolean }, ClaimFile>('adminReclamo')({ id, reveal })).data;
}

export async function adminResolveClaim(data: { id: string; outcome: 'cliente' | 'profesional'; note: string; multaPro?: number; creditoCliente?: number; faltaPro?: boolean; faltaCliente?: boolean }): Promise<void> {
  await callable<typeof data, { ok: boolean }>('resolverReclamo')(data);
}

/* ------------------------------ Calificaciones ------------------------------ */

/** El cliente califica al profesional (obligatorio) y a la app (opcional). También cierra el servicio. */
export interface RatingInput {
  id: string;
  proStars: number;
  proComment?: string;
  appStars?: number;
  appComment?: string;
}

export async function rateService(data: RatingInput): Promise<void> {
  const fn = callable<RatingInput, { ok: boolean }>('calificar');
  await fn(data);
}

/** El profesional califica al cliente (solo lo ve HULUL; ayuda a cuidar a los profesionales). */
export async function rateClient(data: { id: string; stars: number; comment?: string }): Promise<void> {
  const fn = callable<{ id: string; stars: number; comment?: string }, { ok: boolean }>('calificarCliente');
  await fn(data);
}

/** Reseña pública de un profesional (colección `reviews`, la escribe el servidor). */
export interface PublicReview {
  id: string;
  clientName: string;
  rating: number;
  text: string;
  category: CategorySlug;
  createdAt?: Date;
}

/** Últimas reseñas de un profesional. */
export async function proReviews(uid: string, max = 10): Promise<PublicReview[]> {
  // Sin orderBy para no necesitar un índice compuesto: se ordena aquí.
  const snap = await getDocs(query(collection(firestore(), 'reviews'), where('professionalId', '==', uid), limit(100)));
  return snap.docs.map((d) => {
    const r = d.data() as { clientName?: string; rating?: number; text?: string; category?: CategorySlug; createdAt?: Timestamp };
    return { id: d.id, clientName: r.clientName ?? 'Cliente', rating: Number(r.rating ?? 0), text: r.text ?? '', category: r.category as CategorySlug, createdAt: r.createdAt?.toDate?.() };
  }).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)).slice(0, max);
}

/* ------------------------- Cierre del servicio ------------------------- */

/** El cliente confirma que el servicio terminó (si no, se cierra solo a las 24 horas). */
export async function confirmService(id: string): Promise<void> {
  const fn = callable<{ id: string }, { ok: boolean }>('confirmarServicio');
  await fn({ id });
}

/* ------------------------------ Notificaciones ------------------------------ */

/** Registra este celular para recibir los avisos (push) de la cuenta con sesión abierta. */
export async function registerPushToken(token: string, platform: string): Promise<void> {
  const fn = callable<{ token: string; platform: string }, { ok: boolean }>('registrarAviso');
  await fn({ token, platform });
}

/* ------------------------ Servicios del profesional ------------------------ */

export type ServicesUpdate =
  | { action: 'tarifas'; visitRates?: Partial<Record<CategorySlug, number>>; services?: Partial<Record<CategorySlug, string[]>> }
  | { action: 'agregar'; category: CategorySlug; visitRate: number; services: string[]; evidence: CategoryEvidence }
  | { action: 'horario'; offHours: number[]; holidays: boolean; surcharges: { nocturno?: number; feriado?: number } };

/** Un profesional aprobado cambia sus tarifas o suma una categoría (queda en revisión). */
export async function updateServices(data: ServicesUpdate): Promise<void> {
  const fn = callable<ServicesUpdate, { ok: boolean }>('actualizarServicios');
  await fn(data);
}

/* ------------------------------ Cancelación ------------------------------ */

/** Cancela una reserva del cliente. El servidor calcula y devuelve el cargo. */
export async function cancelBooking(id: string, reason = ''): Promise<{ fee: number }> {
  const fn = callable<{ id: string; reason: string }, { fee: number }>('cancelarReserva');
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

export type ProAction = 'aceptar' | 'rechazar' | 'en_camino' | 'en_puerta' | 'llegue' | 'terminar' | 'no_puedo' | 'cliente_ausente';

/** Resultado de la visita: lo envía el profesional al terminar. */
export interface VisitReport {
  outcome: JobOutcome;
  diagnosis: string;
  /** Enlaces de descarga de las fotos (Storage, carpeta diagnosticos/{uid}/{reserva}). */
  photos: string[];
}

/** El profesional cambia el estado de una reserva suya (lo valida el servidor). */
export interface ArrivalPos { lat: number; lng: number; accuracy?: number | null }
export async function proAction(id: string, action: ProAction, reason = '', report?: VisitReport, code?: string, pos?: ArrivalPos): Promise<{ status: string }> {
  const fn = callable<{ id: string; action: ProAction; reason: string; code?: string; pos?: ArrivalPos } & Partial<VisitReport>, { status: string }>('gestionarReserva');
  return (await fn({ id, action, reason, ...(report ?? {}), ...(code ? { code } : {}), ...(pos ? { pos } : {}) })).data;
}

/** El profesional, ya en la dirección, timbra al cliente: le llega una notificación con sonido. */
export async function ringClient(id: string): Promise<{ rings: number }> {
  return (await callable<{ id: string }, { rings: number }>('timbrar')({ id })).data;
}

export interface ProBooking {
  id: string;
  /** Cuándo marcó "Estoy en la dirección". */
  arrivedAt?: { toMillis: () => number };
  /** Timbres enviados al cliente después de llegar (milisegundos). */
  rings?: number[];
  dispute?: { kind: string; text: string; status: string; by?: string; outcome?: string };
  claimId?: string;
  finishedAt?: { toMillis: () => number } | null;
  cancelledAt?: { toMillis: () => number } | null;
  delay?: Delay;
  /** Cuándo marcó "Llegué" (para esperar al cliente 10 minutos). */
  startedAt?: { toMillis: () => number };
  professionalId?: string;
  clientId?: string;
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
  proposal?: Proposal;
  visit?: number;
  /** Recargo nocturno o de feriado (va completo al profesional, menos la comisión). */
  surcharge?: number;
  surchargeKind?: 'nocturno' | 'feriado';
  noiseAccepted?: boolean;
  /** Régimen tributario del profesional al reservar (IVA de la visita). */
  taxRegime?: TaxRegime;
  outcome?: JobOutcome;
  diagnosis?: string;
  diagnosisPhotos?: string[];
  photos?: string[];
  /** Estrellas que le dio el cliente y las que el profesional le dio al cliente. */
  rating?: number;
  clientRating?: { stars: number; comment?: string };
  extra?: ExtraCharge;
}

/* ------------------------------ Cambio de hora ------------------------------ */

export type RescheduleAction = 'proponer' | 'aceptar' | 'rechazar' | 'retirar';

/** Proponer, aceptar, rechazar o retirar un cambio de fecha u hora. */
export async function reschedule(id: string, action: RescheduleAction, date?: string, slot?: string): Promise<void> {
  const fn = callable<{ id: string; action: RescheduleAction; date?: string; slot?: string }, { ok: boolean }>('reprogramarReserva');
  await fn({ id, action, date, slot });
}

export interface ClientSummaryData {name:string;count:number;rating:number|null}
export async function loadClientSummary(bookingId:string):Promise<ClientSummaryData> {
 return (await callable<{bookingId:string},ClientSummaryData>('resumenCliente')({bookingId})).data;
}
export interface InboxItem {id:string;title:string;body:string;read:boolean;createdAt?:Timestamp;data:{bookingId?:string;to?:string;chat?:boolean;url?:string}}
export function watchInbox(uid:string,onData:(items:InboxItem[])=>void,onError:()=>void) {
 return onSnapshot(query(collection(firestore(),'inboxes',uid,'items'),orderBy('createdAt','desc'),limit(100)),snap=>onData(snap.docs.map(d=>({id:d.id,...d.data()} as InboxItem))),onError);
}
export async function readInboxItem(uid:string,id:string) {await updateDoc(doc(firestore(),'inboxes',uid,'items',id),{read:true});}

/* ------------------------- Panel de profesionales ------------------------- */

export type ProReviewStatus = 'en_revision' | 'observado' | 'aprobado' | 'rechazado' | 'borrador';
export type ProReviewDecision = 'aprobado' | 'observado' | 'rechazado';

export interface ProListItem {
  uid: string; name: string; kind: string; email: string; phone: string;
  categories: string[]; catStatus: Record<string, string>; proposals: string[]; cities: string[];
  docs: number; status: ProReviewStatus; submittedAt: number | null; reviewedAt: number | null; reviewNote: string;
}

export interface ProFile {
  uid: string;
  provider: {
    status: ProReviewStatus; kind: string; firstName: string; lastName: string; businessName: string; cedula: string; ruc: string;
    phone: string; email: string; years: number; bio: string; categories: string[]; services: Record<string, string[]>;
    visitRates: Record<string, number>; catEvidence: Record<string, { kind: string; note: string; reference?: string; files: string[] }>;
    catStatus: Record<string, string>; proposals: { id: string; name: string; services: string[]; rate?: number; note: string }[];
    cities: string[]; days: number[]; from: string; to: string; acceptsCash: boolean; offHours: number[]; holidays: boolean;
    surcharges: { nocturno?: number; feriado?: number }; taxRegime: string; eSignature: boolean;
    submittedAt: number | null; reviewNote: string; reviewedBy: string; reviewedAt: number | null;
  };
  bank: { bank: string; type: string; number: string; holder: string; holderId: string } | null;
  files: { key: string; label: string; path: string; name: string }[];
  verification: Record<string, { status: string; msg: string; flag: string; current: boolean; checks: Record<string, unknown> }>;
  alerts: string[];
  duplicates: string[];
  history: { decision: string; note: string; by: string; at: number | null; assigned?: { name: string; category: string }[] }[];
}

export async function adminListPros(status: ProReviewStatus): Promise<ProListItem[]> {
  return (await callable<{ status: ProReviewStatus }, { items: ProListItem[] }>('adminProfesionales')({ status })).data.items;
}

export async function adminGetPro(uid: string): Promise<ProFile> {
  return (await callable<{ uid: string }, ProFile>('adminProfesional')({ uid })).data;
}

export async function adminProFile(uid: string, path: string): Promise<{ contentType: string; data: string }> {
  return (await callable<{ uid: string; path: string }, { contentType: string; data: string }>('adminArchivoProfesional')({ uid, path })).data;
}

/** assign: { idDeActividadPropuesta: categoría } suma esa actividad nueva a una categoría existente. */
export async function adminDecidePro(uid: string, decision: ProReviewDecision, note: string, catStatus: Record<string, string>, assign: Record<string, string> = {}): Promise<void> {
  await callable<{ uid: string; decision: ProReviewDecision; note: string; catStatus: Record<string, string>; assign: Record<string, string> }, { ok: boolean }>('decidirProfesional')({ uid, decision, note, catStatus, assign });
}

export type DocVerifyStatus = 'ok' | 'revisar' | 'rechazado';

/** Verifica un documento recién subido (OCR en el servidor; la selfie con la distancia calculada en el celular). */
export async function verifyProviderDoc(key: string, path: string, face?: { distance: number; liveness: boolean; mode: string; tries: number }): Promise<{ status: DocVerifyStatus; msg: string }> {
  return (await callable<{ key: string; path: string; face?: unknown }, { status: DocVerifyStatus; msg: string }>('verificarDocumento')({ key, path, face })).data;
}

/** Resultados de verificación guardados (solo los lee el propio profesional). */
export async function myDocVerification(uid: string): Promise<Record<string, { status: DocVerifyStatus; msg: string; path: string }>> {
  const snap = await getDoc(doc(firestore(), 'providers', uid, 'private', 'verificacion'));
  return (snap.exists() ? snap.data() : {}) as Record<string, { status: DocVerifyStatus; msg: string; path: string }>;
}

/** Sesión para la app después de entrar con Google u Outlook en la web (hululec.com/app-login). */
export async function appLoginToken(): Promise<string> {
  return (await callable<Record<string, never>, { token: string }>('tokenApp')({})).data.token;
}

/** Pase de un solo uso para abrir hululec.com con la sesión de la app (hululec.com/entrar). */
export async function webLoginToken(): Promise<string> {
  return (await callable<Record<string, never>, { token: string }>('tokenWeb')({})).data.token;
}

/* --------------------------- Tablero de administración --------------------------- */

/** Datos del tablero /admin (solo ADMIN_EMAILS). Fechas AAAA-MM-DD; por defecto 180 días atrás y 90 adelante. */
export async function adminDashboard(range?: { desde?: string; hasta?: string }): Promise<import('./dashboard').DashData> {
  return (await callable<{ desde?: string; hasta?: string }, import('./dashboard').DashData>('adminTablero')(range ?? {})).data;
}

/** Marca una liquidación semanal como pagada con la referencia de la transferencia. */
export async function adminMarkPayoutPaid(id: string, reference: string): Promise<void> {
  await callable<{ id: string; reference: string }, { ok: boolean }>('marcarLiquidacion')({ id, reference });
}

/* ------------------------------ Equipo y roles (dueño) ----------------------------- */

export interface AdminMember { email: string; name: string; role: import('./dashboard').AdminRole; active: boolean; addedBy: string; addedAt: number | null; lastSeen: number | null }
export interface AdminTeam { members: AdminMember[]; log: { action: string; by: string; target: string; role: string; at: number | null }[] }

export async function adminTeam(): Promise<AdminTeam> {
  return (await callable<Record<string, never>, AdminTeam>('adminEquipo')({})).data;
}
export async function adminSetRole(input: { email: string; name: string; role: 'socio' | 'contabilidad' | 'cumplimiento' }): Promise<void> {
  await callable<typeof input, { ok: boolean }>('adminGuardarRol')(input);
}
export async function adminRemoveRole(email: string): Promise<void> {
  await callable<{ email: string }, { ok: boolean }>('adminQuitarRol')({ email });
}

/* --------------------------- Pagos masivos (banca web) --------------------------- */

export interface BankFileResult { fileName: string; mime: string; content: string; count: number; total: number; skipped: { id: string; proId: string; name: string; net: number; reason: string }[] }

/** Archivo de la semana para cargar en la banca web (solo roles con permiso de pagos). */
export async function adminBankFile(week: string): Promise<BankFileResult> {
  return (await callable<{ week: string }, BankFileResult>('archivoPagos')({ week })).data;
}
/** Marca pagado el lote de una semana con la referencia u orden del banco. */
export async function adminMarkBatchPaid(week: string, reference: string): Promise<number> {
  return (await callable<{ week: string; reference: string }, { ok: boolean; count: number }>('marcarLotePagado')({ week, reference })).data.count;
}

/* ------------------------ Estado de cuenta y deudas de profesionales ------------------------ */

/** PDF del estado de cuenta de un profesional (base64). Fechas AAAA-MM-DD; por defecto últimos 30 días. */
export async function adminStatementPdf(proId: string, range?: { desde?: string; hasta?: string }): Promise<{ fileName: string; content: string }> {
  return (await callable<{ proId: string; desde?: string; hasta?: string }, { fileName: string; content: string }>('estadoCuentaPdf')({ proId, ...range })).data;
}
/** Envía ahora el estado de cuenta (PDF) al correo del profesional. */
export async function adminSendStatement(proId: string): Promise<string> {
  return (await callable<{ proId: string }, { ok: boolean; email: string }>('enviarEstadoCuenta')({ proId })).data.email;
}
/** Registra que el profesional pagó a HULUL su deuda (transferencia o DeUna). Devuelve lo que aún debe. */
export async function adminRegisterProPayment(proId: string, amount: number, reference: string): Promise<number> {
  return (await callable<{ proId: string; amount: number; reference: string }, { ok: boolean; debt: number }>('registrarAbono')({ proId, amount, reference })).data.debt;
}

/* ------------------------- Estados de cuenta semanales (aprobación) ------------------------- */

export interface StatementBatchItem { proId: string; name: string; email: string; hasEmail: boolean; earned: number; fees: number; fines: number; paid: number; toPay: number; pending: number; include: boolean; sentOk?: boolean }
export interface StatementBatch { week: string; status: 'borrador' | 'enviado'; items: StatementBatchItem[]; preparedAt: number | null; approvedBy: string; approvedAt: number | null; sent: number }

/** Lote de la semana (se prepara el lunes; si no existe, se prepara ahora). rebuild = volver a calcularlo. */
export async function adminStatementBatch(week?: string, rebuild = false): Promise<StatementBatch> {
  return (await callable<{ week?: string; rebuild?: boolean }, StatementBatch>('adminEstadosSemana')({ week, rebuild })).data;
}
/** Aprueba y envía los estados de cuenta a los profesionales marcados. */
export async function adminApproveStatements(week: string, include: string[]): Promise<{ sent: number; failed: string[] }> {
  return (await callable<{ week: string; include: string[] }, { ok: boolean; sent: number; failed: string[] }>('aprobarEstadosSemana')({ week, include })).data;
}

/* ------------------------------ Estado de cuenta del cliente ------------------------------ */

export async function adminClientStatementPdf(clientId: string, range?: { desde?: string; hasta?: string }): Promise<{ fileName: string; content: string }> {
  return (await callable<{ clientId: string; desde?: string; hasta?: string }, { fileName: string; content: string }>('estadoCuentaClientePdf')({ clientId, ...range })).data;
}
export async function adminSendClientStatement(clientId: string): Promise<string> {
  return (await callable<{ clientId: string }, { ok: boolean; email: string }>('enviarEstadoCuentaCliente')({ clientId })).data.email;
}

/** Envía archivos (Excel) por correo a las personas con rol Contabilidad del equipo. */
export async function adminSendToAccountant(input: { subject: string; message: string; files: { fileName: string; content: string }[] }): Promise<string[]> {
  return (await callable<typeof input, { ok: boolean; to: string[] }>('enviarContadora')(input)).data.to;
}
