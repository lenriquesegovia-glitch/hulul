import type { CategorySlug } from './categories';

/**
 * Horarios (decidido el 19-oct-2026).
 *
 * - Horario normal: todos los días de 08:00 a 18:00 (la visita empieza dentro de ese horario;
 *   el profesional decide si acepta según su tiempo disponible). Sin recargo.
 * - Fuera de horario (antes de las 08:00 o desde las 18:00) y feriados: solo
 *   con profesionales que lo activan en su perfil. Cada uno elige a qué horas
 *   atiende y fija su recargo en monto fijo (nocturno y feriado), sin tope. El
 *   cliente lo ve antes de confirmar.
 * - Trabajos con ruido (obra) en la noche, domingos o feriados: se pueden
 *   reservar, pero el cliente acepta que responde ante vecinos, administración
 *   o guardianía. Si no dejan trabajar al profesional, se cobra la visita como
 *   "cliente ausente".
 */
export type ScheduleGroup = 'obra' | 'hogar' | 'urgente';

export const CATEGORY_SCHEDULE: Record<CategorySlug, ScheduleGroup> = {
  climatizacion: 'obra', plomeria: 'obra', electricidad: 'obra', albanileria: 'obra', carpinteria: 'obra',
  pintura: 'obra', piscinas: 'obra', jardineria: 'obra', fumigacion: 'obra', mudanzas: 'obra',
  limpieza: 'hogar', electrodomesticos: 'hogar', tecnologia: 'hogar', clases: 'hogar', mascotas: 'hogar', belleza: 'hogar',
  salud: 'urgente', cerrajeria: 'urgente',
  'servicios-profesionales': 'obra',
};

/** Horario normal (horas enteras): desde START hasta END, sin recargo. */
export const NORMAL_HOURS = { start: 8, end: 18 };

/** Horas fuera de horario que un profesional puede activar (0–7 y 18–23). */
export const OFF_HOURS = [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7];

/** Recargo máximo técnico (solo para evitar errores de tipeo; no es un tope comercial). */
export const MAX_SURCHARGE = 500;

/** ¿Esa hora de llegada es fuera de horario? */
export function isOffHour(slot: string): boolean {
  const h = Number(slot.split(':')[0]);
  return h < NORMAL_HOURS.start || h >= NORMAL_HOURS.end;
}

/** ¿El trabajo hace ruido? (obra: aire, plomería, albañilería…) */
export function isNoisy(category: CategorySlug): boolean {
  return CATEGORY_SCHEDULE[category] === 'obra';
}

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

/** Sin anticipación mínima: el profesional acepta o rechaza la solicitud. */
export function leadMinutes(_category: CategorySlug): number {
  return 0;
}

/** Lo que el horario necesita saber del profesional. */
export interface ProSchedule {
  name: string;
  workDays?: number[];
  from?: string;
  to?: string;
  /** Horas fuera de horario en que acepta llegar (0–7, 18–23). */
  offHours?: number[];
  /** Atiende feriados. */
  holidays?: boolean;
  /** Recargos en monto fijo (USD). */
  surcharges?: Surcharges;
}

export interface Surcharges { nocturno?: number; feriado?: number }
export type SurchargeKind = 'nocturno' | 'feriado';

/** ¿Se muestra esa hora de llegada para este profesional? (para no mostrar horas imposibles) */
export function slotInWindow(_category: CategorySlug, slot: string, pro?: ProSchedule): boolean {
  const h = Number(slot.split(':')[0]);
  if (!isOffHour(slot)) return true;
  return !!pro?.offHours?.includes(h);
}

/**
 * Recargo que aplica a una reserva: nocturno si llega fuera de horario,
 * feriado si es feriado. Si aplican los dos, se cobra solo el mayor.
 */
export function surchargeFor(date: string, slot: string, pro?: ProSchedule): { kind: SurchargeKind | null; amount: number } {
  const night = isOffHour(slot) ? Math.max(0, Number(pro?.surcharges?.nocturno ?? 0)) : -1;
  const holiday = HOLIDAYS[date] ? Math.max(0, Number(pro?.surcharges?.feriado ?? 0)) : -1;
  if (night < 0 && holiday < 0) return { kind: null, amount: 0 };
  return holiday > night ? { kind: 'feriado', amount: holiday } : { kind: 'nocturno', amount: night };
}

