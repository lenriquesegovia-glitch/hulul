/**
 * Tablero de administración (hululec.com/admin): etapas de cada reserva,
 * indicadores de calidad (éxito, atrasos, mal servicio, clientes reportados),
 * contabilidad "antes, durante y después" y resúmenes por proveedor y cliente.
 *
 * Los datos llegan ya planos desde la función `adminTablero`
 * (functions/tablero-core.js). Este archivo no importa nada para poder
 * probarlo con Node: scripts/check-dashboard.mjs.
 */

/* ---------------------------------- Tipos ---------------------------------- */

export interface DashClaimRef {
  status: string; openedBy: string; kind: string; kindLabel: string; outcome: string;
  openedAt: number | null; resolveDueAt: number | null;
  /** Textos (moderados) del reclamo, la respuesta y la decisión: solo dueño y socio. */
  text?: string; response?: string; decisionNote?: string;
  /** false = reclamo antiguo sin expediente (solo en la reserva). */
  formal?: boolean;
}

export interface DashBooking {
  id: string; code: string; date: string; slot: string; at: number | null; createdAt: number | null;
  acceptedAt?: number | null; enRouteAt?: number | null; ratingText?: string;
  /** Fotos del pedido y del trabajo (solo dueño y socio). */
  photoUrls?: { request: string[]; work: string[] };
  category: string; status: string; demo: boolean; source: string;
  clientId: string; clientName: string; clientPhone: string; proId: string; proName: string;
  paymentMethod: string; visit: number; surcharge: number; surchargeKind: string; fee: number; iva: number; total: number; taxRegime: string;
  extra: { amount: number; status: string; method: string } | null;
  arrivedAt: number | null; startedAt: number | null; finishedAt: number | null; cancelledAt: number | null;
  cancelledBy: string; cancelReason: string; cancelFee: number; proFault: string; proFine: number; clientCredit: number;
  delay: { minutes: number; status: string } | null; rings: number; outcome: string;
  rating: number | null; clientStars: number | null; photos: number;
  claim: DashClaimRef | null;
}

export interface DashLedger {
  id: string; bookingId: string | null; proId: string; clientId: string | null; kind: string; bucket: string;
  amount: number; base: number | null; iva: number | null; proDelta: number; payoutId: string | null;
  availableAt: number | null; createdAt: number | null; reverses: string | null; reversedBy: string | null; paymentMethod: string;
}

export interface DashPayout {
  id: string; proId: string; week: string; status: string; regime: string; gross: number; deductions: number; net: number;
  retentions: { renta: number; iva: number }; byKind: Record<string, number>; entries: number; bank: string;
  createdAt: number | null; paidAt: number | null;
}

export interface DashProvider {
  uid: string; name: string; kind: string; status: string; categories: string[]; catStatus: Record<string, string>; cities: string[];
  rating: number | null; reviewCount: number; jobsDone: number; strikes30: number; suspendedUntil: number | null; suspendedReason: string;
  payoutBalance: number; cashDebt: number; fines: number; taxRegime: string; eSignature: boolean; acceptsCash: boolean; tester: boolean;
  ruc: string; email: string; phone: string; submittedAt: number | null; reviewedAt: number | null;
}

export interface DashClient {
  uid: string; name: string; phone: string; email: string; balance: number; noShows: number; strikes: number; createdAt: number | null;
}

export interface DashClaim {
  id: string; code: string; bookingId: string; openedBy: string; kind: string; kindLabel: string; status: string; outcome: string;
  clientId: string; proId: string; category: string; openedAt: number | null; resolveDueAt: number | null; decidedAt: number | null;
  multaPro: number; creditoCliente: number;
}

export interface DashData {
  range: { from: string; to: string };
  generatedAt: number;
  /** Quién consulta y con qué rol (lo decide el servidor). */
  viewer?: { email: string; role: AdminRole };
  bookings: DashBooking[];
  ledger: DashLedger[];
  payouts: DashPayout[];
  providers: DashProvider[];
  clients: DashClient[];
  claims: DashClaim[];
}

/* ---------------------------------- Roles ---------------------------------- */

/** Debe coincidir con functions/roles-core.js (el servidor es quien decide). */
export type AdminRole = 'dueno' | 'socio' | 'contabilidad' | 'cumplimiento';
export type AdminPerm = 'tablero' | 'reservas' | 'clientes' | 'contabilidad' | 'proveedores' | 'cumplimiento' | 'reclamos' | 'profesionales' | 'pagos' | 'equipo';

export const ROLE_PERMS: Record<AdminRole, AdminPerm[]> = {
  dueno: ['tablero', 'reservas', 'clientes', 'contabilidad', 'proveedores', 'cumplimiento', 'reclamos', 'profesionales', 'pagos', 'equipo'],
  socio: ['tablero', 'reservas', 'clientes', 'contabilidad', 'proveedores', 'cumplimiento', 'reclamos', 'profesionales', 'pagos'],
  contabilidad: ['tablero', 'contabilidad', 'proveedores', 'pagos'],
  cumplimiento: ['tablero', 'reservas', 'clientes', 'contabilidad', 'proveedores', 'cumplimiento'],
};

export const ROLE_INFO: Record<AdminRole, { label: string; help: string }> = {
  dueno: { label: 'Socio 1', help: 'Todo el panel y el equipo (dar y quitar accesos).' },
  socio: { label: 'Socio 2', help: 'Todo el panel: decide reclamos, aprueba profesionales y marca pagos. No gestiona el equipo.' },
  contabilidad: { label: 'Contabilidad', help: 'Resumen, Contabilidad y Proveedores (facturas y RUC). Exporta y marca liquidaciones pagadas.' },
  cumplimiento: { label: 'Oficial de cumplimiento (UAFE)', help: 'Solo lectura: reservas, clientes, proveedores, contabilidad y alertas de cumplimiento. Sin reclamos ni chats.' },
};

export const canDo = (role: AdminRole | undefined | null, perm: AdminPerm) => !!role && ROLE_PERMS[role].includes(perm);

/* ------------------------------- Utilidades -------------------------------- */

const DAY = 86_400_000;
const EC = 5 * 3_600_000;
const COMMISSION = 0.15;
const LATE_TOLERANCE_MIN = 15;
export const r2 = (n: number) => Math.round(Number(n || 0) * 100) / 100;
const pctOf = (part: number, total: number) => (total > 0 ? part / total : 0);

/** Fecha de Ecuador (AAAA-MM-DD) de un instante. */
export const ecDate = (t: number) => new Date(t - EC).toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
/** Lunes de la semana de una fecha. */
export const mondayOf = (iso: string) => addDays(iso, -((weekday(iso) + 6) % 7));

export const money = (n: number) => `${r2(n) < 0 ? "-" : ""}$${Math.abs(r2(n)).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const percent = (n: number) => `${Math.round(n * 1000) / 10} %`.replace('.', ',');

/* --------------------------------- Periodos -------------------------------- */

export type PeriodKey = 'hoy' | 'semana' | 'proxima_semana' | 'mes' | 'proximo_mes' | 'ultimos_7' | 'ultimos_30' | 'ultimos_90' | 'todo' | 'personalizado';
export interface DateRange { from: string; to: string }

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  hoy: 'Hoy', semana: 'Esta semana', proxima_semana: 'Próxima semana', mes: 'Este mes', proximo_mes: 'Próximo mes',
  ultimos_7: 'Últimos 7 días', ultimos_30: 'Últimos 30 días', ultimos_90: 'Últimos 90 días', todo: 'Todo', personalizado: 'Fechas…',
};

/** Rango (fechas de Ecuador, inclusive) de un periodo. */
export function periodRange(key: PeriodKey, now: number, custom?: DateRange): DateRange {
  const today = ecDate(now);
  const mon = mondayOf(today);
  const [y, m] = today.split('-').map(Number);
  const monthStart = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-01`;
  const monthEnd = (yy: number, mm: number) => addDays(mm === 12 ? monthStart(yy + 1, 1) : monthStart(yy, mm + 1), -1);
  switch (key) {
    case 'hoy': return { from: today, to: today };
    case 'semana': return { from: mon, to: addDays(mon, 6) };
    case 'proxima_semana': return { from: addDays(mon, 7), to: addDays(mon, 13) };
    case 'mes': return { from: monthStart(y, m), to: monthEnd(y, m) };
    case 'proximo_mes': { const ny = m === 12 ? y + 1 : y; const nm = m === 12 ? 1 : m + 1; return { from: monthStart(ny, nm), to: monthEnd(ny, nm) }; }
    case 'ultimos_7': return { from: addDays(today, -6), to: today };
    case 'ultimos_30': return { from: addDays(today, -29), to: today };
    case 'ultimos_90': return { from: addDays(today, -89), to: today };
    case 'personalizado': return custom && custom.from && custom.to ? (custom.from <= custom.to ? custom : { from: custom.to, to: custom.from }) : { from: addDays(today, -29), to: today };
    default: return { from: '0000-01-01', to: '9999-12-31' };
  }
}

export const inRange = (iso: string, r: DateRange) => !!iso && iso >= r.from && iso <= r.to;
export const msInRange = (t: number | null, r: DateRange) => t !== null && inRange(ecDate(t), r);

/* --------------------------------- Etapas ---------------------------------- */

export type Stage = 'programada' | 'ejecucion' | 'ejecutada' | 'reclamo' | 'cancelada';

export const STAGES: { key: Stage; label: string; help: string }[] = [
  { key: 'programada', label: 'Programadas', help: 'Reservadas o aceptadas, aún no sale el profesional' },
  { key: 'ejecucion', label: 'En ejecución', help: 'En camino, trabajando o esperando aprobación' },
  { key: 'ejecutada', label: 'Ejecutadas', help: 'Terminadas y cobradas' },
  { key: 'reclamo', label: 'En reclamo', help: 'Con un reclamo abierto; el pago está retenido' },
  { key: 'cancelada', label: 'Canceladas', help: 'Por el cliente, el profesional o el sistema' },
];

export const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Esperando aceptación', confirmada: 'Aceptada', en_camino: 'En camino', en_curso: 'Trabajando',
  por_aprobar: 'Por aprobar', completada: 'Completada', cancelada: 'Cancelada', en_disputa: 'En reclamo',
};

export function stageOf(b: Pick<DashBooking, 'status' | 'claim'>): Stage {
  switch (b.status) {
    case 'pendiente': case 'confirmada': return 'programada';
    case 'en_camino': case 'en_curso': case 'por_aprobar': return 'ejecucion';
    case 'completada': return b.claim && b.claim.status !== 'resuelto' ? 'reclamo' : 'ejecutada';
    case 'en_disputa': return 'reclamo';
    case 'cancelada': return b.claim && b.claim.status !== 'resuelto' ? 'reclamo' : 'cancelada';
    default: return 'programada';
  }
}

/* ------------------------------ Calidad del caso ---------------------------- */

const LATE_FAULTS = ['llego_tarde', 'muy_tarde', 'retraso_rechazado'];
const NOSHOW_FAULTS = ['no_salio', 'no_se_presento'];
const CLIENT_BAD_SERVICE_KINDS = ['no_vino', 'incompleto', 'cobro', 'trato', 'dano', 'otro'];

export interface CaseFlags {
  /** Minutos de atraso al llegar respecto de la hora reservada (null si no llegó). */
  lateMin: number | null;
  late: boolean;
  delayAnnounced: boolean;
  proNoShow: boolean;
  proCancelled: boolean;
  clientCancelled: boolean;
  clientAbsent: boolean;
  badService: boolean;
  clientReported: boolean;
  claimByClient: boolean;
  claimByPro: boolean;
  success: boolean;
  /** Ya terminó (bien o mal): entra en los porcentajes. */
  closed: boolean;
}

export function caseFlags(b: DashBooking): CaseFlags {
  const lateMin = b.arrivedAt && b.at ? Math.round((b.arrivedAt - b.at) / 60_000) : null;
  const late = (lateMin !== null && lateMin > LATE_TOLERANCE_MIN) || LATE_FAULTS.includes(b.proFault);
  const proNoShow = NOSHOW_FAULTS.includes(b.proFault);
  const cancelled = b.status === 'cancelada';
  const clientAbsent = cancelled && b.cancelledBy === 'cliente_ausente';
  // Si el cliente canceló porque el profesional se atrasó (proFault), la falla es del profesional.
  const proCancelled = cancelled && !clientAbsent && (!!b.proFault || b.cancelledBy === 'profesional' || b.cancelledBy === 'profesional_tarde');
  const clientCancelled = cancelled && b.cancelledBy === 'cliente' && !proCancelled;
  const claimByClient = b.claim?.openedBy === 'cliente' && b.claim.kind !== 'si_estaba';
  const claimByPro = b.claim?.openedBy === 'profesional';
  const badService = (b.status === 'completada' || b.status === 'en_disputa')
    && ((b.rating !== null && b.rating <= 2) || b.outcome === 'no_resuelto' || (claimByClient && CLIENT_BAD_SERVICE_KINDS.includes(b.claim!.kind) && b.claim!.outcome !== 'profesional'));
  const clientReported = claimByPro || (b.clientStars !== null && b.clientStars <= 2);
  const closed = ['completada', 'cancelada', 'en_disputa'].includes(b.status);
  const success = b.status === 'completada' && !late && !badService && !(b.claim && b.claim.status !== 'resuelto');
  return {
    lateMin, late, delayAnnounced: b.delay?.status === 'aceptado' || b.delay?.status === 'propuesto', proNoShow, proCancelled,
    clientCancelled, clientAbsent, badService, clientReported, claimByClient, claimByPro, success, closed,
  };
}

/** Resultado único de cada caso terminado (para el gráfico de pastel). */
export type CaseOutcome = 'exito' | 'atrasado' | 'mal_servicio' | 'en_reclamo' | 'falla_profesional' | 'cliente_ausente' | 'cancelo_cliente' | 'cancelada_otra';

export const OUTCOMES: { key: CaseOutcome; label: string; color: string }[] = [
  { key: 'exito', label: 'Éxito', color: '#206344' },
  { key: 'atrasado', label: 'Llegó atrasado', color: '#C98A1B' },
  { key: 'mal_servicio', label: 'Mal servicio', color: '#B42318' },
  { key: 'en_reclamo', label: 'En reclamo', color: '#7A3E9D' },
  { key: 'falla_profesional', label: 'Profesional no llegó o canceló', color: '#123F43' },
  { key: 'cliente_ausente', label: 'Cliente ausente', color: '#685943' },
  { key: 'cancelo_cliente', label: 'Canceló el cliente', color: '#8FA6A3' },
  { key: 'cancelada_otra', label: 'Cancelada (otro motivo)', color: '#C9D3D0' },
];

export function caseOutcome(b: DashBooking, f: CaseFlags = caseFlags(b)): CaseOutcome | null {
  if (!f.closed) return null;
  if (b.status === 'en_disputa' || (b.claim && b.claim.status !== 'resuelto')) return 'en_reclamo';
  if (b.status === 'completada') return f.badService ? 'mal_servicio' : f.late ? 'atrasado' : 'exito';
  if (f.clientAbsent) return 'cliente_ausente';
  if (f.clientCancelled) return 'cancelo_cliente';
  if (f.proCancelled || f.proNoShow) return 'falla_profesional';
  return 'cancelada_otra';
}

/* --------------------------------- Dinero ---------------------------------- */

const extraPaid = (b: DashBooking) => (b.extra && ['por_cobrar', 'pagado', 'pagado_tarjeta', 'pagado_efectivo'].includes(b.extra.status) ? b.extra.amount : 0);

