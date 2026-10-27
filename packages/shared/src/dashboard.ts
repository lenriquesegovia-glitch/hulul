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
  dueno: { label: 'Dueño', help: 'Todo el panel y el equipo (dar y quitar accesos).' },
  socio: { label: 'Socio', help: 'Todo el panel: decide reclamos, aprueba profesionales y marca pagos. No gestiona el equipo.' },
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
      case 'recaudo': push(date, entry, 'bancos', 'cxcClientes', e.amount, b?.clientName || 'Cliente', label); break;
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

export interface MoneyFlow {
  inflow: { total: number; byMethod: { method: string; label: string; amount: number; ids: string[] }[]; ids: string[] };
  receivable: { total: number; count: number; ids: string[] };
  outflow: { total: number; toPros: number; credits: number; ids: string[] };
  net: { total: number; projected: number };
}

/** Entra (todos los medios), por cobrar (proyección), sale (profesionales y créditos) y lo que queda para HULUL. */
export function moneyFlow(all: DashBooking[], range: DateRange): MoneyFlow {
  const rows = all.filter((b) => inRange(b.date, range));
  const methods = new Map<string, { amount: number; ids: string[] }>();
  let inflow = 0, toPros = 0, credits = 0, receivable = 0, net = 0, projected = 0;
  const inIds: string[] = [], recIds: string[] = [], outIds: string[] = [];
  for (const b of rows) {
    const got = collectedOf(b);
    if (got > 0) {
      inflow = r2(inflow + got); inIds.push(b.id);
      const k = payKey(b.paymentMethod); const m = methods.get(k) ?? { amount: 0, ids: [] }; m.amount = r2(m.amount + got); m.ids.push(b.id); methods.set(k, m);
      const pro = Math.max(0, bookingMoney(b).pro);
      toPros = r2(toPros + pro); net = r2(net + bookingMoney(b).hulul);
    }
    if (b.clientCredit > 0) { credits = r2(credits + b.clientCredit); net = r2(net - b.clientCredit); }
    if (got > 0 || b.clientCredit > 0) outIds.push(b.id);
    if (isOpen(b)) { const m = bookingMoney(b); receivable = r2(receivable + m.gross); projected = r2(projected + m.hulul); recIds.push(b.id); }
  }
  return {
    inflow: { total: inflow, ids: inIds, byMethod: [...methods.entries()].map(([method, v]) => ({ method, label: PAY_LABEL[method] ?? 'Otro', ...v })).sort((a, z) => z.amount - a.amount) },
    receivable: { total: receivable, count: recIds.length, ids: recIds },
    outflow: { total: r2(toPros + credits), toPros, credits, ids: outIds },
    net: { total: net, projected },
  };
}

export type Granularity = 'dia' | 'semana' | 'mes';
export interface FlowPoint { key: string; from: string; to: string; inflow: number; outflow: number; net: number; projected: number; ids: string[] }

/** Serie para la curva: entradas, salidas y neto ya cerrados, y proyección de lo programado. */
export function cashSeries(all: DashBooking[], range: DateRange, gran: Granularity): FlowPoint[] {
  const keyOf = (d: string) => (gran === 'dia' ? d : gran === 'semana' ? mondayOf(d) : `${d.slice(0, 7)}-01`);
  const next = (k: string) => (gran === 'dia' ? addDays(k, 1) : gran === 'semana' ? addDays(k, 7) : (() => { const [y, m] = k.split('-').map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`; })());
  const rows = all.filter((b) => inRange(b.date, range));
  if (!rows.length) return [];
  const dates = rows.map((b) => b.date).sort();
  const start = keyOf(range.from > '1900' ? range.from : dates[0]);
  const endDate = range.to < '9000' ? range.to : dates[dates.length - 1];
  const pts = new Map<string, FlowPoint>();
  for (let k = start, i = 0; k <= endDate && i < 400; k = next(k), i++) pts.set(k, { key: k, from: k, to: addDays(next(k), -1), inflow: 0, outflow: 0, net: 0, projected: 0, ids: [] });
  for (const b of rows) {
    const p = pts.get(keyOf(b.date)); if (!p) continue;
    const got = collectedOf(b);
    if (got > 0 || b.clientCredit > 0) {
      p.inflow = r2(p.inflow + got); p.outflow = r2(p.outflow + outOf(b));
      p.net = r2(p.net + (got > 0 ? bookingMoney(b).hulul : 0) - b.clientCredit); p.ids.push(b.id);
    }
    if (isOpen(b)) { p.projected = r2(p.projected + bookingMoney(b).gross); p.ids.push(b.id); }
  }
  return [...pts.values()];
}
