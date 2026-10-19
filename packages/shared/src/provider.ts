import { categories, type CategorySlug } from './categories';

/**
 * Registro de profesionales (proveedores).
 * El perfil vive en Firestore en `providers/{uid}`; los datos bancarios en
 * `providers/{uid}/private/banco` y los documentos en Storage en
 * `providers/{uid}/...`. Solo el propio profesional los puede leer; HULUL los
 * revisa desde la consola de Firebase.
 */

export type ProviderStatus =
  | 'borrador'      // llenando el registro
  | 'en_revision'   // envió todo, HULUL revisa
  | 'observado'     // HULUL pidió corregir algo
  | 'aprobado'      // puede recibir trabajos
  | 'rechazado'
  | 'suspendido';

export type ProviderKind = 'persona' | 'empresa';

/**
 * Precio por cita (como un taxi): cada profesional pone su **tarifa por
 * visita** en cada categoría. HULUL solo le muestra referencias:
 * - suggested: tarifa sugerida para quien recién empieza (no es obligatoria).
 * - hours: duración estimada de una visita, solo para validar el horario
 *   (que el trabajo termine a tiempo). El cliente no la elige ni la paga.
 * Valores iniciales: se ajustan aquí cuando haya profesionales reales.
 */
export const CATEGORY_PRICING: Record<CategorySlug, { suggested: number; hours: number }> = {
  climatizacion: { suggested: 25, hours: 2 },
  plomeria: { suggested: 20, hours: 2 },
  electricidad: { suggested: 20, hours: 2 },
  electrodomesticos: { suggested: 20, hours: 2 },
  limpieza: { suggested: 25, hours: 4 },
  jardineria: { suggested: 20, hours: 2 },
  piscinas: { suggested: 20, hours: 1 },
  pintura: { suggested: 25, hours: 3 },
  belleza: { suggested: 15, hours: 1 },
  mascotas: { suggested: 12, hours: 1 },
  clases: { suggested: 12, hours: 1 },
  salud: { suggested: 20, hours: 1 },
  cerrajeria: { suggested: 20, hours: 1 },
  carpinteria: { suggested: 20, hours: 2 },
  albanileria: { suggested: 25, hours: 3 },
  fumigacion: { suggested: 30, hours: 2 },
  mudanzas: { suggested: 40, hours: 3 },
  tecnologia: { suggested: 20, hours: 1 },
};

/** Límites técnicos de la tarifa por visita (solo para evitar errores de tipeo). */
export const MIN_VISIT_RATE = 5;
export const MAX_VISIT_RATE = 1000;

/**
 * Banda de tarifas: cada profesional pone su tarifa, pero dentro de un rango
 * alrededor de la sugerida de su categoría (como Uber: precios parecidos y
 * creíbles en toda la app; nadie cobra $100 por una visita de $20).
 * Se ajusta aquí y en functions/index.js (RATE_BAND).
 */
export const RATE_BAND = { below: 0.25, above: 0.25 };

/** Tarifa mínima y máxima permitidas en una categoría (USD, enteros). */
export function rateRange(slug: CategorySlug): { min: number; max: number } {
  const s = CATEGORY_PRICING[slug]?.suggested ?? 20;
  return { min: Math.max(MIN_VISIT_RATE, Math.floor(s * (1 - RATE_BAND.below))), max: Math.ceil(s * (1 + RATE_BAND.above)) };
}

/** Lleva una tarifa al rango permitido de su categoría. */
export function clampRate(slug: CategorySlug, rate: number): number {
  const { min, max } = rateRange(slug);
  return Math.min(max, Math.max(min, rate));
}

/** Duración estimada de una visita en la categoría (horas). */
export function visitHours(slug: CategorySlug): number {
  return CATEGORY_PRICING[slug]?.hours ?? 1;
}

export interface ReferencePrices {
  suggested: number;
  /** Cuántos profesionales aprobados tienen tarifa en la categoría. */
  count: number;
  min?: number;
  median?: number;
  max?: number;
}

/**
 * Precios de referencia para que el profesional no esté perdido: la tarifa
 * sugerida y, con 3 o más profesionales aprobados, el rango y la mediana.
 */
