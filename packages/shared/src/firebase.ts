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
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, type Firestore, type Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { PRIVACY_VERSION } from './legal';
import type { CategorySlug } from './categories';
import type { LatLng, PaymentMethod, Professional } from './models';
import { sortPros, toProfessional, type PublicPro } from './demo-data';
import type { JobOutcome } from './policy';
import type { CategoryEvidence } from './provider';

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
  dispute?: { kind: string; text: string; status: string };
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

export const PROBLEM_OPTIONS: { value: 'no_vino' | 'incompleto' | 'cobro' | 'otro'; label: string }[] = [
  { value: 'no_vino', label: 'No hizo el trabajo o se fue sin hacerlo' },
  { value: 'incompleto', label: 'Marcó como resuelto, pero no quedó resuelto' },
  { value: 'cobro', label: 'Me cobró algo distinto a lo acordado' },
  { value: 'otro', label: 'Otro problema' },
];

/** El cliente reporta un problema (hasta 48 h después): el pago queda retenido y HULUL revisa. */
export async function reportProblem(data: { id: string; kind: string; text: string }): Promise<void> {
  const fn = callable<typeof data, { ok: boolean }>('reportarProblema');
  await fn(data);
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

export interface ProBooking {
  id: string;
  /** Cuándo marcó "Estoy en la dirección". */
  arrivedAt?: { toMillis: () => number };
  dispute?: { kind: string; text: string; status: string };
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
