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

/** Tarifa mínima por hora y horas mínimas por categoría (piso que nadie puede bajar). */
export const CATEGORY_FLOORS: Record<CategorySlug, { rate: number; hours: number }> = {
  climatizacion: { rate: 18, hours: 2 },
  plomeria: { rate: 15, hours: 2 },
  electricidad: { rate: 15, hours: 2 },
  electrodomesticos: { rate: 15, hours: 2 },
  limpieza: { rate: 5, hours: 4 },
  jardineria: { rate: 7, hours: 3 },
  piscinas: { rate: 12, hours: 2 },
  pintura: { rate: 10, hours: 4 },
  belleza: { rate: 15, hours: 1 },
  mascotas: { rate: 8, hours: 2 },
  clases: { rate: 10, hours: 1 },
  salud: { rate: 15, hours: 1 },
};

/** Máximo de categorías por profesional. */
export const MAX_PROVIDER_CATEGORIES = 3;

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
  { key: 'ruc', label: 'RUC o RISE', help: 'Opcional ahora; lo necesitarás para facturar tus servicios.', accept: IMG_PDF },
];

/** Documentos obligatorios según las categorías elegidas. */
export function requiredDocs(cats: CategorySlug[]): ProviderDocSpec['key'][] {
  const base: ProviderDocSpec['key'][] = ['cedulaFrente', 'cedulaReverso', 'selfie', 'antecedentes'];
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
