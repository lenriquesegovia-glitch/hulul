import type { CategorySlug } from './categories';

/**
 * Horarios permitidos para agendar, por tipo de servicio.
 *
 * - Obra y ruido (aire, plomería, albañilería…): lunes a sábado, de 08:00 y
 *   terminando a más tardar 18:00. Domingos y feriados no: muchas
 *   urbanizaciones no dejan entrar proveedores ni hacer ruido.
 * - Hogar sin ruido (limpieza, clases, belleza…): todos los días de 08:00 a
 *   18:00; domingos y feriados con aviso (depende de la urbanización).
 * - Urgentes (cerrajería, salud): todos los días, también feriados, desde las
 *   07:00 y hasta las 20:00, con solo 30 minutos de anticipación.
 * - Mascotas (paseos al atardecer): como hogar, pero puede terminar hasta las 20:00.
 *
 * En todos: si el trabajo termina después de las 17:00 se avisa que HULUL no
 * responde si la urbanización no deja entrar al proveedor.
 */
export type ScheduleGroup = 'obra' | 'hogar' | 'urgente';

export const CATEGORY_SCHEDULE: Record<CategorySlug, ScheduleGroup> = {
  climatizacion: 'obra', plomeria: 'obra', electricidad: 'obra', albanileria: 'obra', carpinteria: 'obra',
  pintura: 'obra', piscinas: 'obra', jardineria: 'obra', fumigacion: 'obra', mudanzas: 'obra',
  limpieza: 'hogar', electrodomesticos: 'hogar', tecnologia: 'hogar', clases: 'hogar', mascotas: 'hogar', belleza: 'hogar',
  salud: 'urgente', cerrajeria: 'urgente',
};

interface Rule {
  label: string;
  /** Días que se puede agendar (0 = domingo). */
  days: number[];
  /** Días que se pueden agendar pero con aviso. */
  warnDays: number[];
  holidays: 'no' | 'aviso' | 'si';
  start: number;
  /** Desde esta hora de fin se avisa por el ingreso a urbanizaciones. */
  softEnd: number;
  /** Hora máxima de fin del trabajo. */
  hardEnd: number;
}

export const SCHEDULE_RULES: Record<ScheduleGroup, Rule> = {
  obra: { label: 'trabajos de obra o con ruido', days: [1, 2, 3, 4, 5, 6], warnDays: [], holidays: 'no', start: 8, softEnd: 17, hardEnd: 18 },
  hogar: { label: 'trabajos del hogar', days: [0, 1, 2, 3, 4, 5, 6], warnDays: [0], holidays: 'aviso', start: 8, softEnd: 17, hardEnd: 18 },
  urgente: { label: 'servicios urgentes', days: [0, 1, 2, 3, 4, 5, 6], warnDays: [], holidays: 'si', start: 7, softEnd: 17, hardEnd: 20 },
};

/**
 * Feriados de descanso obligatorio en Ecuador (y de Guayaquil). Revisar cada
 * año: el Gobierno traslada algunos por decreto.
 * Fuente 2026: calendario oficial publicado por la prensa (Vistazo, El Comercio).
 */
export const HOLIDAYS: Record<string, string> = {
  '2026-11-02': 'Día de los Difuntos',
  '2026-11-03': 'Independencia de Cuenca',
  '2026-12-25': 'Navidad',
  '2027-01-01': 'Año Nuevo',
  '2027-02-08': 'Carnaval',
  '2027-02-09': 'Carnaval',
  '2027-03-26': 'Viernes Santo',
  '2027-07-25': 'Fundación de Guayaquil',
};

/** Categorías que pueden terminar más tarde que su grupo. */
export const HARD_END_OVERRIDE: Partial<Record<CategorySlug, number>> = { mascotas: 20 };

/** Hora máxima de fin de una categoría. */
export function hardEndFor(category: CategorySlug): number {
  return HARD_END_OVERRIDE[category] ?? SCHEDULE_RULES[CATEGORY_SCHEDULE[category] ?? 'hogar'].hardEnd;
}