/** Lo que mueve una reserva: venta total, ingreso estimado de HULUL y parte del profesional. */
export function bookingMoney(b: DashBooking) {
  if (b.status === 'completada' || b.status === 'en_disputa' || ['pendiente', 'confirmada', 'en_camino', 'en_curso', 'por_aprobar'].includes(b.status)) {
    const base = r2(b.visit + b.surcharge);
    const extra = extraPaid(b);
    const commission = r2((base + extra) * COMMISSION);
    return { gross: r2(b.total + extra), hulul: r2(b.fee + commission), pro: r2(base + extra - commission), extra, commission };
  }
  if (b.status === 'cancelada') {
    const fee = r2(b.cancelFee);
    return { gross: fee, hulul: r2(fee * 0.2 + b.proFine), pro: r2(fee * 0.8 - b.proFine), extra: 0, commission: 0 };
  }
  return { gross: 0, hulul: 0, pro: 0, extra: 0, commission: 0 };
}

/* ----------------------------- Resumen ejecutivo ---------------------------- */

export interface Executive {
  total: number;
  byStage: Record<Stage, number>;
  closed: number;
  open: number;
  outcomes: { key: CaseOutcome; label: string; color: string; count: number; share: number }[];
  rates: { success: number; late: number; badService: number; clientReported: number; cancelled: number; proFault: number; clientAbsent: number };
  counts: { success: number; late: number; badService: number; clientReported: number; cancelled: number; proFault: number; clientAbsent: number; claims: number };
  gross: number; hulul: number; pro: number; avgTicket: number; projected: number;
  avgRating: number | null; ratedCount: number; avgLateMin: number | null;
  clients: number; newClients: number; repeatClients: number; activePros: number;
  byCategory: { category: string; count: number; success: number; gross: number }[];
  byWeek: { week: string; total: number; success: number; problems: number }[];
  topPros: { proId: string; name: string; done: number; success: number; rating: number | null; problems: number }[];
  watchPros: { proId: string; name: string; done: number; late: number; bad: number; noShow: number }[];
  watchClients: { clientId: string; name: string; reported: number; absent: number; cancelled: number }[];
}

/** Indicadores de las reservas cuya cita cae en el rango. */
export function executive(all: DashBooking[], range: DateRange): Executive {
  const rows = all.filter((b) => inRange(b.date, range));
  const byStage: Record<Stage, number> = { programada: 0, ejecucion: 0, ejecutada: 0, reclamo: 0, cancelada: 0 };
  const outCount = new Map<CaseOutcome, number>();
  const counts = { success: 0, late: 0, badService: 0, clientReported: 0, cancelled: 0, proFault: 0, clientAbsent: 0, claims: 0 };
  let gross = 0, hulul = 0, pro = 0, done = 0, projected = 0, ratingSum = 0, rated = 0, lateSum = 0, lateN = 0, closed = 0;
  const cat = new Map<string, { count: number; success: number; gross: number }>();
  const weeks = new Map<string, { total: number; success: number; problems: number }>();
  const pros = new Map<string, { name: string; done: number; success: number; late: number; bad: number; noShow: number; rating: number[] }>();
  const cli = new Map<string, { name: string; reported: number; absent: number; cancelled: number; count: number }>();

  for (const b of rows) {
    const f = caseFlags(b);
    const st = stageOf(b);
    byStage[st] += 1;
    const m = bookingMoney(b);
    const c = cat.get(b.category) ?? { count: 0, success: 0, gross: 0 };
    c.count += 1;
    const w = mondayOf(b.date);
    const wk = weeks.get(w) ?? { total: 0, success: 0, problems: 0 };
    wk.total += 1;
    const p = pros.get(b.proId) ?? { name: b.proName, done: 0, success: 0, late: 0, bad: 0, noShow: 0, rating: [] };
    const cl = cli.get(b.clientId) ?? { name: b.clientName, reported: 0, absent: 0, cancelled: 0, count: 0 };
    cl.count += 1;
    if (st === 'programada' || st === 'ejecucion') projected = r2(projected + m.gross);
    if (b.status === 'completada') { gross = r2(gross + m.gross); hulul = r2(hulul + m.hulul); pro = r2(pro + m.pro); done += 1; c.gross = r2(c.gross + m.gross); p.done += 1; }
    // En reclamo: el cliente ya pagó; el dinero está retenido, pero entró.
    else if (b.status === 'en_disputa') { gross = r2(gross + m.gross); hulul = r2(hulul + m.hulul); pro = r2(pro + m.pro); }
    else if (b.status === 'cancelada') { gross = r2(gross + m.gross); hulul = r2(hulul + m.hulul); pro = r2(pro + m.pro); }
    if (b.rating !== null) { ratingSum += b.rating; rated += 1; p.rating.push(b.rating); }
    if (f.lateMin !== null && f.lateMin > LATE_TOLERANCE_MIN) { lateSum += f.lateMin; lateN += 1; }
    if (b.claim) counts.claims += 1;
    if (f.closed) {
      closed += 1;
      const o = caseOutcome(b, f)!;
      outCount.set(o, (outCount.get(o) ?? 0) + 1);
      if (f.success) { counts.success += 1; c.success += 1; wk.success += 1; p.success += 1; }
      if (f.late) { counts.late += 1; p.late += 1; }
      if (f.badService) { counts.badService += 1; p.bad += 1; }
      if (f.clientReported) { counts.clientReported += 1; cl.reported += 1; }
      if (b.status === 'cancelada') counts.cancelled += 1;
      if (f.proCancelled || f.proNoShow) { counts.proFault += 1; p.noShow += 1; }
      if (f.clientAbsent) { counts.clientAbsent += 1; cl.absent += 1; }
      if (f.clientCancelled) cl.cancelled += 1;
      if (!f.success) wk.problems += 1;
    }
    cat.set(b.category, c); weeks.set(w, wk); if (b.proId) pros.set(b.proId, p); if (b.clientId) cli.set(b.clientId, cl);
  }

  // Clientes nuevos = primera reserva (en todo el historial cargado) dentro del rango.
  const first = new Map<string, string>();
  for (const b of all) if (b.clientId && (!first.has(b.clientId) || b.date < first.get(b.clientId)!)) first.set(b.clientId, b.date);
  const clientIds = [...cli.keys()];
  const newClients = clientIds.filter((id) => inRange(first.get(id) ?? '', range)).length;
  const repeatClients = clientIds.filter((id) => all.filter((b) => b.clientId === id && b.status === 'completada').length >= 2).length;

  const rates = Object.fromEntries(Object.entries(counts).filter(([k]) => k !== 'claims').map(([k, v]) => [k, pctOf(v, closed)])) as Executive['rates'];
  const proList = [...pros.entries()].map(([proId, p]) => ({ proId, ...p, avg: p.rating.length ? r2(p.rating.reduce((s, x) => s + x, 0) / p.rating.length) : null }));
  return {
    total: rows.length, byStage, closed, open: rows.length - closed,
    outcomes: OUTCOMES.map((o) => ({ ...o, count: outCount.get(o.key) ?? 0, share: pctOf(outCount.get(o.key) ?? 0, closed) })),
    rates, counts, gross, hulul, pro, avgTicket: done ? r2(gross / done) : 0, projected,
    avgRating: rated ? r2(ratingSum / rated) : null, ratedCount: rated, avgLateMin: lateN ? Math.round(lateSum / lateN) : null,
    clients: clientIds.length, newClients, repeatClients, activePros: pros.size,
    byCategory: [...cat.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.count - a.count),
    byWeek: [...weeks.entries()].map(([week, v]) => ({ week, ...v })).sort((a, b) => a.week.localeCompare(b.week)),
    topPros: proList.filter((p) => p.done > 0).sort((a, b) => b.success - a.success || (b.avg ?? 0) - (a.avg ?? 0)).slice(0, 5)
      .map((p) => ({ proId: p.proId, name: p.name, done: p.done, success: p.success, rating: p.avg, problems: p.late + p.bad + p.noShow })),
    watchPros: proList.filter((p) => p.late + p.bad + p.noShow > 0).sort((a, b) => (b.late + b.bad + 2 * b.noShow) - (a.late + a.bad + 2 * a.noShow)).slice(0, 5)
      .map((p) => ({ proId: p.proId, name: p.name, done: p.done, late: p.late, bad: p.bad, noShow: p.noShow })),
    watchClients: [...cli.entries()].filter(([, c]) => c.reported + c.absent > 0 || c.cancelled >= 2)
      .sort(([, a], [, b]) => (b.reported * 2 + b.absent + b.cancelled) - (a.reported * 2 + a.absent + a.cancelled)).slice(0, 5)
      .map(([clientId, c]) => ({ clientId, name: c.name, reported: c.reported, absent: c.absent, cancelled: c.cancelled })),
  };
}

/* -------------------------------- Contabilidad ------------------------------ */

export const BUCKET_LABEL: Record<string, string> = {
  recaudo: 'Recaudo por la pasarela', terceros: 'Dinero de profesionales (terceros)', ingreso_hulul: 'Ingreso de HULUL',
  iva_por_pagar: 'IVA por pagar', pasivo_cliente: 'Créditos a clientes', retenciones_por_pagar: 'Retenciones por pagar',
};

export const KIND_LABEL: Record<string, string> = {
  recaudo_visita: 'Cobro con tarjeta', recaudo_adicional: 'Cobro adicional con tarjeta', visita: 'Factura del profesional (visita)',
  plataforma: 'Cargo de plataforma', plataforma_iva: 'IVA del cargo de plataforma', comision: 'Comisión HULUL', comision_iva: 'IVA de la comisión',
  adicional: 'Factura del profesional (adicional)', adicional_comision: 'Comisión del adicional', adicional_comision_iva: 'IVA comisión adicional',
  cargo_cancelacion: 'Cancelación / ausente (profesional)', cargo_cancelacion_hulul: 'Cancelación / ausente (HULUL)', multa: 'Multa al profesional',
  credito_cliente: 'Crédito al cliente', retencion_renta: 'Retención de renta', retencion_iva: 'Retención de IVA',
  abono_profesional: 'Pago recibido del profesional (deuda de efectivo)',
};

export interface Accounting {
  /** Antes: reservas programadas o en curso, aún sin movimientos. */
  before: { count: number; gross: number; hulul: number; pro: number };
  /** Durante: dinero del profesional retenido (ventana de 48 h o reclamo). */
  during: { held: number; disputed: number; available: number; owedByPros: number; entries: number };
  /** Después: liquidaciones por pagar y pagadas. */
  after: { toPay: number; toPayCount: number; paid: number; paidCount: number };
  buckets: { bucket: string; label: string; amount: number }[];
  income: { kind: string; label: string; amount: number }[];
  incomeTotal: number; vatDue: number; collected: number; thirdParty: number; clientCredits: number;
  byWeek: { week: string; income: number; collected: number }[];
}

export function accounting(data: Pick<DashData, 'ledger' | 'payouts' | 'bookings'>, range: DateRange, now: number): Accounting {
  const live = data.ledger;
  const disputed = new Set(data.bookings.filter((b) => b.status === 'en_disputa').map((b) => b.id));
  const before = { count: 0, gross: 0, hulul: 0, pro: 0 };
  for (const b of data.bookings) {
    if (!inRange(b.date, range) || b.demo) continue;
    const st = stageOf(b);
    if (st !== 'programada' && st !== 'ejecucion') continue;
    const m = bookingMoney(b);
    before.count += 1; before.gross = r2(before.gross + m.gross); before.hulul = r2(before.hulul + m.hulul); before.pro = r2(before.pro + m.pro);
  }
  // Durante: lo pendiente de liquidar hoy (no depende del rango).
  const during = { held: 0, disputed: 0, available: 0, owedByPros: 0, entries: 0 };
  const pendingByPro = new Map<string, number>();
  for (const e of live) {
    if (e.payoutId || e.proDelta === 0) continue;
    during.entries += 1;
    pendingByPro.set(e.proId, r2((pendingByPro.get(e.proId) ?? 0) + e.proDelta));
    if (e.proDelta < 0) continue;
    if (e.bookingId && disputed.has(e.bookingId)) during.disputed = r2(during.disputed + e.proDelta);
    else if ((e.availableAt ?? 0) > now) during.held = r2(during.held + e.proDelta);
    else during.available = r2(during.available + e.proDelta);
  }
  during.owedByPros = r2([...pendingByPro.values()].filter((v) => v < 0).reduce((s, v) => s - v, 0));
  const after = { toPay: 0, toPayCount: 0, paid: 0, paidCount: 0 };
  for (const p of data.payouts) {
    if (p.status === 'pagado') { if (!range || inRange(p.week, range)) { after.paid = r2(after.paid + p.net); after.paidCount += 1; } }
    else if (p.status === 'por_pagar') { after.toPay = r2(after.toPay + p.net); after.toPayCount += 1; }
  }
  const bucketMap = new Map<string, number>();
  const incomeMap = new Map<string, number>();
  const weeks = new Map<string, { income: number; collected: number }>();
  for (const e of live) {
    if (!msInRange(e.createdAt, range)) continue;
    bucketMap.set(e.bucket, r2((bucketMap.get(e.bucket) ?? 0) + e.amount));
    if (e.bucket === 'ingreso_hulul') incomeMap.set(e.kind, r2((incomeMap.get(e.kind) ?? 0) + e.amount));
    const w = mondayOf(ecDate(e.createdAt!));
    const wk = weeks.get(w) ?? { income: 0, collected: 0 };
    if (e.bucket === 'ingreso_hulul') wk.income = r2(wk.income + e.amount);
    if (e.bucket === 'recaudo') wk.collected = r2(wk.collected + e.amount);
    weeks.set(w, wk);
  }
  const buckets = Object.keys(BUCKET_LABEL).map((bucket) => ({ bucket, label: BUCKET_LABEL[bucket], amount: bucketMap.get(bucket) ?? 0 }));
  const income = [...incomeMap.entries()].map(([kind, amount]) => ({ kind, label: KIND_LABEL[kind] ?? kind, amount })).sort((a, b) => b.amount - a.amount);
  return {
    before, during, after, buckets, income,
    incomeTotal: bucketMap.get('ingreso_hulul') ?? 0, vatDue: bucketMap.get('iva_por_pagar') ?? 0, collected: bucketMap.get('recaudo') ?? 0,
    thirdParty: bucketMap.get('terceros') ?? 0, clientCredits: bucketMap.get('pasivo_cliente') ?? 0,
    byWeek: [...weeks.entries()].map(([week, v]) => ({ week, ...v })).sort((a, b) => a.week.localeCompare(b.week)),
  };
}

/* --------------------------------- Proveedores ------------------------------ */

export interface ProviderInvoice {
  bookingId: string; code: string; date: string; category: string; clientName: string;
  base: number; iva: number; total: number; commission: number; commissionIva: number; reversed: boolean;
  /** Calculada desde la reserva porque no tiene movimientos (reserva de prueba o anterior al libro). */
  estimated?: boolean;
}

export interface ProviderStats {
  provider: DashProvider;
  scheduled: number; inProgress: number; done: number; cancelledByPro: number; late: number; bad: number; claims: number; success: number;
  billed: { base: number; iva: number; total: number };
  commission: number; fines: number; paid: number; toPay: number; pending: number;
  lastJob: string | null; nextJob: string | null; categoriesDone: Record<string, number>;
  invoices: ProviderInvoice[];
  payouts: DashPayout[];
}