export const SURCHARGE_LABEL: Record<SurchargeKind, string> = { nocturno: 'Tarifa nocturna', feriado: 'Tarifa de feriado' };

const pad = (n: number) => String(n).padStart(2, '0');
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };
const fmt = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
const WEEKDAY = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

export interface SlotCheck {
  ok: boolean;
  /** Por qué no se puede (si ok = false). */
  reason?: string;
  /** Avisos que el cliente debe aceptar. */
  warnings: string[];
  /** Hora de fin "HH:MM". */
  end: string;
  /** Trabajo con ruido fuera de horario, domingo o feriado: el cliente acepta la responsabilidad. */
  noisy?: boolean;
}

/** Aviso de ruido que el cliente acepta (también en los Términos). */
export const NOISE_NOTICE = 'Es un trabajo que puede hacer ruido. Tú respondes ante tus vecinos, la administración o la guardianía. Si no dejan entrar o trabajar al profesional, se cobra la visita como "cliente ausente".';

/** ¿Se puede agendar este servicio ese día, a esa hora y por esas horas? */
export function checkSlot(input: {
  category: CategorySlug;
  date: string;
  slot: string;
  hours: number;
  pro?: ProSchedule;
}): SlotCheck {
  const [y, m, d] = input.date.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const start = toMin(input.slot);
  const endMin = start + input.hours * 60;
  const end = fmt(endMin);
  const warnings: string[] = [];
  const no = (reason: string): SlotCheck => ({ ok: false, reason, warnings, end });
  const holiday = HOLIDAYS[input.date];
  const pro = input.pro;
  const first = pro?.name.split(' ')[0] ?? 'El profesional';
  const off = isOffHour(input.slot);
  const h = Math.floor(start / 60);

  if (pro?.workDays?.length && !pro.workDays.includes(wd)) return no(`${first} no atiende los ${WEEKDAY[wd]}.`);
  if (holiday && !pro?.holidays) return no(`${holiday} es feriado y ${first} no atiende feriados.`);
  if (off) {
    if (!pro?.offHours?.includes(h)) return no(`${first} no atiende a las ${input.slot}. El horario normal es de ${pad(NORMAL_HOURS.start)}:00 a ${pad(NORMAL_HOURS.end)}:00.`);
  } else {
    if (pro?.from && start < toMin(pro.from)) return no(`${first} empieza a atender a las ${pro.from}.`);
    if (pro?.to && start > toMin(pro.to)) return no(`${first} recibe solicitudes hasta las ${pro.to}: elige una hora de llegada dentro de su horario.`);
  }

  const noisy = isNoisy(input.category) && (off || !!holiday || wd === 0);
  if (noisy) warnings.push(NOISE_NOTICE);
  if (off || holiday || wd === 0) warnings.push('Algunas urbanizaciones y edificios no permiten el ingreso de proveedores de noche, en domingos o en feriados. Revisa las reglas de la tuya: la reserva queda bajo tu responsabilidad.');
  return { ok: true, warnings, end, noisy };
}

/** Hora máxima de fin en horario normal (para el registro). */
export function maxEndHour(_category?: CategorySlug): number {
  return NORMAL_HOURS.end;
}

/** Revisa los datos de fuera de horario de un profesional. Devuelve el problema o ''. */
export function offHoursProblem(p: { offHours?: number[]; holidays?: boolean; surcharges?: Surcharges }): string {
  const ok = (n: unknown) => n === undefined || (typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= MAX_SURCHARGE);
  if (!ok(p.surcharges?.nocturno) || !ok(p.surcharges?.feriado)) return `El recargo debe ser un monto entre $0 y $${MAX_SURCHARGE}.`;
  if (p.offHours?.length && p.surcharges?.nocturno === undefined) return 'Pon tu recargo nocturno (puede ser $0).';
  if (p.holidays && p.surcharges?.feriado === undefined) return 'Pon tu recargo de feriado (puede ser $0).';
  return '';
}