export function referencePrices(slug: CategorySlug, rates: number[]): ReferencePrices {
  const suggested = CATEGORY_PRICING[slug].suggested;
  const xs = rates.filter((r) => Number.isFinite(r) && r > 0).sort((a, b) => a - b);
  if (xs.length < 3) return { suggested, count: xs.length };
  const mid = Math.floor(xs.length / 2);
  const median = xs.length % 2 ? xs[mid] : Math.round(((xs[mid - 1] + xs[mid]) / 2) * 100) / 100;
  return { suggested, count: xs.length, min: xs[0], median, max: xs[xs.length - 1] };
}

/* ----------------------- Validación por categoría ----------------------- */

/**
 * Cada categoría se aprueba por separado. El profesional demuestra que sabe
 * hacerlo con un certificado o título, o con fotos de trabajos anteriores y
 * una referencia. Puede sumar categorías cuando quiera, sin límite.
 */
export type CategoryReview = 'en_revision' | 'aprobado' | 'observado' | 'rechazado';

export type EvidenceKind = 'certificado' | 'experiencia';

export interface CategoryEvidence {
  kind: EvidenceKind;
  /** Qué certificado es, o cuánta experiencia tiene y dónde trabajó. */
  note: string;
  /** Nombre y celular de un cliente o empleador anterior (en "experiencia"). */
  reference?: string;
  /** Rutas en Storage (providers/{uid}/...). */
  files: string[];
}

export const EVIDENCE_OPTIONS: { value: EvidenceKind; label: string; help: string }[] = [
  { value: 'certificado', label: 'Tengo certificado o título', help: 'SECAP, instituto, universidad, fabricante o gremio. Sube una foto o PDF.' },
  { value: 'experiencia', label: 'Tengo experiencia comprobable', help: 'Sube al menos 2 fotos de trabajos que hiciste y deja el contacto de un cliente o empleador que te recomiende.' },
];

/** Fotos mínimas de trabajos anteriores para validar por experiencia. */
export const MIN_EXPERIENCE_PHOTOS = 2;
export const MAX_EVIDENCE_FILES = 6;

/** ¿Está completa la validación de una categoría? Devuelve el problema o ''. */
export function evidenceProblem(slug: CategorySlug, e: CategoryEvidence | undefined): string {
  if (!e) return 'Falta demostrar que sabes hacerlo.';
  if (slug === 'salud' && e.kind !== 'certificado') return 'Salud exige título registrado en la SENESCYT.';
  if (e.note.trim().length < 5) return e.kind === 'certificado' ? 'Escribe qué certificado o título tienes.' : 'Cuenta tu experiencia: años y dónde trabajaste.';
  if (e.kind === 'certificado' && e.files.length < 1) return 'Sube la foto o PDF del certificado.';
  if (e.kind === 'experiencia') {
    if (e.files.length < MIN_EXPERIENCE_PHOTOS) return `Sube al menos ${MIN_EXPERIENCE_PHOTOS} fotos de trabajos que hiciste.`;
    if ((e.reference ?? '').trim().length < 8) return 'Deja el nombre y celular de alguien que te recomiende.';
  }
  return '';
}

/**
 * Categorías en las que el profesional puede recibir trabajos. Los
 * registrados antes de la validación por categoría (sin `catStatus`) quedan
 * aprobados en todas las que tenían.
 */
export function approvedCategories(p: { categories?: CategorySlug[]; catStatus?: Partial<Record<CategorySlug, CategoryReview>> }): CategorySlug[] {
  const cats = p.categories ?? [];
  if (!p.catStatus) return cats;
  return cats.filter((c) => (p.catStatus?.[c] ?? 'aprobado') === 'aprobado');
}

export const CATEGORY_REVIEW_LABEL: Record<CategoryReview, string> = {
  en_revision: 'En revisión', aprobado: 'Aprobada', observado: 'Con observaciones', rechazado: 'No aprobada',
};

/** Cómo se llama a quien hace cada oficio (para las plantillas de presentación). */
export const TRADE_NAME: Record<CategorySlug, string> = {
  climatizacion: 'técnico de aire acondicionado', plomeria: 'plomero', electricidad: 'electricista',
  electrodomesticos: 'técnico de electrodomésticos', limpieza: 'profesional de limpieza', jardineria: 'jardinero',
  piscinas: 'técnico de piscinas', pintura: 'pintor', belleza: 'profesional de belleza', mascotas: 'cuidador de mascotas',
  clases: 'profesor particular', salud: 'profesional de la salud', cerrajeria: 'cerrajero', carpinteria: 'carpintero',
  albanileria: 'maestro albañil', fumigacion: 'técnico en control de plagas', mudanzas: 'transportista de mudanzas',
  tecnologia: 'técnico en tecnología',
};