/** Facturas (comprobantes) que emite el profesional, armadas desde el libro. */
export function providerInvoices(uid: string, data: Pick<DashData, 'ledger' | 'bookings'>, range?: DateRange): ProviderInvoice[] {
  const byBooking = new Map<string, DashLedger[]>();
  for (const e of data.ledger) if (e.proId === uid && e.bookingId) byBooking.set(e.bookingId, [...(byBooking.get(e.bookingId) ?? []), e]);
  const bookings = new Map(data.bookings.map((b) => [b.id, b]));
  const out: ProviderInvoice[] = [];
  for (const [bookingId, entries] of byBooking) {
    const sum = (kinds: string[], f: (e: DashLedger) => number) => r2(entries.filter((e) => kinds.includes(e.kind)).reduce((s, e) => s + f(e), 0));
    const total = sum(['visita', 'adicional'], (e) => e.amount);
    const anyInvoice = entries.some((e) => e.kind === 'visita' || e.kind === 'adicional');
    if (!anyInvoice) continue;
    const b = bookings.get(bookingId);
    const date = b?.date ?? (entries[0].createdAt ? ecDate(entries[0].createdAt) : '');
    if (range && !inRange(date, range)) continue;
    out.push({
      bookingId, code: b?.code ?? bookingId.slice(-6).toUpperCase(), date, category: b?.category ?? '', clientName: b?.clientName ?? '',
      base: sum(['visita', 'adicional'], (e) => e.base ?? 0), iva: sum(['visita', 'adicional'], (e) => e.iva ?? 0), total,
      commission: sum(['comision', 'adicional_comision'], (e) => e.amount), commissionIva: sum(['comision_iva', 'adicional_comision_iva'], (e) => e.amount),
      reversed: total === 0,
    });
  }
  // Reservas completadas sin movimientos en el libro (pruebas o anteriores al libro): se estiman.
  const withLedger = new Set(out.map((i) => i.bookingId));
  for (const b of data.bookings) {
    if (b.proId !== uid || b.status !== 'completada' || withLedger.has(b.id) || (range && !inRange(b.date, range))) continue;
    const extra = b.extra && ['por_cobrar', 'pagado', 'pagado_tarjeta', 'pagado_efectivo'].includes(b.extra.status) ? b.extra.amount : 0;
    const base = r2(b.visit + b.surcharge + extra);
    const iva = b.taxRegime === 'rimpe_popular' ? 0 : r2(base * 0.15);
    const commission = r2(base * COMMISSION);
    out.push({ bookingId: b.id, code: b.code, date: b.date, category: b.category, clientName: b.clientName, base, iva, total: r2(base + iva), commission, commissionIva: r2(commission * 0.15), reversed: false, estimated: true });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function providerStats(data: DashData, range: DateRange, now: number): ProviderStats[] {
  const today = ecDate(now);
  const known = new Map(data.providers.map((p) => [p.uid, p]));
  // Profesionales que aparecen en reservas pero no se cargaron (p. ej., ya no aprobados).
  for (const b of data.bookings) {
    if (b.proId && !known.has(b.proId)) {
      known.set(b.proId, { uid: b.proId, name: b.proName, kind: 'persona', status: '', categories: [], catStatus: {}, cities: [], rating: null, reviewCount: 0, jobsDone: 0, strikes30: 0, suspendedUntil: null, suspendedReason: '', payoutBalance: 0, cashDebt: 0, fines: 0, taxRegime: 'general', eSignature: false, acceptsCash: false, tester: false, ruc: '', email: '', phone: '', submittedAt: null, reviewedAt: null });
    }
  }
  return [...known.values()].map((provider) => {
    const mine = data.bookings.filter((b) => b.proId === provider.uid);
    const inR = mine.filter((b) => inRange(b.date, range));
    const s = { scheduled: 0, inProgress: 0, done: 0, cancelledByPro: 0, late: 0, bad: 0, claims: 0, success: 0 };
    const categoriesDone: Record<string, number> = {};
    for (const b of inR) {
      const f = caseFlags(b);
      const st = stageOf(b);
      if (st === 'programada') s.scheduled += 1;
      if (st === 'ejecucion') s.inProgress += 1;
      if (b.status === 'completada') { s.done += 1; categoriesDone[b.category] = (categoriesDone[b.category] ?? 0) + 1; }
      if (f.proCancelled || f.proNoShow) s.cancelledByPro += 1;
      if (f.late) s.late += 1;
      if (f.badService) s.bad += 1;
      if (f.success) s.success += 1;
      if (b.claim) s.claims += 1;
    }
    const invoices = providerInvoices(provider.uid, data, range);
    const billed = invoices.reduce((t, i) => ({ base: r2(t.base + i.base), iva: r2(t.iva + i.iva), total: r2(t.total + i.total) }), { base: 0, iva: 0, total: 0 });
    const commission = r2(invoices.reduce((t, i) => t + i.commission, 0));
    const fines = r2(data.ledger.filter((e) => e.proId === provider.uid && e.kind === 'multa' && msInRange(e.createdAt, range)).reduce((t, e) => t + e.amount, 0));
    const payouts = data.payouts.filter((p) => p.proId === provider.uid).sort((a, b) => b.week.localeCompare(a.week));
    const paid = r2(payouts.filter((p) => p.status === 'pagado' && inRange(p.week, range)).reduce((t, p) => t + p.net, 0));
    const toPay = r2(payouts.filter((p) => p.status === 'por_pagar').reduce((t, p) => t + p.net, 0));
    const pending = r2(data.ledger.filter((e) => e.proId === provider.uid && !e.payoutId).reduce((t, e) => t + e.proDelta, 0));
    const past = mine.filter((b) => b.status === 'completada').map((b) => b.date).sort();
    const future = mine.filter((b) => ['pendiente', 'confirmada'].includes(b.status) && b.date >= today).map((b) => b.date).sort();
    return { provider, ...s, billed, commission, fines, paid, toPay, pending, lastJob: past[past.length - 1] ?? null, nextJob: future[0] ?? null, categoriesDone, invoices, payouts };
  });
}

/* ---------------------------------- Clientes -------------------------------- */

export interface ClientStats {
  clientId: string; name: string; phone: string; profile: DashClient | null;
  total: number; done: number; scheduled: number; cancelled: number; absent: number; reported: number; claims: number;
  spent: number; avgStarsGiven: number | null; avgStarsReceived: number | null;
  first: string | null; last: string | null; next: string | null;
  bookings: DashBooking[];
}

export function clientStats(data: DashData, now: number): ClientStats[] {
  const today = ecDate(now);
  const profiles = new Map(data.clients.map((c) => [c.uid, c]));
  const groups = new Map<string, DashBooking[]>();
  for (const b of data.bookings) if (b.clientId) groups.set(b.clientId, [...(groups.get(b.clientId) ?? []), b]);
  for (const c of data.clients) if (!groups.has(c.uid)) groups.set(c.uid, []);
  return [...groups.entries()].map(([clientId, list]) => {
    const profile = profiles.get(clientId) ?? null;
    const sorted = [...list].sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
    let done = 0, scheduled = 0, cancelled = 0, absent = 0, reported = 0, claims = 0, spent = 0;
    const given: number[] = []; const received: number[] = [];
    for (const b of list) {
      const f = caseFlags(b);
      if (b.status === 'completada') { done += 1; spent = r2(spent + bookingMoney(b).gross); }
      else if (b.status === 'cancelada') { cancelled += 1; spent = r2(spent + b.cancelFee); }
      if (stageOf(b) === 'programada') scheduled += 1;
      if (f.clientAbsent) absent += 1;
      if (f.clientReported) reported += 1;
      if (b.claim) claims += 1;
      if (b.rating !== null) given.push(b.rating);
      if (b.clientStars !== null) received.push(b.clientStars);
    }
    const avg = (xs: number[]) => (xs.length ? r2(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
    const dates = list.map((b) => b.date).sort();
    const next = list.filter((b) => ['pendiente', 'confirmada'].includes(b.status) && b.date >= today).map((b) => b.date).sort()[0] ?? null;
    return {
      clientId, name: profile?.name || sorted[0]?.clientName || 'Sin nombre', phone: profile?.phone || sorted[0]?.clientPhone || '', profile,
      total: list.length, done, scheduled, cancelled, absent, reported, claims, spent,
      avgStarsGiven: avg(given), avgStarsReceived: avg(received),
      first: dates[0] ?? null, last: dates.filter((d) => d <= today).pop() ?? null, next, bookings: sorted,
    };
  });
}

/* --------------------------------- Exportar --------------------------------- */

/** CSV (separado por punto y coma, como lo abre Excel en español). */
export function toCsv(rows: Record<string, string | number | null | undefined>[], columns: { key: string; label: string }[]): string {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [columns.map((c) => cell(c.label)).join(';'), ...rows.map((r) => columns.map((c) => cell(r[c.key])).join(';'))].join('\r\n');
}

/* ----------------------------- Cumplimiento (UAFE) ---------------------------- */

/**
 * Umbrales de referencia para alertas internas. No son la norma: los confirma la
 * oficial de cumplimiento. RESU = reporte de operaciones que igualan o superan
 * US$10.000 (en un mes, por cliente).
 */
export const COMPLIANCE_LIMITS = {
  singleOperation: 1000,
  clientMonthly: 10000,
  clientMonthlyWarn: 5000,
  cashMonthly: 2000,
  proMonthlyPayouts: 10000,
  samePairWeek: 5,
};

export type AlertLevel = 'alta' | 'media';
export interface ComplianceAlert {
  key: string; level: AlertLevel; kind: string; title: string; detail: string;
  who: { type: 'cliente' | 'profesional'; id: string; name: string };
  amount: number; bookings: string[];
}

const monthOf = (iso: string) => iso.slice(0, 7);
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const monthName = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym} ${ym.slice(0, 4)}`;

/** Alertas de operaciones inusuales o que llegan a umbrales, en las reservas cobradas del rango. */
export function complianceAlerts(data: Pick<DashData, 'bookings' | 'payouts' | 'providers'>, range: DateRange, L = COMPLIANCE_LIMITS): ComplianceAlert[] {
  const out: ComplianceAlert[] = [];
  const paid = data.bookings.filter((b) => inRange(b.date, range) && !b.demo && (b.status === 'completada' || b.status === 'en_disputa' || (b.status === 'cancelada' && b.cancelFee > 0)));
  for (const b of paid) {
    const g = bookingMoney(b).gross;
    if (g >= L.singleOperation) out.push({ key: `op_${b.id}`, level: 'media', kind: 'operacion', title: `Operación de ${money(g)}`, detail: `${b.code} · ${b.date} · ${b.paymentMethod || 'sin forma de pago'}`, who: { type: 'cliente', id: b.clientId, name: b.clientName }, amount: g, bookings: [b.code] });
  }
  const byClientMonth = new Map<string, { name: string; total: number; cash: number; codes: string[] }>();
  for (const b of paid) {
    const k = `${b.clientId}|${monthOf(b.date)}`;
    const c = byClientMonth.get(k) ?? { name: b.clientName, total: 0, cash: 0, codes: [] };
    const g = bookingMoney(b).gross;
    c.total = r2(c.total + g); if (b.paymentMethod === 'efectivo') c.cash = r2(c.cash + g); c.codes.push(b.code);
    byClientMonth.set(k, c);
  }
  for (const [k, c] of byClientMonth) {
    const [id, month] = k.split('|');
    if (c.total >= L.clientMonthly) out.push({ key: `resu_${k}`, level: 'alta', kind: 'acumulado', title: `Cliente con ${money(c.total)} en ${monthName(month)}`, detail: `Llega al umbral de ${money(L.clientMonthly)} al mes (revisar RESU).`, who: { type: 'cliente', id, name: c.name }, amount: c.total, bookings: c.codes });
    else if (c.total >= L.clientMonthlyWarn) out.push({ key: `acum_${k}`, level: 'media', kind: 'acumulado', title: `Cliente con ${money(c.total)} en ${monthName(month)}`, detail: `Supera ${money(L.clientMonthlyWarn)} en el mes.`, who: { type: 'cliente', id, name: c.name }, amount: c.total, bookings: c.codes });
    if (c.cash >= L.cashMonthly) out.push({ key: `cash_${k}`, level: 'alta', kind: 'efectivo', title: `${money(c.cash)} en efectivo en ${monthName(month)}`, detail: `Pagos en efectivo de un mismo cliente sobre ${money(L.cashMonthly)}.`, who: { type: 'cliente', id, name: c.name }, amount: c.cash, bookings: c.codes });
  }
  // Mismo cliente y mismo profesional, muchas veces en 7 días: posible fraccionamiento o acuerdo por fuera.
  const pairs = new Map<string, DashBooking[]>();
  for (const b of paid) if (b.clientId && b.proId) pairs.set(`${b.clientId}|${b.proId}`, [...(pairs.get(`${b.clientId}|${b.proId}`) ?? []), b]);
  for (const [k, list] of pairs) {
    const sorted = list.slice().sort((a, z) => a.date.localeCompare(z.date));
    for (let i = 0; i < sorted.length; i++) {
      const end = addDays(sorted[i].date, 6);
      const win = sorted.filter((b) => b.date >= sorted[i].date && b.date <= end);
      if (win.length >= L.samePairWeek) {
        const total = r2(win.reduce((t, b) => t + bookingMoney(b).gross, 0));
        out.push({ key: `pair_${k}_${sorted[i].date}`, level: 'media', kind: 'repetido', title: `${win.length} servicios en 7 días con el mismo profesional`, detail: `${win[0].clientName} → ${win[0].proName}, desde ${sorted[i].date}, por ${money(total)}.`, who: { type: 'cliente', id: win[0].clientId, name: win[0].clientName }, amount: total, bookings: win.map((b) => b.code) });
        break;
      }
    }
  }
  const proName = new Map(data.providers.map((p) => [p.uid, p.name]));
  const byProMonth = new Map<string, number>();
  for (const p of data.payouts) if (inRange(p.week, range)) byProMonth.set(`${p.proId}|${monthOf(p.week)}`, r2((byProMonth.get(`${p.proId}|${monthOf(p.week)}`) ?? 0) + p.net));
  for (const [k, total] of byProMonth) {
    const [id, month] = k.split('|');
    if (total >= L.proMonthlyPayouts) out.push({ key: `pro_${k}`, level: 'alta', kind: 'liquidaciones', title: `Profesional con ${money(total)} liquidados en ${monthName(month)}`, detail: `Supera ${money(L.proMonthlyPayouts)} al mes.`, who: { type: 'profesional', id, name: proName.get(id) ?? id }, amount: total, bookings: [] });
  }
  const lv = { alta: 0, media: 1 };
  return out.sort((a, b) => lv[a.level] - lv[b.level] || b.amount - a.amount);
}

/* ------------------------------ Calidad del servicio ----------------------------- */

const OUTCOME_LABEL: Record<string, string> = { resuelto: 'Resuelto', parcial: 'Completado en parte', no_resuelto: 'No se pudo resolver' };
const CANCEL_LABEL = (b: DashBooking, f: CaseFlags) =>
  f.clientAbsent ? 'Cliente ausente' : f.proNoShow ? 'Profesional no se presentó' : f.proCancelled ? 'Profesional tarde o canceló'
    : f.clientCancelled ? 'Canceló el cliente' : b.cancelledBy === 'sistema' ? 'Nadie aceptó a tiempo' : b.cancelledBy === 'reclamo' ? 'Anulada por reclamo' : 'Otro motivo';

/** Un grupo de reservas que se puede abrir (cada número del resumen lleva a su lista). */
export interface Bucket { key: string; label: string; count: number; ids: string[]; value?: number }
const bucket = (m: Map<string, Bucket>, key: string, label: string, id: string, value?: number) => {
  const b = m.get(key) ?? { key, label, count: 0, ids: [], value: 0 };
  b.count += 1; b.ids.push(id); if (value !== undefined) b.value = r2((b.value ?? 0) + value);
  m.set(key, b);
};

export interface Quality {
  stars: Bucket[]; avgRating: number | null; rated: number;
  ratingByWeek: { week: string; avg: number | null; count: number }[];
  punctuality: { arrived: number; onTime: Bucket; late: Bucket; avgLateMin: number | null };
  outcomes: Bucket[];
  accept: { avgMin: number | null; within15: number; count: number };
  loyalty: { clients: number; returning: Bucket; samePro: Bucket };
  claimReasons: Bucket[]; cancelReasons: Bucket[];
  categories: { category: string; avg: number | null; rated: number; done: number; ids: string[] }[];
  comments: { id: string; code: string; date: string; category: string; proName: string; clientName: string; rating: number; text: string }[];
}

/** Lo cualitativo del periodo: estrellas, puntualidad, resultado, fidelidad, motivos y comentarios. */
export function quality(all: DashBooking[], range: DateRange): Quality {
  const rows = all.filter((b) => inRange(b.date, range));
  const stars = new Map<string, Bucket>(); [5, 4, 3, 2, 1].forEach((n) => stars.set(String(n), { key: String(n), label: `${n} ★`, count: 0, ids: [] }));
  const outcomes = new Map<string, Bucket>(); Object.entries(OUTCOME_LABEL).forEach(([k, l]) => outcomes.set(k, { key: k, label: l, count: 0, ids: [] }));
  const claims = new Map<string, Bucket>(); const cancels = new Map<string, Bucket>();
  const weeks = new Map<string, number[]>();
  const cats = new Map<string, { r: number[]; done: number; ids: string[] }>();
  const onTime: Bucket = { key: 'a_tiempo', label: 'Llegó a tiempo', count: 0, ids: [] };
  const late: Bucket = { key: 'tarde', label: 'Llegó tarde', count: 0, ids: [] };
  let lateSum = 0, ratingSum = 0, rated = 0, acceptSum = 0, acceptN = 0, within15 = 0;
  const comments: Quality['comments'] = [];

  for (const b of rows) {
    const f = caseFlags(b);
    if (b.rating !== null) {
      bucket(stars, String(Math.round(b.rating)), `${Math.round(b.rating)} ★`, b.id);
      ratingSum += b.rating; rated += 1;
      const w = mondayOf(b.date); weeks.set(w, [...(weeks.get(w) ?? []), b.rating]);
      if (b.ratingText && b.rating <= 3) comments.push({ id: b.id, code: b.code, date: b.date, category: b.category, proName: b.proName, clientName: b.clientName, rating: b.rating, text: b.ratingText });
    }
    if (f.lateMin !== null) {
      if (f.lateMin > LATE_TOLERANCE_MIN) { late.count += 1; late.ids.push(b.id); lateSum += f.lateMin; } else { onTime.count += 1; onTime.ids.push(b.id); }
    }
    if (b.outcome && OUTCOME_LABEL[b.outcome]) bucket(outcomes, b.outcome, OUTCOME_LABEL[b.outcome], b.id);
    if (b.acceptedAt && b.createdAt && b.acceptedAt >= b.createdAt) {
      const min = (b.acceptedAt - b.createdAt) / 60_000; acceptSum += min; acceptN += 1; if (min <= 15) within15 += 1;
    }
    if (b.claim) bucket(claims, b.claim.kindLabel || b.claim.kind || 'otro', b.claim.kindLabel || (b.claim.openedBy === 'profesional' ? 'Reclamo del profesional' : 'Reclamo del cliente'), b.id);
    if (b.status === 'cancelada') { const l = CANCEL_LABEL(b, f); bucket(cancels, l, l, b.id); }
    const c = cats.get(b.category) ?? { r: [], done: 0, ids: [] };
    if (b.status === 'completada') { c.done += 1; c.ids.push(b.id); }
    if (b.rating !== null) c.r.push(b.rating);
    cats.set(b.category, c);
  }

  // Fidelidad: clientes del periodo que ya tenían una reserva completada antes, y que repiten profesional.
  const done = all.filter((b) => b.status === 'completada');
  const clientIds = [...new Set(rows.filter((b) => b.status === 'completada').map((b) => b.clientId).filter(Boolean))];
  const returning: Bucket = { key: 'vuelven', label: 'Clientes que vuelven', count: 0, ids: [] };
  const samePro: Bucket = { key: 'mismo_pro', label: 'Repiten con el mismo profesional', count: 0, ids: [] };
  for (const id of clientIds) {
    const mine = done.filter((b) => b.clientId === id).sort((a, z) => a.date.localeCompare(z.date));
    if (mine.length >= 2) { returning.count += 1; returning.ids.push(...mine.filter((b) => inRange(b.date, range)).map((b) => b.id)); }
    const byPro = new Map<string, number>(); for (const b of mine) byPro.set(b.proId, (byPro.get(b.proId) ?? 0) + 1);
    if ([...byPro.values()].some((n) => n >= 2)) { samePro.count += 1; samePro.ids.push(...mine.filter((b) => inRange(b.date, range)).map((b) => b.id)); }
  }

  const sortB = (m: Map<string, Bucket>) => [...m.values()].filter((b) => b.count > 0).sort((a, z) => z.count - a.count);
  return {
    stars: [...stars.values()], avgRating: rated ? r2(ratingSum / rated) : null, rated,
    ratingByWeek: [...weeks.entries()].sort(([a], [z]) => a.localeCompare(z)).map(([week, r]) => ({ week, avg: r.length ? r2(r.reduce((t, x) => t + x, 0) / r.length) : null, count: r.length })),
    punctuality: { arrived: onTime.count + late.count, onTime, late, avgLateMin: late.count ? Math.round(lateSum / late.count) : null },
    outcomes: [...outcomes.values()],
    accept: { avgMin: acceptN ? Math.round(acceptSum / acceptN) : null, within15, count: acceptN },
    loyalty: { clients: clientIds.length, returning, samePro },
    claimReasons: sortB(claims), cancelReasons: sortB(cancels),
    categories: [...cats.entries()].filter(([, c]) => c.done > 0 || c.r.length > 0)
      .map(([category, c]) => ({ category, avg: c.r.length ? r2(c.r.reduce((t, x) => t + x, 0) / c.r.length) : null, rated: c.r.length, done: c.done, ids: c.ids }))
      .sort((a, z) => (z.avg ?? 0) - (a.avg ?? 0)),
    comments: comments.sort((a, z) => z.date.localeCompare(a.date)).slice(0, 8),
  };
}

/* ------------------------------- Dinero de la semana ------------------------------ */

export interface WeekMoney {
  week: { from: string; to: string };
  /** Lo que entró esta semana (cobros con tarjeta + ingreso de HULUL registrado). */
  collected: number; income: number;
  /** Lo que HULUL debe pagar: liquidaciones por pagar hoy y lo que entra en la del próximo lunes. */
  toPayNow: { amount: number; count: number; ids: string[] };
  nextPayout: { date: string; estimate: number; pros: number };
  credits: number; vatDue: number;
  net: number;
}

/** Entradas y salidas de dinero de la semana actual (lunes a domingo, hora de Ecuador). */
export function weekMoney(data: Pick<DashData, 'ledger' | 'payouts' | 'bookings'>, now: number): WeekMoney {
  const today = ecDate(now); const from = mondayOf(today); const to = addDays(from, 6);
  const wk = { from, to };
  let collected = 0, income = 0, credits = 0, vatDue = 0;
  for (const e of data.ledger) {
    if (!msInRange(e.createdAt, wk)) continue;
    if (e.bucket === 'recaudo') collected = r2(collected + e.amount);
    if (e.bucket === 'ingreso_hulul') income = r2(income + e.amount);
    if (e.bucket === 'pasivo_cliente') credits = r2(credits + e.amount);
    if (e.bucket === 'iva_por_pagar') vatDue = r2(vatDue + e.amount);
  }
  const due = data.payouts.filter((p) => p.status === 'por_pagar');
  const toPayNow = { amount: r2(due.reduce((t, p) => t + p.net, 0)), count: due.length, ids: due.map((p) => p.id) };
  // Próximo lunes 06:00: entra lo que ya pasó las 48 h y no está en reclamo.
  const nextMonday = addDays(from, 7);
  const cutoff = Date.parse(`${nextMonday}T11:00:00Z`);
  const disputed = new Set(data.bookings.filter((b) => b.status === 'en_disputa').map((b) => b.id));
  const byPro = new Map<string, number>();
  for (const e of data.ledger) {
    if (e.payoutId || (e.availableAt ?? 0) > cutoff || (e.bookingId && disputed.has(e.bookingId))) continue;
    byPro.set(e.proId, r2((byPro.get(e.proId) ?? 0) + e.proDelta));
  }
  const positive = [...byPro.values()].filter((v) => v > 0);
  const estimate = r2(positive.reduce((t, v) => t + v, 0));
  return {
    week: wk, collected, income, toPayNow, nextPayout: { date: nextMonday, estimate, pros: positive.length }, credits, vatDue,
    net: r2(collected - toPayNow.amount - estimate),
  };
}

/* ------------------------- Contabilidad NIIF (Supercias) ------------------------- */

/**
 * Plan de cuentas de la Superintendencia de Compañías (códigos y nombres oficiales)
 * con el auxiliar que usa HULUL. Es una PROPUESTA para que la contadora valide;
 * si cambia un código, se cambia solo aquí.
 */
export const SUPERCIAS_ACCOUNTS = {
  bancos: { code: '10101', name: 'EFECTIVO Y EQUIVALENTES AL EFECTIVO', aux: 'Pasarela de pagos y banco' },
  cxcClientes: { code: '1010205', name: 'DOCUMENTOS Y CUENTAS POR COBRAR CLIENTES NO RELACIONADOS', aux: 'Clientes de la app' },
  otrasCxc: { code: '1010208', name: 'OTRAS CUENTAS POR COBRAR', aux: 'Profesionales que deben a HULUL (efectivo y multas)' },
  terceros: { code: '2010301', name: 'CUENTAS Y DOCUMENTOS POR PAGAR - LOCALES', aux: 'Profesionales: valores recaudados por cuenta de terceros' },
  sri: { code: '2010701', name: 'OTRAS OBLIGACIONES CORRIENTES - CON LA ADMINISTRACIÓN TRIBUTARIA', aux: 'IVA y retenciones por pagar' },
  pasivoCliente: { code: '20113', name: 'OTROS PASIVOS CORRIENTES', aux: 'Créditos a favor de clientes' },
  servicios: { code: '4102', name: 'PRESTACIÓN DE SERVICIOS', aux: 'Cargo de plataforma y comisión HULUL' },
  otrosOrdinarios: { code: '4109', name: 'OTROS INGRESOS DE ACTIVIDADES ORDINARIAS', aux: 'Multas y cargos por cancelación' },
  gasto: { code: '52', name: 'GASTOS (cuenta a definir por la contadora)', aux: 'Créditos entregados a clientes por faltas' },
} as const;
export type AccountKey = keyof typeof SUPERCIAS_ACCOUNTS;

export interface JournalLine {
  date: string; entry: string; account: AccountKey; code: string; accountName: string;
  party: string; detail: string; debit: number; credit: number;
}

const INCOME_ACCOUNT: Record<string, AccountKey> = {
  plataforma: 'servicios', comision: 'servicios', adicional_comision: 'servicios',
  multa: 'otrosOrdinarios', cargo_cancelacion_hulul: 'otrosOrdinarios',
};

/**
 * Libro diario por partida doble a partir del libro de movimientos y las liquidaciones pagadas.
 * Regla: la cuenta del profesional (2010301) se acredita cuando HULUL le debe (proDelta > 0) y
 * se debita cuando él paga algo (proDelta < 0); lo que paga el cliente pasa por 1010205 y se
 * cancela con el cobro de la pasarela (10101). Un reverso (monto negativo) invierte los lados.
 */
export function journal(data: Pick<DashData, 'ledger' | 'payouts' | 'bookings' | 'providers'>, range: DateRange): JournalLine[] {
  const A = SUPERCIAS_ACCOUNTS;
  const code = new Map(data.bookings.map((b) => [b.id, b]));
  const pro = new Map(data.providers.map((p) => [p.uid, p.name]));
  const out: JournalLine[] = [];
  const push = (date: string, entry: string, dr: AccountKey, cr: AccountKey, amount: number, party: string, detail: string) => {
    let a = r2(amount); let d = dr; let c = cr;
    if (!a) return;
    if (a < 0) { a = -a; [d, c] = [c, d]; }
    out.push({ date, entry, account: d, code: A[d].code, accountName: A[d].name, party, detail, debit: a, credit: 0 });
    out.push({ date, entry, account: c, code: A[c].code, accountName: A[c].name, party, detail, debit: 0, credit: a });
  };
  for (const e of data.ledger) {
    if (!msInRange(e.createdAt, range)) continue;
    const date = ecDate(e.createdAt!);
    const b = e.bookingId ? code.get(e.bookingId) : undefined;
    const entry = b?.code ?? (e.bookingId ? e.bookingId.slice(-6).toUpperCase() : e.payoutId ?? e.id);
    const proName = pro.get(e.proId) ?? b?.proName ?? e.proId;
    const label = `${KIND_LABEL[e.kind] ?? e.kind}${e.reverses ? ' (reverso)' : ''}`;
    // Lo paga el profesional (se descuenta de su cuenta) o el cliente.
    const payer: AccountKey = e.proDelta < 0 ? 'terceros' : 'cxcClientes';
    const payerName = e.proDelta < 0 ? proName : (b?.clientName || 'Cliente');
    switch (e.bucket) {
      case 'recaudo':
        if (e.kind === 'abono_profesional') push(date, entry, 'bancos', 'terceros', e.amount, proName, label);
        else push(date, entry, 'bancos', 'cxcClientes', e.amount, b?.clientName || 'Cliente', label);
        break;
      case 'terceros':
        // Si el profesional cobró en efectivo, HULUL no recibe ese dinero: no hay asiento.
        if (e.proDelta) push(date, entry, 'cxcClientes', 'terceros', e.proDelta, proName, label);
        break;
      case 'ingreso_hulul': push(date, entry, payer, INCOME_ACCOUNT[e.kind] ?? 'servicios', e.amount, payerName, label); break;
      case 'iva_por_pagar': push(date, entry, payer, 'sri', e.amount, payerName, label); break;
      case 'retenciones_por_pagar': push(date, entry, 'terceros', 'sri', e.amount, proName, label); break;
      case 'pasivo_cliente': push(date, entry, 'gasto', 'pasivoCliente', e.amount, b?.clientName || 'Cliente', label); break;
      default: break;
    }
  }
  for (const p of data.payouts) {
    if (p.status !== 'pagado' || !p.paidAt || !msInRange(p.paidAt, range)) continue;
    push(ecDate(p.paidAt), `LIQ ${p.week}`, 'terceros', 'bancos', p.net, pro.get(p.proId) ?? p.proId, `Pago semanal al profesional (${p.bank || 'transferencia'})`);
  }
  return out.sort((a, z) => a.date.localeCompare(z.date) || a.entry.localeCompare(z.entry));
}

/** Mayor: debe, haber y saldo por cuenta. La cuenta de profesionales con saldo deudor se muestra en 1010208. */
export function ledgerByAccount(lines: JournalLine[]) {
  const A = SUPERCIAS_ACCOUNTS;
  const m = new Map<AccountKey, { debit: number; credit: number }>();
  for (const l of lines) { const x = m.get(l.account) ?? { debit: 0, credit: 0 }; x.debit = r2(x.debit + l.debit); x.credit = r2(x.credit + l.credit); m.set(l.account, x); }
  return (Object.keys(A) as AccountKey[]).filter((k) => m.has(k)).map((k) => {
    const x = m.get(k)!;
    return { account: k, code: A[k].code, name: A[k].name, aux: A[k].aux, debit: x.debit, credit: x.credit, balance: r2(x.debit - x.credit) };
  });
}

/** Comprobantes que emite HULUL (para el SRI): cargo de plataforma al cliente y comisión al profesional. */
export function hululSales(data: Pick<DashData, 'ledger' | 'bookings' | 'providers'>, range: DateRange) {
  const bookings = new Map(data.bookings.map((b) => [b.id, b]));
  const pros = new Map(data.providers.map((p) => [p.uid, p]));
  const rows = new Map<string, { date: string; to: 'cliente' | 'profesional'; idType: string; id: string; name: string; concept: string; base: number; iva: number }>();
  for (const e of data.ledger) {
    if (!msInRange(e.createdAt, range) || !e.bookingId) continue;
    const b = bookings.get(e.bookingId);
    const isPlatform = e.kind === 'plataforma' || e.kind === 'plataforma_iva';
    const isCommission = ['comision', 'comision_iva', 'adicional_comision', 'adicional_comision_iva'].includes(e.kind);
    if (!isPlatform && !isCommission) continue;
    const p = pros.get(e.proId);
    const key = `${e.bookingId}|${isPlatform ? 'c' : 'p'}`;
    const r = rows.get(key) ?? (isPlatform
      ? { date: ecDate(e.createdAt!), to: 'cliente' as const, idType: 'Consumidor final', id: '9999999999999', name: b?.clientName || 'Consumidor final', concept: `Cargo de plataforma · reserva ${b?.code ?? ''}`, base: 0, iva: 0 }
      : { date: ecDate(e.createdAt!), to: 'profesional' as const, idType: 'RUC', id: p?.ruc ?? '', name: p?.name ?? b?.proName ?? '', concept: `Comisión HULUL · reserva ${b?.code ?? ''}`, base: 0, iva: 0 });
    if (e.kind.endsWith('_iva')) r.iva = r2(r.iva + e.amount); else r.base = r2(r.base + e.amount);
    rows.set(key, r);
  }
  return [...rows.values()].filter((r) => r.base || r.iva).map((r) => ({ ...r, total: r2(r.base + r.iva) })).sort((a, z) => a.date.localeCompare(z.date));
}

/* ------------------------------ Flujo de dinero (periodo) ------------------------------ */

export const PAY_LABEL: Record<string, string> = { tarjeta: 'Tarjeta', efectivo: 'Efectivo', deuna: 'DeUna', transferencia: 'Transferencia' };
const payKey = (m: string) => (PAY_LABEL[m] ? m : 'otro');

/** Lo cobrado al cliente por una reserva ya cerrada (completada o con cargo de cancelación). */
const collectedOf = (b: DashBooking) => (b.status === 'completada' || b.status === 'en_disputa' ? bookingMoney(b).gross : b.status === 'cancelada' ? r2(b.cancelFee) : 0);
/** Lo que sale: la parte del profesional más el crédito que se devuelve al cliente. */
const outOf = (b: DashBooking) => (b.status === 'completada' || b.status === 'en_disputa' || (b.status === 'cancelada' && b.cancelFee > 0) ? Math.max(0, bookingMoney(b).pro) : 0) + r2(b.clientCredit);
const isOpen = (b: DashBooking) => ['programada', 'ejecucion'].includes(stageOf(b));

/** Con tarjeta el dinero entra a la cuenta de HULUL (pasarela); con otros medios lo recibe el profesional. */
export const BANK_METHODS = ['tarjeta'];
const toBank = (b: DashBooking) => BANK_METHODS.includes(b.paymentMethod);

export interface MoneyFlow {
  /** Todo lo cobrado a clientes, por cualquier medio (incluye el dinero de los profesionales). */
  inflow: { total: number; ids: string[] };
  /** Entró a la cuenta de HULUL (debe cuadrar con el banco y la pasarela). */
  bank: { total: number; ids: string[] };
  /** Lo cobró el profesional en mano; de eso HULUL debe recibir su parte (se descuenta el lunes). */
  direct: { total: number; hululShare: number; byMethod: { method: string; label: string; amount: number; ids: string[] }[]; ids: string[] };
  receivable: { total: number; count: number; ids: string[] };
  /** Salida: la parte de los profesionales (todos los medios) y los créditos a clientes. */
  outflow: { total: number; toPros: number; credits: number; ids: string[] };
  net: { total: number; projected: number; ids: string[] };
}

export function moneyFlow(all: DashBooking[], range: DateRange): MoneyFlow {
  const rows = all.filter((b) => inRange(b.date, range));
  const methods = new Map<string, { amount: number; ids: string[] }>();
  let bank = 0, direct = 0, hululShare = 0, toPros = 0, credits = 0, receivable = 0, net = 0, projected = 0;
  const bankIds: string[] = [], directIds: string[] = [], recIds: string[] = [], outIds: string[] = [], fineIds: string[] = [];
  for (const b of rows) {
    const got = collectedOf(b);
    if (got > 0) {
      const m = bookingMoney(b);
      net = r2(net + m.hulul);
      toPros = r2(toPros + Math.max(0, m.pro)); outIds.push(b.id);
      if (toBank(b)) { bank = r2(bank + got); bankIds.push(b.id); }
      else {
        direct = r2(direct + got); hululShare = r2(hululShare + m.hulul); directIds.push(b.id);
        const k = payKey(b.paymentMethod); const x = methods.get(k) ?? { amount: 0, ids: [] }; x.amount = r2(x.amount + got); x.ids.push(b.id); methods.set(k, x);
      }
    }
    // Multa al profesional sin cargo al cliente (no llegó, muy tarde): es ingreso de HULUL, se descuenta de su pago.
    if (b.status === 'cancelada' && got === 0 && b.proFine > 0) { net = r2(net + b.proFine); fineIds.push(b.id); }
    if (b.clientCredit > 0) { credits = r2(credits + b.clientCredit); net = r2(net - b.clientCredit); if (!outIds.includes(b.id)) outIds.push(b.id); }
    if (isOpen(b)) { const m = bookingMoney(b); receivable = r2(receivable + m.gross); projected = r2(projected + m.hulul); recIds.push(b.id); }
  }
  return {
    inflow: { total: r2(bank + direct), ids: [...bankIds, ...directIds] },
    bank: { total: bank, ids: bankIds },
    direct: { total: direct, hululShare, ids: directIds, byMethod: [...methods.entries()].map(([method, v]) => ({ method, label: PAY_LABEL[method] ?? 'Otro', ...v })).sort((a, z) => z.amount - a.amount) },
    receivable: { total: receivable, count: recIds.length, ids: recIds },
    outflow: { total: r2(toPros + credits), toPros, credits, ids: outIds },
    net: { total: net, projected, ids: [...bankIds, ...directIds, ...fineIds] },
  };
}

export type Granularity = 'dia' | 'semana' | 'mes';
export interface FlowPoint { key: string; from: string; to: string; inflow: number; card: number; outflow: number; net: number; projected: number; ids: string[] }

/** Serie para la curva: entradas, salidas y neto ya cerrados, y proyección de lo programado. */
export function cashSeries(all: DashBooking[], range: DateRange, gran: Granularity): FlowPoint[] {
  const keyOf = (d: string) => (gran === 'dia' ? d : gran === 'semana' ? mondayOf(d) : `${d.slice(0, 7)}-01`);
  const next = (k: string) => (gran === 'dia' ? addDays(k, 1) : gran === 'semana' ? addDays(k, 7) : (() => { const [y, m] = k.split('-').map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`; })());
  const rows = all.filter((b) => inRange(b.date, range));
  if (!rows.length && !(range.from > '1900' && range.to < '9000')) return [];
  const dates = rows.map((b) => b.date).sort();
  const start = keyOf(range.from > '1900' ? range.from : dates[0]);
  if (!start) return [];
  const endDate = range.to < '9000' ? range.to : dates[dates.length - 1];
  const pts = new Map<string, FlowPoint>();
  for (let k = start, i = 0; k <= endDate && i < 400; k = next(k), i++) pts.set(k, { key: k, from: k, to: addDays(next(k), -1), inflow: 0, card: 0, outflow: 0, net: 0, projected: 0, ids: [] });
  for (const b of rows) {
    const p = pts.get(keyOf(b.date)); if (!p) continue;
    const got = collectedOf(b);
    if (got > 0 || b.clientCredit > 0) {
      p.inflow = r2(p.inflow + got); p.outflow = r2(p.outflow + outOf(b));
      if (toBank(b)) p.card = r2(p.card + got);
      p.net = r2(p.net + (got > 0 ? bookingMoney(b).hulul : 0) - b.clientCredit); p.ids.push(b.id);
    } else if (b.status === 'cancelada' && b.proFine > 0) {
      p.net = r2(p.net + b.proFine); p.ids.push(b.id);
    }
    if (isOpen(b)) { p.projected = r2(p.projected + bookingMoney(b).gross); p.ids.push(b.id); }
  }
  return [...pts.values()];
}