/** Anticipación mínima para reservar (minutos): urgentes 30, el resto 2 horas. */
export function leadMinutes(category: CategorySlug): number {
  return CATEGORY_SCHEDULE[category] === 'urgente' ? 30 : 120;
}

/** ¿Esa hora de llegada entra en el horario de la categoría? (para no mostrar horas imposibles) */
export function slotInWindow(category: CategorySlug, slot: string): boolean {
  const rule = SCHEDULE_RULES[CATEGORY_SCHEDULE[category] ?? 'hogar'];
  const [h] = slot.split(':').map(Number);
  return h >= rule.start && h + 1 <= hardEndFor(category);
}

const pad = (n: number) => String(n).padStart(2, '0');
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };
const fmt = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const WEEKDAY = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

export interface SlotCheck {
  ok: boolean;
  /** Por qué no se puede (si ok = false). */
  reason?: string;
  /** Avisos que el cliente debe aceptar. */
  warnings: string[];
  /** Hora de fin "HH:MM". */
  end: string;
}

/** ¿Se puede agendar este servicio ese día, a esa hora y por esas horas? */
export function checkSlot(input: {
  category: CategorySlug;
  date: string;
  slot: string;
  hours: number;
  pro?: { name: string; workDays?: number[]; from?: string; to?: string };
}): SlotCheck {
  const rule = SCHEDULE_RULES[CATEGORY_SCHEDULE[input.category] ?? 'hogar'];
  const [y, m, d] = input.date.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const start = toMin(input.slot);
  const endMin = start + input.hours * 60;
  const end = fmt(endMin);
  const warnings: string[] = [];
  const no = (reason: string): SlotCheck => ({ ok: false, reason, warnings, end });
  const holiday = HOLIDAYS[input.date];
  const first = input.pro?.name.split(' ')[0];

  if (holiday && rule.holidays === 'no') return no(`${holiday} es feriado: los ${rule.label} no se agendan en feriados.`);
  if (!rule.days.includes(wd)) return no(`Los ${WEEKDAY[wd]} no se agendan ${rule.label}: muchas urbanizaciones no permiten el ingreso ni el ruido.`);
  if (input.pro?.workDays?.length && !input.pro.workDays.includes(wd)) return no(`${first} no atiende los ${WEEKDAY[wd]}.`);
  if (start < rule.start * 60) return no(`Este servicio empieza desde las ${pad(rule.start)}:00.`);
  if (input.pro?.from && start < toMin(input.pro.from)) return no(`${first} empieza a atender a las ${input.pro.from}.`);
  const hardEnd = hardEndFor(input.category);
  if (endMin > hardEnd * 60) return no(`Terminaría a las ${end}. Este servicio debe terminar a más tardar a las ${pad(hardEnd)}:00: elige una hora más temprano.`);
  if (input.pro?.to && endMin > toMin(input.pro.to)) return no(`Terminaría a las ${end} y ${first} atiende hasta las ${input.pro.to}: elige una hora más temprano.`);

  if (endMin > rule.softEnd * 60) warnings.push(`El trabajo terminaría a las ${end}. Algunas urbanizaciones no permiten el ingreso de proveedores después de las ${pad(rule.softEnd)}:00; HULUL no se hace responsable si no le permiten entrar.`);
  if (holiday && rule.holidays === 'aviso') warnings.push(`${holiday} es feriado. Algunas urbanizaciones no permiten trabajos en feriados; la reserva queda bajo tu responsabilidad.`);
  if (rule.warnDays.includes(wd)) warnings.push('Es domingo. Algunas urbanizaciones no permiten trabajos los domingos; revisa las reglas de la tuya antes de reservar.');
  return { ok: true, warnings, end };
}

/** Hora máxima de fin para un profesional en una categoría (para su registro). */
export function maxEndHour(category: CategorySlug): number {
  return hardEndFor(category);
}