/** Subservicios de una categoría (los mismos "más solicitados" de la web). */
export function subservicesOf(slug: CategorySlug): string[] {
  return categories.find((c) => c.slug === slug)?.servicios ?? [];
}

export const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export interface ProviderDocSpec {
  key: 'cedulaFrente' | 'cedulaReverso' | 'selfie' | 'antecedentes' | 'titulo' | 'ruc';
  label: string;
  help: string;
  /** Abre la cámara frontal en el celular. */
  selfie?: boolean;
  accept: string;
}

const IMG = 'image/*';
const IMG_PDF = 'image/*,application/pdf';

export const PROVIDER_DOCS: ProviderDocSpec[] = [
  { key: 'cedulaFrente', label: 'Cédula (frente)', help: 'Foto clara, sin reflejos, que se lean todos los datos.', accept: IMG },
  { key: 'cedulaReverso', label: 'Cédula (reverso)', help: 'Foto del lado de atrás.', accept: IMG },
  { key: 'selfie', label: 'Foto de tu rostro', help: 'De frente, con buena luz y sin lentes oscuros. La comparamos con tu cédula.', selfie: true, accept: IMG },
  { key: 'antecedentes', label: 'Certificado de antecedentes penales', help: 'Lo descargas gratis en la web del Ministerio del Interior. Vale con menos de 3 meses.', accept: IMG_PDF },
  { key: 'titulo', label: 'Título o certificado profesional', help: 'Obligatorio para Salud (registrado en la SENESCYT). Opcional para otros oficios: suma confianza.', accept: IMG_PDF },
  { key: 'ruc', label: 'Certificado del RUC', help: 'Obligatorio para facturar tus servicios. Lo descargas gratis en SRI en línea (sri.gob.ec).', accept: IMG_PDF },
];

/** Documentos obligatorios según las categorías elegidas. */
export function requiredDocs(cats: CategorySlug[]): ProviderDocSpec['key'][] {
  const base: ProviderDocSpec['key'][] = ['cedulaFrente', 'cedulaReverso', 'selfie', 'antecedentes', 'ruc'];
  return cats.includes('salud') ? [...base, 'titulo'] : base;
}

export const MAX_DOC_MB = 10;

export const BANKS_EC = [
  'Banco Pichincha', 'Banco Guayaquil', 'Banco del Pacífico', 'Produbanco', 'Banco Bolivariano',
  'Banco Internacional', 'Banco del Austro', 'Banco de Machala', 'Banco General Rumiñahui',
  'Banco Solidario', 'Banco ProCredit', 'Banco de Loja', 'Cooperativa JEP', 'Cooperativa Jardín Azuayo',
  'Otro banco o cooperativa',
];

/**
 * Valida una cédula ecuatoriana (10 dígitos, provincia 01-24 o 30 y dígito
 * verificador módulo 10).
 */
export function validCedula(id: string): boolean {
  if (!/^\d{10}$/.test(id)) return false;
  const prov = Number(id.slice(0, 2));
  if (!((prov >= 1 && prov <= 24) || prov === 30)) return false;
  if (Number(id[2]) >= 6) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(id[i]) * (i % 2 === 0 ? 2 : 1);
    if (d > 9) d -= 9;
    sum += d;
  }
  return (10 - (sum % 10)) % 10 === Number(id[9]);
}

/** RUC: 13 dígitos que terminan en 001. Si es de persona natural, valida la cédula. */
export function validRuc(ruc: string): boolean {
  if (!/^\d{10}001$/.test(ruc)) return false;
  const third = Number(ruc[2]);
  return third < 6 ? validCedula(ruc.slice(0, 10)) : third === 6 || third === 9;
}

/** Celular ecuatoriano 09XXXXXXXX → +5939XXXXXXXX. Devuelve '' si no es válido. */
export function e164Ecuador(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (/^09\d{8}$/.test(d)) return `+593${d.slice(1)}`;
  if (/^9\d{8}$/.test(d)) return `+593${d}`;
  if (/^5939\d{8}$/.test(d)) return `+${d}`;
  return '';
}