/** Serie para proveedores: cobrado por sus servicios, parte de HULUL, parte del profesional y lo programado. */
export function providerSeries(all: DashBooking[], range: DateRange, gran: Granularity): FlowPoint[] {
  const base = cashSeries([], range, gran);
  const keyOf = (d: string) => (gran === 'dia' ? d : gran === 'semana' ? mondayOf(d) : `${d.slice(0, 7)}-01`);
  const rows = all.filter((b) => inRange(b.date, range));
  const pts = new Map((base.length ? base : cashSeries(rows, range, gran)).map((p) => [p.key, { ...p, inflow: 0, card: 0, outflow: 0, net: 0, projected: 0, ids: [] as string[] }]));
  for (const b of rows) {
    const p = pts.get(keyOf(b.date)); if (!p) continue;
    const got = collectedOf(b);
    if (got > 0) { const m = bookingMoney(b); p.inflow = r2(p.inflow + got); if (toBank(b)) p.card = r2(p.card + got); p.outflow = r2(p.outflow + m.hulul); p.net = r2(p.net + Math.max(0, m.pro)); p.ids.push(b.id); }
    if (isOpen(b)) { p.projected = r2(p.projected + bookingMoney(b).gross); p.ids.push(b.id); }
  }
  return [...pts.values()];
}

