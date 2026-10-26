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
  bookings: DashBooking[];
  ledger: DashLedger[];
  payouts: DashPayout[];
  providers: DashProvider[];
  clients: DashClient[];
  claims: DashClaim[];
}

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