/* ------------------------------ Comprobantes del cliente ------------------------------ */

export interface ClientInvoice {
  bookingId: string; code: string; date: string;
  issuer: 'profesional' | 'hulul'; issuerName: string; issuerRuc: string; concept: string;
  base: number; iva: number; total: number; status: 'por_emitir' | 'anulada';
}

/** Empresa que factura el cargo de plataforma. */
export const HULUL_ISSUER = { name: 'Corporación Coffeeport Cía. Ltda. (HULUL)', ruc: '0993265160001' };
const PLATFORM_FEE = 1.99;
const IVA_RATE = 0.15;

/**
 * Los dos comprobantes que recibe el cliente por cada reserva cobrada:
 * 1) el profesional factura la visita (más recargo y adicional; IVA según su régimen),
 * 2) HULUL factura el cargo de plataforma con IVA.
 * Una cancelación con cargo genera solo el comprobante del profesional (su parte del cargo, sin IVA).
 */
export function bookingInvoices(b: DashBooking, proRuc = ''): ClientInvoice[] {
  const charged = b.status === 'completada' || b.status === 'en_disputa' || b.status === 'por_aprobar';
  const lost = b.claim?.outcome === 'cliente';
  const status: ClientInvoice['status'] = lost ? 'anulada' : 'por_emitir';
  const out: ClientInvoice[] = [];
  if (charged) {
    const extra = b.extra && ['por_cobrar', 'pagado', 'pagado_tarjeta', 'pagado_efectivo'].includes(b.extra.status) ? b.extra.amount : 0;
    const base = r2(b.visit + b.surcharge + extra);
    const iva = b.taxRegime === 'rimpe_popular' ? 0 : r2(base * IVA_RATE);
    out.push({ bookingId: b.id, code: b.code, date: b.date, issuer: 'profesional', issuerName: b.proName, issuerRuc: proRuc, concept: `Visita${b.surcharge ? ' con recargo' : ''}${extra ? ' y cobro adicional' : ''}`, base, iva, total: r2(base + iva), status });
    out.push({ bookingId: b.id, code: b.code, date: b.date, issuer: 'hulul', issuerName: HULUL_ISSUER.name, issuerRuc: HULUL_ISSUER.ruc, concept: 'Cargo de plataforma', base: PLATFORM_FEE, iva: r2(PLATFORM_FEE * IVA_RATE), total: r2(PLATFORM_FEE * (1 + IVA_RATE)), status });
  } else if (b.status === 'cancelada' && b.cancelFee > 0) {
    out.push({ bookingId: b.id, code: b.code, date: b.date, issuer: 'profesional', issuerName: b.proName, issuerRuc: proRuc, concept: b.cancelledBy === 'cliente_ausente' ? 'Visita (cliente ausente)' : 'Cargo por cancelación tardía', base: r2(b.cancelFee), iva: 0, total: r2(b.cancelFee), status });
  }
  return out;
}

/* --------------------------- Gastos de la empresa y nómina --------------------------- */

/**
 * Categorías de gasto con su cuenta Supercias. Deben coincidir con functions/gastos-core.js
 * (check-dashboard lo comprueba). Propuesta para que la contadora valide.
 * Todo se registra DEVENGADO: el gasto va al mes (o meses) que cubre, no al día en que se paga.
 */
export type ExpenseGroup = 'administrativos' | 'plataformas' | 'nomina' | 'subcontratos' | 'marketing' | 'financieros';
export const EXPENSE_GROUPS: { key: ExpenseGroup; label: string; color: string }[] = [
  { key: 'plataformas', label: 'Plataformas y tecnología', color: '#2E7D8C' },
  { key: 'administrativos', label: 'Administrativos', color: '#1B2A4A' },
  { key: 'nomina', label: 'Nómina', color: '#4C6FA8' },
  { key: 'subcontratos', label: 'Subcontratos', color: '#8A9BB8' },
  { key: 'marketing', label: 'Marketing', color: '#C08A3E' },
  { key: 'financieros', label: 'Financieros e impuestos', color: '#6B6560' },
];
export const EXPENSE_CATEGORIES: Record<string, { label: string; code: string; group: ExpenseGroup; payroll?: boolean }> = {
  tecnologia: { label: 'Plataformas y software (nube, tiendas de apps, IA, dominios)', code: '520228', group: 'plataformas' },
  honorarios: { label: 'Honorarios profesionales (contadora, abogado…)', code: '520205', group: 'administrativos' },
  subcontratos: { label: 'Subcontratos y trabajadores autónomos', code: '520206', group: 'subcontratos' },
  marketing: { label: 'Marketing y publicidad', code: '520111', group: 'marketing' },
  arriendo: { label: 'Arriendo de oficina', code: '520209', group: 'administrativos' },
  servicios: { label: 'Luz, agua, internet y teléfono', code: '520218', group: 'administrativos' },
  mantenimiento: { label: 'Mantenimiento y reparaciones', code: '520208', group: 'administrativos' },
  transporte: { label: 'Transporte y movilización', code: '520215', group: 'administrativos' },
  viajes: { label: 'Viajes', code: '520217', group: 'administrativos' },
  combustible: { label: 'Combustible', code: '520212', group: 'administrativos' },
  seguros: { label: 'Seguros', code: '520214', group: 'administrativos' },
  notarios: { label: 'Notarías, registros y marcas (SENADI)', code: '520219', group: 'administrativos' },
  impuestos: { label: 'Impuestos, contribuciones y patentes', code: '520220', group: 'financieros' },
  bancarios: { label: 'Comisiones bancarias y de la pasarela', code: '520302', group: 'financieros' },
  gestion: { label: 'Gastos de gestión (agasajos, atenciones)', code: '520216', group: 'administrativos' },
  otros: { label: 'Otros gastos', code: '520228', group: 'administrativos' },
  nomina_sueldos: { label: 'Nómina: sueldos y horas extra', code: '520201', group: 'nomina', payroll: true },
  nomina_aportes: { label: 'Nómina: aportes patronales y fondos de reserva', code: '520202', group: 'nomina', payroll: true },
  nomina_beneficios: { label: 'Nómina: décimos y vacaciones', code: '520203', group: 'nomina', payroll: true },
};
export const MANUAL_EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORIES).filter((k) => !EXPENSE_CATEGORIES[k].payroll);
export const EXPENSE_PAY_LABEL: Record<string, string> = { tarjeta: 'Tarjeta de crédito', transferencia: 'Transferencia', efectivo: 'Efectivo', debito: 'Débito bancario', cheque: 'Cheque' };

/** ISD sobre consumos en el exterior (2026) y monto anual exento por consumos con tarjeta. */
export const ISD_RATE = 0.05;
export const ISD_EXEMPT_2026 = 5188.26;

/**
 * Lo que hay detrás de HULUL (el «stack»): cada servicio con su categoría y cómo se cobra.
 * El precio no se fija aquí: cada mes se registra lo que llegó en el estado de cuenta.
 */
export type Billing = 'mensual' | 'consumo' | 'anual' | 'unico';
export const PLATFORMS: { key: string; name: string; what: string; billing: Billing; exterior: boolean; categoria: string }[] = [
  { key: 'firebase', name: 'Google Cloud · Firebase', what: 'Base de datos, funciones, archivos, inicio de sesión y mapas', billing: 'consumo', exterior: true, categoria: 'tecnologia' },
  { key: 'vercel', name: 'Vercel', what: 'Hosting de la web hululec.com', billing: 'mensual', exterior: true, categoria: 'tecnologia' },
  { key: 'claude', name: 'Claude (Anthropic) · suscripción', what: 'Desarrollo de la plataforma con Claude', billing: 'mensual', exterior: true, categoria: 'tecnologia' },
  { key: 'claude_api', name: 'Claude API (Anthropic)', what: 'Análisis de reclamos con IA en el panel', billing: 'consumo', exterior: true, categoria: 'tecnologia' },
  { key: 'expo', name: 'Expo · EAS', what: 'Compilación y actualizaciones de la app', billing: 'mensual', exterior: true, categoria: 'tecnologia' },
  { key: 'github', name: 'GitHub', what: 'Código fuente y publicación automática', billing: 'mensual', exterior: true, categoria: 'tecnologia' },
  { key: 'resend', name: 'Resend / correo', what: 'Envío de correos (estados de cuenta, avisos)', billing: 'mensual', exterior: true, categoria: 'tecnologia' },
  { key: 'workspace', name: 'Google Workspace / Gmail', what: 'Correo corporativo', billing: 'mensual', exterior: true, categoria: 'tecnologia' },
  { key: 'google_play', name: 'Google Play Console', what: 'Cuenta de desarrollador Android (pago único)', billing: 'unico', exterior: true, categoria: 'tecnologia' },
  { key: 'apple', name: 'Apple Developer Program', what: 'Cuenta de desarrollador iPhone (anual)', billing: 'anual', exterior: true, categoria: 'tecnologia' },
  { key: 'dominios', name: 'Dominios (hululec.com, hulul.ec…)', what: 'Registro y renovación de dominios', billing: 'anual', exterior: true, categoria: 'tecnologia' },
  { key: 'meta_ads', name: 'Meta Ads (Instagram/Facebook)', what: 'Publicidad pagada', billing: 'consumo', exterior: true, categoria: 'marketing' },
];
export const BILLING_LABEL: Record<Billing, string> = { mensual: 'Mensual', consumo: 'Por consumo (mensual)', anual: 'Anual: se reparte en 12 meses', unico: 'Pago único' };

export interface Expense {
  id: string; fecha: string; categoria: string; proveedor: string; identificacion: string; factura: string; descripcion: string;
  base: number; iva: number; isd: number; total: number; retRenta: number; retIva: number; aPagar: number;
  formaPago: string; estado: 'pagado' | 'por_pagar'; vence: string | null; pagadoEl: string | null; recurrente: boolean; origen?: 'manual' | 'nomina';
  /** Tarjeta (texto libre, p. ej. «Visa Pacífico ••1234»). pagador: de quién es la tarjeta o el dinero. */
  tarjeta: string; pagador: 'empresa' | 'socio'; socio: string;
  exterior: boolean; liquidacion: boolean; plataforma: string;
  /** Devengado: primer mes (AAAA-MM) y número de meses que cubre el gasto. */
  cubreDesde: string; cubreMeses: number;
  creadoPor?: string;
}
/** Pago del estado de cuenta de la tarjeta, o reembolso a un socio que pagó gastos de la empresa. */
export interface CardPayment { id: string; fecha: string; monto: number; tipo?: 'tarjeta' | 'reembolso'; socio?: string; tarjeta: string; referencia: string; creadoPor?: string }
export interface PayrollLine {
  empleadoId: string; nombre: string; cedula: string; cargo: string; dias: number; sueldo: number; proporcional: number; extras: number; bonos: number; ingresos: number;
  aportePersonal: number; anticipos: number; otrosDescuentos: number; decimo13: number; decimo14: number; decimosEnRol: number; fondo: number; fondoEnRol: number; vacaciones: number;
  patronal: number; iece: number; secap: number; neto: number; costo: number; alIess: number;
}
export type PayrollTotals = Pick<PayrollLine, 'ingresos' | 'aportePersonal' | 'anticipos' | 'otrosDescuentos' | 'decimo13' | 'decimo14' | 'decimosEnRol' | 'fondo' | 'fondoEnRol' | 'vacaciones' | 'patronal' | 'iece' | 'secap' | 'neto' | 'costo' | 'alIess'>;
export interface Payroll { mes: string; status: 'borrador' | 'aprobado'; lines: PayrollLine[]; totals: PayrollTotals; aprobadoPor?: string | null; aprobadoEl?: number | null }
export interface Employee {
  id: string; nombre: string; cedula: string; cargo: string; correo: string; cuenta: string; sueldo: number; ingreso: string;
  activo: boolean; decimosMensuales: boolean; fondoMensual: boolean; bajoSbu?: boolean;
}

export const expenseGroupOf = (g: Pick<Expense, 'categoria'>): ExpenseGroup => EXPENSE_CATEGORIES[g.categoria]?.group ?? 'administrativos';
const isOverdue = (g: Expense, today: string) => g.estado === 'por_pagar' && !!g.vence && g.vence < today;
const ymOf = (iso: string) => iso.slice(0, 7);
const addMonthsYm = (m: string, n: number) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7); };
/** Último día del mes AAAA-MM. */
export const monthEnd = (m: string) => addDays(`${addMonthsYm(m, 1)}-01`, -1);
const isCard = (g: Pick<Expense, 'formaPago'>) => g.formaPago === 'tarjeta';

export interface ExpenseSlice { id: string; fecha: string; mes: string; categoria: string; monto: number; isd?: boolean }

/**
 * Partes devengadas de un gasto: la base repartida en los meses que cubre (fecha = fin de cada mes,
 * o la fecha del comprobante si cae en ese mes) y el ISD como impuesto en la fecha del cargo.
 */
export function expenseSlices(g: Expense): ExpenseSlice[] {
  const n = Math.max(1, Number(g.cubreMeses) || 1);
  const from = g.cubreDesde || ymOf(g.fecha);
  const part = r2(g.base / n);
  const out: ExpenseSlice[] = Array.from({ length: n }, (_, i) => {
    const mes = addMonthsYm(from, i);
    return { id: g.id, mes, fecha: mes === ymOf(g.fecha) ? g.fecha : monthEnd(mes), categoria: g.categoria, monto: i === n - 1 ? r2(g.base - part * (n - 1)) : part };
  });
  if (g.isd > 0) out.push({ id: g.id, mes: ymOf(g.fecha), fecha: g.fecha, categoria: 'impuestos', monto: r2(g.isd), isd: true });
  return out;
}
const slicesIn = (gastos: Expense[], range: DateRange) => gastos.flatMap(expenseSlices).filter((s) => inRange(s.fecha, range));

export interface ExpenseSummary {
  total: number; count: number; ivaCredito: number; retenciones: number; isd: number;
  porPagar: { total: number; ids: string[] }; vencidos: { total: number; ids: string[] }; proximos: { total: number; ids: string[] };
  byGroup: (Bucket & { color: string })[]; byCategory: (Bucket & { code: string })[]; byProvider: Bucket[];
  /** Parte de gastos anuales pagados antes y que se devenga en este periodo (o pagada ahora para meses futuros). */
  prepaid: { devengadoAhora: number; diferido: number };
}

/** Resumen DEVENGADO del periodo. Gasto = base sin IVA (el IVA es crédito tributario) + ISD. */
export function expenseSummary(gastos: Expense[], range: DateRange, now: number): ExpenseSummary {
  const today = ecDate(now);
  const soon = addDays(today, 7);
  const slices = slicesIn(gastos, range);
  const byId = new Map(gastos.map((g) => [g.id, g]));
  const groups = new Map<string, Bucket>(); const cats = new Map<string, Bucket>(); const provs = new Map<string, Bucket>();
  for (const s of slices) {
    const g = byId.get(s.id)!;
    const grp = EXPENSE_CATEGORIES[s.categoria]?.group ?? 'administrativos';
    bucket(groups, grp, EXPENSE_GROUPS.find((x) => x.key === grp)!.label, s.id, s.monto);
    bucket(cats, s.categoria, s.isd ? 'ISD (impuesto a la salida de divisas)' : EXPENSE_CATEGORIES[s.categoria]?.label ?? s.categoria, s.id, s.monto);
    bucket(provs, g.proveedor.toLowerCase(), g.proveedor, s.id, s.monto);
  }
  for (const m of [groups, cats, provs]) for (const b of m.values()) b.ids = [...new Set(b.ids)];
  const docs = gastos.filter((g) => inRange(g.fecha, range));
  const open = gastos.filter((g) => g.estado === 'por_pagar');
  const sum = (l: Expense[], k: keyof Expense = 'aPagar') => r2(l.reduce((t, g) => t + Number(g[k] || 0), 0));
  const overdue = open.filter((g) => isOverdue(g, today));
  const next = open.filter((g) => !isOverdue(g, today) && !!g.vence && g.vence <= soon);
  const sorted = (m: Map<string, Bucket>) => [...m.values()].sort((a, z) => (z.value ?? 0) - (a.value ?? 0));
  // Diferido: base de comprobantes del periodo que se devenga fuera de él; devengado ahora: lo inverso.
  const docBase = sum(docs, 'base');
  const ownSlices = r2(slices.filter((s) => !s.isd && docs.some((g) => g.id === s.id)).reduce((t, s) => t + s.monto, 0));
  const fromOther = r2(slices.filter((s) => !s.isd && !docs.some((g) => g.id === s.id)).reduce((t, s) => t + s.monto, 0));
  return {
    total: r2(slices.reduce((t, s) => t + s.monto, 0)), count: new Set(slices.map((s) => s.id)).size,
    ivaCredito: sum(docs, 'iva'), retenciones: r2(sum(docs, 'retRenta') + sum(docs, 'retIva')), isd: sum(docs, 'isd'),
    porPagar: { total: sum(open), ids: open.map((g) => g.id) },
    vencidos: { total: sum(overdue), ids: overdue.map((g) => g.id) },
    proximos: { total: sum(next), ids: next.map((g) => g.id) },
    byGroup: EXPENSE_GROUPS.filter((x) => groups.has(x.key)).map((x) => ({ ...groups.get(x.key)!, color: x.color })),
    byCategory: sorted(cats).map((b) => ({ ...b, code: EXPENSE_CATEGORIES[b.key]?.code ?? '' })),
    byProvider: sorted(provs).slice(0, 10),
    prepaid: { devengadoAhora: fromOther, diferido: r2(docBase - ownSlices) },
  };
}

/** Ingresos propios de HULUL en el periodo (sin IVA): servicios (4102) y otros ordinarios (4109). Créditos a clientes = gasto. */
export function hululIncome(ledger: DashLedger[], range: DateRange) {
  let servicios = 0; let otros = 0; let creditos = 0;
  for (const e of ledger) {
    if (!msInRange(e.createdAt, range)) continue;
    if (e.bucket === 'ingreso_hulul') { if ((INCOME_ACCOUNT[e.kind] ?? 'servicios') === 'servicios') servicios += e.amount; else otros += e.amount; }
    if (e.bucket === 'pasivo_cliente') creditos += e.amount;
  }
  return { servicios: r2(servicios), otros: r2(otros), total: r2(servicios + otros), creditos: r2(creditos) };
}

export interface IncomeStatement {
  ingresos: { servicios: number; otros: number; total: number };
  gastos: { key: string; label: string; value: number; ids: string[] }[];
  totalGastos: number; utilidad: number; margen: number;
}

/** Estado de resultados devengado: ingresos HULUL − gastos (por grupo) = utilidad antes de impuestos. */
export function incomeStatement(ledger: DashLedger[], gastos: Expense[], range: DateRange, now: number): IncomeStatement {
  const inc = hululIncome(ledger, range);
  const s = expenseSummary(gastos, range, now);
  const lines = s.byGroup.map((g) => ({ key: g.key, label: g.label, value: r2(g.value ?? 0), ids: g.ids }));
  if (inc.creditos) lines.push({ key: 'creditos', label: 'Créditos entregados a clientes', value: inc.creditos, ids: [] });
  const totalGastos = r2(lines.reduce((t, l) => t + l.value, 0));
  const utilidad = r2(inc.total - totalGastos);
  return { ingresos: { servicios: inc.servicios, otros: inc.otros, total: inc.total }, gastos: lines, totalGastos, utilidad, margen: pctOf(utilidad, inc.total) };
}

export interface ResultPoint { key: string; from: string; to: string; ingresos: number; gastos: number; utilidad: number; ids: string[] }

/** Serie (por semana o mes) de ingresos HULUL, gastos devengados y utilidad. */
export function resultSeries(ledger: DashLedger[], gastos: Expense[], range: DateRange, gran: Granularity): ResultPoint[] {
  const keyOf = (d: string) => (gran === 'dia' ? d : gran === 'semana' ? mondayOf(d) : `${d.slice(0, 7)}-01`);
  const next = (k: string) => (gran === 'dia' ? addDays(k, 1) : gran === 'semana' ? addDays(k, 7) : `${addMonthsYm(k.slice(0, 7), 1)}-01`);
  const slices = slicesIn(gastos, range);
  const dates = [
    ...slices.map((s) => s.fecha),
    ...ledger.filter((e) => msInRange(e.createdAt, range) && (e.bucket === 'ingreso_hulul' || e.bucket === 'pasivo_cliente')).map((e) => ecDate(e.createdAt!)),
  ].sort();
  const first = range.from > '1900' ? range.from : dates[0];
  const last = range.to < '9000' ? range.to : dates[dates.length - 1];
  if (!first || !last) return [];
  const pts = new Map<string, ResultPoint>();
  for (let k = keyOf(first), i = 0; k <= last && i < 400; k = next(k), i++) pts.set(k, { key: k, from: k, to: addDays(next(k), -1), ingresos: 0, gastos: 0, utilidad: 0, ids: [] });
  for (const e of ledger) {
    if (!msInRange(e.createdAt, range)) continue;
    const p = pts.get(keyOf(ecDate(e.createdAt!))); if (!p) continue;
    if (e.bucket === 'ingreso_hulul') p.ingresos = r2(p.ingresos + e.amount);
    if (e.bucket === 'pasivo_cliente') p.gastos = r2(p.gastos + e.amount);
  }
  for (const s of slices) {
    const p = pts.get(keyOf(s.fecha)); if (!p) continue;
    p.gastos = r2(p.gastos + s.monto); if (!p.ids.includes(s.id)) p.ids.push(s.id);
  }
  for (const p of pts.values()) p.utilidad = r2(p.ingresos - p.gastos);
  return [...pts.values()];
}

/* ------------------------------ Tarjeta de crédito y plataformas ------------------------------ */

export interface CardStatus {
  /** Lo que se debe hoy en tarjetas de la empresa (cargos − pagos). */
  saldo: number; cargos: number; pagos: number; cargosIds: string[];
  /** Cargos pagados con tarjeta o dinero personal de un socio: la empresa se los debe reembolsar. */
  socios: { nombre: string; total: number; ids: string[] }[];
  /** Consumos en el exterior del año (para el umbral exento de ISD) y los que no tienen liquidación de compra. */
  exteriorAnio: number; sinLiquidacion: { total: number; ids: string[] };
}

export function cardStatus(gastos: Expense[], pagos: CardPayment[], now: number): CardStatus {
  const year = ecDate(now).slice(0, 4);
  const card = gastos.filter((g) => isCard(g) && g.pagador !== 'socio');
  const cargos = r2(card.reduce((t, g) => t + g.aPagar, 0));
  const pagado = r2(pagos.filter((p) => p.tipo !== 'reembolso').reduce((t, p) => t + p.monto, 0));
  const soc = new Map<string, { nombre: string; total: number; ids: string[] }>();
  for (const g of gastos.filter((x) => x.pagador === 'socio' && x.estado === 'pagado')) {
    const k = (g.socio || 'Socio').trim();
    const s = soc.get(k) ?? { nombre: k, total: 0, ids: [] }; s.total = r2(s.total + g.aPagar); s.ids.push(g.id); soc.set(k, s);
  }
  for (const p of pagos.filter((x) => x.tipo === 'reembolso')) {
    const k = (p.socio || 'Socio').trim();
    const so = soc.get(k) ?? { nombre: k, total: 0, ids: [] }; so.total = r2(so.total - p.monto); soc.set(k, so);
  }
  const ext = gastos.filter((g) => g.exterior && g.fecha.startsWith(year));
  const noLiq = gastos.filter((g) => g.exterior && !g.liquidacion && g.origen !== 'nomina');
  return {
    saldo: r2(cargos - pagado), cargos, pagos: pagado, cargosIds: card.map((g) => g.id),
    socios: [...soc.values()].filter((x) => Math.abs(x.total) >= 0.01).sort((a, z) => z.total - a.total),
    exteriorAnio: r2(ext.reduce((t, g) => t + g.base + g.iva, 0)),
    sinLiquidacion: { total: r2(noLiq.reduce((t, g) => t + g.total, 0)), ids: noLiq.map((g) => g.id) },
  };
}

export interface PlatformRow {
  key: string; name: string; what: string; billing: Billing;
  months: { mes: string; monto: number; ids: string[] }[];
  /** Mensual o por consumo con cargos antes pero sin registrar en el último mes cerrado o en el actual. */
  missing: string[]; total: number;
}

/** Costo devengado de cada servicio del stack en los últimos meses, y qué meses faltan por registrar. */
export function platformCosts(gastos: Expense[], now: number, months = 6): PlatformRow[] {
  const cur = ecDate(now).slice(0, 7);
  const list = Array.from({ length: months }, (_, i) => addMonthsYm(cur, i - months + 1));
  const keys = new Set([...PLATFORMS.map((p) => p.key), ...gastos.map((g) => g.plataforma).filter(Boolean)]);
  return [...keys].map((key) => {
    const p = PLATFORMS.find((x) => x.key === key) ?? { key, name: key, what: '', billing: 'mensual' as Billing };
    const own = gastos.filter((g) => g.plataforma === key);
    const sl = own.flatMap(expenseSlices);
    const ms = list.map((mes) => { const x = sl.filter((s) => s.mes === mes); return { mes, monto: r2(x.reduce((t, s) => t + s.monto, 0)), ids: [...new Set(x.map((s) => s.id))] }; });
    const firstMonth = sl.map((s) => s.mes).sort()[0];
    const prev = addMonthsYm(cur, -1);
    const missing = (p.billing === 'mensual' || p.billing === 'consumo') && firstMonth
      ? list.filter((mes) => mes >= firstMonth && mes <= prev && !sl.some((s) => s.mes === mes)) : [];
    return { key, name: p.name, what: p.what, billing: p.billing, months: ms, missing, total: r2(ms.reduce((t, m) => t + m.monto, 0)) };
  });
}

/* ------------------------------ Libro diario de gastos y nómina ------------------------------ */

/** Cuentas Supercias que usan los gastos y la nómina (propuesta para validar con la contadora). */
export const EXPENSE_ACCOUNTS = {
  bancos: { code: '10101', name: 'EFECTIVO Y EQUIVALENTES AL EFECTIVO' },
  anticipos: { code: '1010208', name: 'OTRAS CUENTAS POR COBRAR', aux: 'Anticipos a empleados' },
  prepagados: { code: '1010404', name: 'OTROS ANTICIPOS ENTREGADOS', aux: 'Suscripciones y servicios pagados por anticipado' },
  ivaCredito: { code: '1010501', name: 'CRÉDITO TRIBUTARIO A FAVOR DE LA EMPRESA (IVA)' },
  proveedores: { code: '2010301', name: 'CUENTAS Y DOCUMENTOS POR PAGAR - LOCALES', aux: 'Proveedores y gastos devengados por pagar' },
  tarjeta: { code: '2010401', name: 'OBLIGACIONES CON INSTITUCIONES FINANCIERAS - LOCALES', aux: 'Tarjeta de crédito de la empresa' },
  sri: { code: '2010701', name: 'OTRAS OBLIGACIONES CORRIENTES - CON LA ADMINISTRACIÓN TRIBUTARIA' },
  iess: { code: '2010703', name: 'OTRAS OBLIGACIONES CORRIENTES - CON EL IESS' },
  beneficios: { code: '2010704', name: 'OTRAS OBLIGACIONES CORRIENTES - POR BENEFICIOS DE LEY A EMPLEADOS' },
  socios: { code: '20108', name: 'CUENTAS POR PAGAR DIVERSAS - RELACIONADAS', aux: 'Gastos pagados por socios (reembolso)' },
  otrosPasivos: { code: '20113', name: 'OTROS PASIVOS CORRIENTES', aux: 'Descuentos de nómina por pagar' },
} as const;

export interface ExpenseJournalLine { date: string; entry: string; code: string; accountName: string; party: string; detail: string; debit: number; credit: number }

/**
 * Asientos devengados de gastos, tarjeta y nómina.
 * Comprobante (fecha): Dr gasto del mes / Dr pagados por anticipado (meses siguientes) / Dr provisión (meses
 * anteriores ya devengados) + Dr IVA crédito + Dr ISD; Cr tarjeta, socio o proveedor (a pagar) + Cr SRI (retenciones).
 * Cada mes que cubre fuera del mes del comprobante: Dr gasto / Cr pagados por anticipado o provisión.
 * Pago a proveedor: Dr proveedores / Cr bancos. Pago de la tarjeta: Dr tarjeta / Cr bancos.
 * Nómina aprobada: Dr 520201/520202/520203 / Cr IESS, beneficios, anticipos, descuentos y bancos (neto).
 */
export function expenseJournal(gastos: Expense[], payrolls: Payroll[], range: DateRange, pagos: CardPayment[] = []): ExpenseJournalLine[] {
  const A = EXPENSE_ACCOUNTS;
  const out: ExpenseJournalLine[] = [];
  const line = (date: string, entry: string, acc: { code: string; name: string }, party: string, detail: string, debit: number, credit: number) => {
    if (inRange(date, range) && (r2(debit) || r2(credit))) out.push({ date, entry, code: acc.code, accountName: acc.name, party, detail, debit: r2(debit), credit: r2(credit) });
  };
  for (const g of gastos) {
    if (g.origen === 'nomina') continue;
    const cat = EXPENSE_CATEGORIES[g.categoria];
    const gasto = { code: cat?.code ?? '520228', name: cat?.label ?? 'OTROS GASTOS' };
    const entry = g.factura ? `FC ${g.factura}` : `G-${g.id.slice(-6).toUpperCase()}`;
    const detail = `${cat?.label ?? g.categoria}${g.descripcion ? ` · ${g.descripcion}` : ''}`;
    const docMonth = ymOf(g.fecha);
    const card = isCard(g);
    const payable = g.pagador === 'socio' ? A.socios : card ? A.tarjeta : A.proveedores;
    const slices = expenseSlices(g).filter((s) => !s.isd);
    for (const s of slices) {
      const acc = s.mes === docMonth ? gasto : s.mes > docMonth ? A.prepagados : A.proveedores;
      line(g.fecha, entry, acc, g.proveedor, s.mes === docMonth ? detail : `${detail} · corresponde a ${s.mes}`, s.monto, 0);
      if (s.mes !== docMonth) {
        line(s.fecha, `${entry} DEV ${s.mes}`, gasto, g.proveedor, `Devengo de ${s.mes}`, s.monto, 0);
        line(s.fecha, `${entry} DEV ${s.mes}`, s.mes > docMonth ? A.prepagados : A.proveedores, g.proveedor, `Devengo de ${s.mes}`, 0, s.monto);
      }
    }
    line(g.fecha, entry, A.ivaCredito, g.proveedor, g.exterior ? 'IVA de servicios digitales (percibido por la tarjeta)' : 'IVA en compras', g.iva, 0);
    line(g.fecha, entry, { code: EXPENSE_CATEGORIES.impuestos.code, name: 'IMPUESTOS, CONTRIBUCIONES Y OTROS' }, g.proveedor, 'ISD 5 % del consumo en el exterior', g.isd, 0);
    line(g.fecha, entry, payable, g.pagador === 'socio' ? (g.socio || 'Socio') : card ? (g.tarjeta || 'Tarjeta de crédito') : g.proveedor, detail, 0, g.aPagar);
    line(g.fecha, entry, A.sri, g.proveedor, 'Retenciones en la fuente e IVA', 0, r2(g.retRenta + g.retIva));
    if (!card && g.pagador !== 'socio' && g.estado === 'pagado') {
      const paid = g.pagadoEl ?? g.fecha;
      line(paid, `${entry} PAGO`, A.proveedores, g.proveedor, `Pago (${EXPENSE_PAY_LABEL[g.formaPago] ?? g.formaPago})`, g.aPagar, 0);
      line(paid, `${entry} PAGO`, A.bancos, g.proveedor, `Pago (${EXPENSE_PAY_LABEL[g.formaPago] ?? g.formaPago})`, 0, g.aPagar);
    }
  }
  for (const p of pagos) {
    if (p.tipo === 'reembolso') {
      const entry = `REEMB ${p.fecha}${p.referencia ? ` ${p.referencia}` : ''}`;
      line(p.fecha, entry, A.socios, p.socio || 'Socio', 'Reembolso de gastos pagados por el socio', p.monto, 0);
      line(p.fecha, entry, A.bancos, p.socio || 'Socio', 'Reembolso de gastos pagados por el socio', 0, p.monto);
      continue;
    }
    const entry = `TC ${p.fecha}${p.referencia ? ` ${p.referencia}` : ''}`;
    line(p.fecha, entry, A.tarjeta, p.tarjeta || 'Tarjeta de crédito', 'Pago del estado de cuenta de la tarjeta', p.monto, 0);
    line(p.fecha, entry, A.bancos, p.tarjeta || 'Tarjeta de crédito', 'Pago del estado de cuenta de la tarjeta', 0, p.monto);
  }
  for (const p of payrolls) {
    if (p.status !== 'aprobado') continue;
    const date = monthEnd(p.mes);
    const t = p.totals; const entry = `ROL ${p.mes}`; const party = 'Empleados';
    const C = EXPENSE_CATEGORIES;
    line(date, entry, { code: C.nomina_sueldos.code, name: 'SUELDOS, SALARIOS Y DEMÁS REMUNERACIONES' }, party, 'Sueldos, horas extra y bonos', t.ingresos, 0);
    line(date, entry, { code: C.nomina_aportes.code, name: 'APORTES A LA SEGURIDAD SOCIAL (incluido fondo de reserva)' }, party, 'Aporte patronal, IECE, SECAP y fondos de reserva', r2(t.patronal + t.iece + t.secap + t.fondo), 0);
    line(date, entry, { code: C.nomina_beneficios.code, name: 'BENEFICIOS SOCIALES E INDEMNIZACIONES' }, party, 'Décimo tercero, décimo cuarto y vacaciones', r2(t.decimo13 + t.decimo14 + t.vacaciones), 0);
    line(date, entry, A.iess, 'IESS', 'Planilla de aportes y fondos de reserva', 0, t.alIess);
    line(date, entry, A.beneficios, party, 'Décimos y vacaciones provisionados', 0, r2(t.decimo13 + t.decimo14 - t.decimosEnRol + t.vacaciones));
    line(date, entry, A.anticipos, party, 'Anticipos descontados', 0, t.anticipos);
    line(date, entry, A.otrosPasivos, party, 'Otros descuentos', 0, t.otrosDescuentos);
    line(date, entry, A.bancos, party, 'Neto pagado a empleados', 0, t.neto);
  }
  return out.sort((a, z) => a.date.localeCompare(z.date) || a.entry.localeCompare(z.entry));
}

/* ------------------------------ Bandeja de novedades (resumen ejecutivo) ------------------------------ */

/** RUC de la empresa; su noveno dígito fija el día de vencimiento de las declaraciones mensuales del SRI. */
export const COMPANY_RUC = '0993265160001';
const SRI_DUE_DAY: Record<string, number> = { '1': 10, '2': 12, '3': 14, '4': 16, '5': 18, '6': 20, '7': 22, '8': 24, '9': 26, '0': 28 };
export function sriNextDue(now: number, ruc = COMPANY_RUC) {
  const day = SRI_DUE_DAY[ruc[8]] ?? 28;
  const today = ecDate(now);
  const thisDue = `${today.slice(0, 7)}-${String(day).padStart(2, '0')}`;
  const date = today <= thisDue ? thisDue : `${addMonthsYm(today.slice(0, 7), 1)}-${String(day).padStart(2, '0')}`;
  return { date, day, daysLeft: Math.round((Date.parse(date) - Date.parse(today)) / DAY) };
}

export type InboxLevel = 'alta' | 'media' | 'info';
export interface InboxItem {
  /** Estable por tipo de novedad; sig cambia cuando cambia el contenido (para volver a mostrarla). */
  id: string; sig: string; level: InboxLevel; area: string; title: string; detail: string;
  href?: string; ids?: string[];
}
export interface InboxExtras {
  gastos?: { gastos: Expense[]; roles: Payroll[]; pagosTarjeta: CardPayment[] } | null;
  statements?: { week: string; status: string; count: number } | null;
}

/** Lo que hay que revisar hoy, ordenado por urgencia. Solo lo que el rol puede ver. */
export function inboxItems(data: DashData, can: (p: AdminPerm) => boolean, now: number, extra: InboxExtras = {}): InboxItem[] {
  const out: InboxItem[] = [];
  const today = ecDate(now);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const add = (x: InboxItem) => out.push(x);

  if (can('reclamos')) {
    const open = data.claims.filter((c) => c.status !== 'resuelto');
    const late = open.filter((c) => c.resolveDueAt !== null && c.resolveDueAt < now);
    const soon = open.filter((c) => c.resolveDueAt !== null && c.resolveDueAt >= now && c.resolveDueAt - now < DAY);
    if (late.length) add({ id: 'reclamos-vencidos', sig: late.map((c) => c.id).join(','), level: 'alta', area: 'Reclamos', title: `${plural(late.length, 'reclamo pasó', 'reclamos pasaron')} el plazo para decidir`, detail: late.map((c) => c.code || c.kindLabel).slice(0, 4).join(' · '), href: '/admin/reclamos' });
    if (soon.length) add({ id: 'reclamos-24h', sig: soon.map((c) => c.id).join(','), level: 'alta', area: 'Reclamos', title: `${plural(soon.length, 'reclamo vence', 'reclamos vencen')} en menos de 24 horas`, detail: 'Decide antes de que venza el plazo.', href: '/admin/reclamos' });
    const rest = open.length - late.length - soon.length;
    if (rest > 0) add({ id: 'reclamos', sig: String(open.map((c) => c.id).join(',')), level: 'media', area: 'Reclamos', title: `${plural(rest, 'reclamo abierto', 'reclamos abiertos')}`, detail: 'En respuesta o en revisión.', href: '/admin/reclamos' });
  }
  if (can('profesionales')) {
    const pend = data.providers.filter((p) => p.status === 'en_revision');
    if (pend.length) add({ id: 'pros', sig: pend.map((p) => p.uid).join(','), level: 'media', area: 'Profesionales', title: `${plural(pend.length, 'profesional espera', 'profesionales esperan')} aprobación`, detail: pend.slice(0, 3).map((p) => p.name).join(', '), href: '/admin/profesionales' });
  }
  if (can('reservas')) {
    const nowLocal = new Date(now - 5 * 3_600_000).toISOString().slice(11, 16);
    const lateToday = data.bookings.filter((b) => b.date === today && ['pendiente', 'confirmada'].includes(b.status) && !b.arrivedAt && b.slot < nowLocal && b.at !== null && now - b.at > 15 * 60_000);
    if (lateToday.length) add({ id: 'atrasos-hoy', sig: lateToday.map((b) => b.id).join(','), level: 'alta', area: 'Reservas', title: `${plural(lateToday.length, 'visita de hoy no ha empezado', 'visitas de hoy no han empezado')} a su hora`, detail: lateToday.slice(0, 3).map((b) => `${b.slot} ${b.proName}`).join(' · '), ids: lateToday.map((b) => b.id) });
    const unaccepted = data.bookings.filter((b) => b.status === 'pendiente' && b.at !== null && b.at > now && b.at - now < DAY);
    if (unaccepted.length) add({ id: 'sin-aceptar', sig: unaccepted.map((b) => b.id).join(','), level: 'media', area: 'Reservas', title: `${plural(unaccepted.length, 'reserva de las próximas 24 h', 'reservas de las próximas 24 h')} sin aceptar por el profesional`, detail: unaccepted.slice(0, 3).map((b) => `${fmtShort(b.date)} ${b.slot} ${b.proName}`).join(' · '), ids: unaccepted.map((b) => b.id) });
    const bad = data.bookings.filter((b) => b.rating !== null && b.rating <= 2 && b.date >= addDays(today, -7));
    if (bad.length) add({ id: 'malas-notas', sig: bad.map((b) => b.id).join(','), level: 'media', area: 'Calidad', title: `${plural(bad.length, 'calificación baja', 'calificaciones bajas')} (1–2 estrellas) en los últimos 7 días`, detail: bad.slice(0, 3).map((b) => `${b.proName}${b.ratingText ? `: «${b.ratingText.slice(0, 50)}»` : ''}`).join(' · '), ids: bad.map((b) => b.id) });
  }
  if (can('cumplimiento')) {
    const al = complianceAlerts(data, periodRange('ultimos_30', now)).filter((a) => a.level === 'alta');
    if (al.length) add({ id: 'uafe', sig: al.map((a) => a.key).join(','), level: 'alta', area: 'UAFE', title: `${plural(al.length, 'alerta alta', 'alertas altas')} de cumplimiento`, detail: al.slice(0, 2).map((a) => a.title).join(' · '), href: '/admin/cumplimiento' });
  }
  if (can('pagos')) {
    const wm = weekMoney(data, now);
    if (wm.toPayNow.count) add({ id: 'pagos-pros', sig: `${wm.toPayNow.count}-${wm.toPayNow.amount}`, level: 'alta', area: 'Pagos', title: `Transferir ${money(wm.toPayNow.amount)} a ${plural(wm.toPayNow.count, 'profesional', 'profesionales')}`, detail: 'Liquidaciones listas: descarga el archivo para el banco.', href: '/admin/contabilidad?vista=pagar' });
    const st = extra.statements;
    if (st && st.status === 'borrador' && st.count > 0) add({ id: `estados-${st.week}`, sig: st.week, level: 'media', area: 'Pagos', title: `Estados de cuenta de la semana listos para revisar y aprobar`, detail: `${plural(st.count, 'profesional', 'profesionales')} · nadie los recibe hasta que los apruebes.`, href: '/admin/proveedores?estados=1' });
  }
  if (can('contabilidad')) {
    const debt = data.providers.filter((p) => p.cashDebt > 30);
    if (debt.length) add({ id: 'deudas', sig: debt.map((p) => `${p.uid}:${p.cashDebt}`).join(','), level: 'media', area: 'Cobros', title: `${plural(debt.length, 'profesional debe', 'profesionales deben')} más de $30 a HULUL`, detail: debt.slice(0, 3).map((p) => `${p.name} ${money(p.cashDebt)}`).join(' · '), href: '/admin/contabilidad?vista=cobrar' });
    const sri = sriNextDue(now);
    if (sri.daysLeft <= 7) add({ id: `sri-${sri.date}`, sig: sri.date, level: sri.daysLeft <= 2 ? 'alta' : 'media', area: 'SRI', title: sri.daysLeft === 0 ? 'Hoy vence la declaración mensual del SRI' : `La declaración mensual del SRI vence en ${plural(sri.daysLeft, 'día', 'días')}`, detail: `${fmtShort(sri.date)} · IVA y retenciones del mes anterior.`, href: '/admin/sri' });
    const g = extra.gastos;
    if (g) {
      const s = expenseSummary(g.gastos, { from: today, to: today }, now);
      if (s.vencidos.ids.length) add({ id: 'gastos-vencidos', sig: s.vencidos.ids.join(','), level: 'alta', area: 'Gastos', title: `${money(s.vencidos.total)} en facturas de proveedores vencidas`, detail: plural(s.vencidos.ids.length, 'factura', 'facturas'), href: '/admin/gastos?vista=pagar' });
      if (s.proximos.ids.length) add({ id: 'gastos-proximos', sig: s.proximos.ids.join(','), level: 'media', area: 'Gastos', title: `${money(s.proximos.total)} por pagar a proveedores esta semana`, detail: plural(s.proximos.ids.length, 'factura vence', 'facturas vencen') + ' en 7 días.', href: '/admin/gastos?vista=pagar' });
      const prev = addMonthsYm(today.slice(0, 7), -1);
      const cur = today.slice(0, 7);
      for (const mes of [prev, cur]) {
        const r = g.roles.find((x) => x.mes === mes);
        const due = mes === prev || Number(today.slice(8, 10)) >= 25;
        if (due && (!r || r.status !== 'aprobado') && (r || g.roles.length)) add({ id: `rol-${mes}`, sig: r?.status ?? 'none', level: mes === prev ? 'alta' : 'media', area: 'Nómina', title: `Rol de pagos de ${monthNameLong(mes)} ${r ? 'en borrador' : 'sin hacer'}`, detail: 'Apruébalo para pagar sueldos y que entre a la contabilidad.', href: '/admin/gastos?vista=nomina' });
      }
      const pr = g.roles.find((x) => x.mes === prev && x.status === 'aprobado');
      const iessDay = Number(today.slice(8, 10));
      if (pr && iessDay <= 15) add({ id: `iess-${prev}`, sig: prev, level: iessDay >= 10 ? 'alta' : 'media', area: 'Nómina', title: `Pagar la planilla del IESS de ${monthNameLong(prev)}: ${money(pr.totals.alIess)}`, detail: `Vence el 15 de ${monthNameLong(cur).split(' ')[0]}.`, href: '/admin/gastos?vista=nomina' });
      const missing = platformCosts(g.gastos, now).filter((p) => p.missing.length);
      if (missing.length) add({ id: 'plataformas', sig: missing.map((p) => `${p.key}:${p.missing.join('|')}`).join(','), level: 'media', area: 'Plataformas', title: `Falta registrar el cargo de ${missing.slice(0, 3).map((p) => p.name.split(' ·')[0]).join(', ')}${missing.length > 3 ? ' y más' : ''}`, detail: `Meses sin cargo: ${[...new Set(missing.flatMap((p) => p.missing))].map(monthNameLong).join(', ')}. Para el devengado, cada mes debe tener su gasto.`, href: '/admin/gastos?vista=plataformas' });
      const cs = cardStatus(g.gastos, g.pagosTarjeta, now);
      if (cs.sinLiquidacion.ids.length) add({ id: 'liquidaciones', sig: cs.sinLiquidacion.ids.join(','), level: 'media', area: 'SRI', title: `${plural(cs.sinLiquidacion.ids.length, 'cargo del exterior sin liquidación de compra', 'cargos del exterior sin liquidación de compra')}`, detail: `${money(cs.sinLiquidacion.total)}: sin ella no se sustenta el gasto ni el crédito de IVA.`, href: '/admin/gastos?vista=plataformas' });
      if (cs.exteriorAnio > ISD_EXEMPT_2026 * 0.8) add({ id: `isd-${today.slice(0, 4)}`, sig: String(Math.floor(cs.exteriorAnio / 500)), level: 'info', area: 'SRI', title: `Consumos en el exterior del año: ${money(cs.exteriorAnio)}`, detail: `Sobre ${money(ISD_EXEMPT_2026)} al año se paga ISD del 5 %. Revisa el estado de cuenta de la tarjeta.`, href: '/admin/gastos?vista=plataformas' });
      for (const so of cs.socios.filter((x) => x.total > 0)) add({ id: `socio-${so.nombre}`, sig: `${so.total}`, level: 'info', area: 'Socios', title: `La empresa le debe ${money(so.total)} a ${so.nombre}`, detail: 'Gastos pagados con su tarjeta o dinero personal (reembolso pendiente).', href: '/admin/gastos?vista=tarjeta' });
    }
  }
  const rank: Record<InboxLevel, number> = { alta: 0, media: 1, info: 2 };
  return out.sort((a, z) => rank[a.level] - rank[z.level]);
}
const fmtShort = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-EC', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const monthNameLong = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(0, 4)}`;

/* ------------------------------ Carga del estado de cuenta de la tarjeta ------------------------------ */

const PLATFORM_PATTERNS: [string, RegExp][] = [
  ['google_play', /GOOGLE\s*\*?\s*PLAY|PLAY\s*CONSOLE/i],
  ['workspace', /G\s*SUITE|WORKSPACE|GOOGLE\s*\*?\s*GSUITE/i],
  ['dominios', /NAMECHEAP|GODADDY|NIC\.?\s*EC|PORKBUN|SQUARESPACE\s*DOM|GOOGLE\s*\*?\s*DOMAINS|HOSTINGER/i],
  ['firebase', /GOOGLE\s*\*?\s*CLOUD|FIREBASE|CLOUD\s*PLATFORM|GOOGLE\s*\*?\s*GCP|GOOGLE\s*\*?\s*MAPS/i],
  ['vercel', /VERCEL/i],
  ['claude', /CLAUDE/i],
  ['claude_api', /ANTHROPIC/i],
  ['expo', /\bEXPO\b|EXPO\.DEV|\bEAS\b/i],
  ['github', /GITHUB/i],
  ['resend', /RESEND/i],
  ['apple', /APPLE\.COM|APPLE\s*DEVELOPER|APPLE\s*DEV/i],
  ['meta_ads', /FACEBK|FACEBOOK|META\s*ADS|META\s*PLATFORMS/i],
];
/** Reconoce la plataforma del stack por el texto del comercio en el estado de cuenta. */
export const matchPlatform = (desc: string) => PLATFORM_PATTERNS.find(([, re]) => re.test(desc))?.[0] ?? '';

export interface StatementMove { n: number; fecha: string; descripcion: string; monto: number; tipo: string; relacionado: number | null; exterior: boolean }
export interface StatementDraft {
  key: string; include: boolean; dup: boolean; nota: string; fecha: string; descripcion: string;
  plataforma: string; categoria: string; proveedor: string; base: number; iva: number; isd: number; exterior: boolean; cubreDesde: string; cubreMeses: number;
}

/**
 * Convierte los movimientos leídos en borradores de gasto: junta a cada consumo su IVA de servicios
 * digitales y su ISD, reconoce la plataforma y su devengado, y marca lo ya registrado.
 */
export function statementDrafts(moves: StatementMove[], existing: Expense[]): StatementDraft[] {
  const consumos = moves.filter((m) => m.tipo === 'consumo');
  const extra = new Map<number, { iva: number; isd: number }>();
  for (const m of moves.filter((x) => x.tipo === 'iva' || x.tipo === 'isd')) {
    // Si la IA no lo relacionó, se asigna al consumo del exterior del mismo día (o el más cercano antes).
    const target = m.relacionado ?? consumos.filter((c) => c.exterior && c.fecha <= m.fecha).sort((a, z) => z.fecha.localeCompare(a.fecha))[0]?.n;
    if (target === undefined) continue;
    const e = extra.get(target) ?? { iva: 0, isd: 0 };
    if (m.tipo === 'iva') e.iva = r2(e.iva + m.monto); else e.isd = r2(e.isd + m.monto);
    extra.set(target, e);
  }
  return moves.filter((m) => ['consumo', 'interes', 'comision', 'otro'].includes(m.tipo) && m.monto > 0).map((m) => {
    const plat = m.tipo === 'consumo' ? matchPlatform(m.descripcion) : '';
    const p = PLATFORMS.find((x) => x.key === plat);
    const e = extra.get(m.n) ?? { iva: 0, isd: 0 };
    const mes = m.fecha.slice(0, 7);
    const consumo = p?.billing === 'consumo';
    const base = r2(m.monto);
    const dup = existing.some((g) => g.fecha === m.fecha && Math.abs(g.base - base) < 0.01);
    const categoria = p?.categoria ?? (m.tipo === 'interes' || m.tipo === 'comision' ? 'bancarios' : 'otros');
    let nota = '';
    if (dup) nota = 'Ya está registrado';
    else if (m.tipo === 'interes' || m.tipo === 'comision') nota = 'Cargo del banco: inclúyelo solo si lo asume la empresa';
    else if (!p) nota = 'Elige la categoría';
    // IVA de servicios digitales no puede pasar del 15 % de la base.
    const iva = Math.min(e.iva, r2(base * 0.15));
    return {
      key: `${m.n}`, include: !dup && m.tipo === 'consumo', dup, nota, fecha: m.fecha, descripcion: m.descripcion,
      plataforma: plat, categoria, proveedor: p?.name ?? m.descripcion, base, iva, isd: Math.min(e.isd, r2((base + iva) * 0.05)),
      exterior: m.exterior || !!p?.exterior, cubreDesde: consumo ? addMonthsYm(mes, -1) : mes, cubreMeses: p?.billing === 'anual' ? 12 : 1,
    };
  });
}
