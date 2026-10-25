/**
 * Estado de cuenta del profesional.
 *
 * Se arma con lo que el profesional ya puede leer (reglas de Firestore):
 * - `ledger` (libro de movimientos, functions/money.js → ledgerEntriesFor): cada
 *   visita, comisión, multa, cargo, retención y reverso, con `proDelta`
 *   (+ HULUL le debe más; − se le descuenta) y `payoutId` (null = aún no liquidado).
 * - `payouts`: liquidaciones semanales (lunes 06:00).
 * - `providers/{uid}`: faltas (strikeLog), multas acumuladas y suspensión.
 *
 * No recalcula importes: solo agrupa lo registrado por el servidor.
 */

export interface LedgerRow {
  id: string;
  kind: string;
  bucket?: string;
  amount: number;
  proDelta: number;
  bookingId?: string | null;
  payoutId?: string | null;
  availableAt?: number;
  createdAtMs?: number;
  memo?: string;
  reverses?: string;
  paymentMethod?: string | null;
}

export interface PayoutRow {
  id: string;
  week: string;
  status: string;
  gross: number;
  deductions: number;
  retentions?: { renta?: number; iva?: number };
  net: number;
  paidAtMs?: number;
}

/** Cómo lo ve el profesional. `group`: earn = ingreso; fee = comisión; owe = cobrado en efectivo que es de HULUL; fine = multa; ret = retención. */
export const LEDGER_KINDS: Record<string, { label: string; group: 'earn' | 'fee' | 'owe' | 'fine' | 'ret' }> = {
  visita: { label: 'Servicio', group: 'earn' },
  adicional: { label: 'Cobro adicional', group: 'earn' },
  cargo_cancelacion: { label: 'Cargo por cancelación o cliente ausente (tu parte)', group: 'earn' },
  comision: { label: 'Comisión HULUL', group: 'fee' },
  comision_iva: { label: 'IVA de la comisión', group: 'fee' },
  adicional_comision: { label: 'Comisión del cobro adicional', group: 'fee' },
  adicional_comision_iva: { label: 'IVA de la comisión del adicional', group: 'fee' },
  plataforma: { label: 'Cargo de plataforma cobrado en efectivo', group: 'owe' },
  plataforma_iva: { label: 'IVA del cargo de plataforma cobrado en efectivo', group: 'owe' },
  multa: { label: 'Multa por falta', group: 'fine' },
  retencion_renta: { label: 'Retención de renta', group: 'ret' },
  retencion_iva: { label: 'Retención de IVA', group: 'ret' },
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** ¿Este movimiento le interesa al profesional? (los internos de HULUL, sin efecto para él, se ocultan) */
export function visibleToPro(e: LedgerRow): boolean {
  const k = LEDGER_KINDS[e.kind];
  if (!k) return false;
  if (k.group === 'owe') return Number(e.proDelta) !== 0; // con tarjeta lo cobra HULUL: no le afecta
  return true;
}

export interface Statement {
  /** Lo que facturó o le corresponde por servicios, adicionales y cargos (antes de descuentos). */
  earned: number;
  /** Comisión de HULUL con su IVA. */
  commission: number;
  /** Multas por faltas. */
  fines: number;
  /** Retenciones aplicadas en liquidaciones. */
  retentions: number;
  /** Ganado − comisión − multas − retenciones. */
  net: number;
  /** Cargos de plataforma que cobró en efectivo y son de HULUL (se descuentan de su saldo). */
  cashOwed: number;
  /** Servicios con pago en efectivo: el dinero ya lo tiene él. */
  cashCollected: number;
  /** Movimientos del periodo, del más reciente al más antiguo. */
  rows: LedgerRow[];
}

/** Resumen de un periodo [fromMs, toMs]. Los reversos restan en su grupo. */
export function statementFor(all: LedgerRow[], fromMs: number, toMs: number): Statement {
  const rows = all
    .filter(visibleToPro)
    .filter((e) => (e.createdAtMs ?? 0) >= fromMs && (e.createdAtMs ?? 0) <= toMs)
    .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
  const sum = (g: string) => r2(rows.filter((e) => LEDGER_KINDS[e.kind].group === g).reduce((t, e) => t + Number(e.amount || 0), 0));
  const earned = sum('earn');
  const commission = sum('fee');
  const fines = sum('fine');
  const retentions = sum('ret');
  const cashOwed = r2(rows.filter((e) => LEDGER_KINDS[e.kind].group === 'owe').reduce((t, e) => t - Number(e.proDelta || 0), 0));
  const cashCollected = r2(rows.filter((e) => LEDGER_KINDS[e.kind].group === 'earn' && Number(e.proDelta) === 0).reduce((t, e) => t + Number(e.amount || 0), 0));
  return { earned, commission, fines, retentions, net: r2(earned - commission - fines - retentions), cashOwed, cashCollected, rows };
}

/** Saldo aún no liquidado: disponible para el próximo lunes y retenido por la ventana de reclamos. */
export function pendingBalance(all: LedgerRow[], nowMs: number): { available: number; held: number; total: number } {
  let available = 0, held = 0;
  for (const e of all) {
    if (e.payoutId) continue;
    const d = Number(e.proDelta || 0);
    if ((e.availableAt ?? 0) > nowMs) held += d; else available += d;
  }
  return { available: r2(available), held: r2(held), total: r2(available + held) };
}

/** Efecto de un movimiento para mostrarlo: signo según si suma o resta para el profesional. */
export function rowEffect(e: LedgerRow): { sign: '+' | '−'; amount: number } {
  const g = LEDGER_KINDS[e.kind]?.group;
  const amt = Number(e.amount || 0);
  const positive = g === 'earn' ? amt >= 0 : amt < 0; // un reverso de comisión o multa te devuelve dinero
  return { sign: positive ? '+' : '−', amount: r2(Math.abs(g === 'owe' ? Number(e.proDelta || 0) : amt)) };
}

/** Faltas en la ventana de suspensión (3 en 30 días suspenden 7 días; ver functions/index.js). */
export const STRIKE_LIMIT = 3;
export const STRIKE_WINDOW_DAYS = 30;
export function recentStrikes(strikeLog: number[] | undefined, nowMs: number, resetAt = 0): number {
  const since = Math.max(nowMs - STRIKE_WINDOW_DAYS * 86_400_000, Number(resetAt || 0));
  return (strikeLog ?? []).filter((t) => Number(t) > since).length;
}

/** Inicio del mes actual en Ecuador (UTC-5), en milisegundos. */
export function monthStartEc(nowMs: number): number {
  const ec = new Date(nowMs - 5 * 3_600_000);
  return Date.UTC(ec.getUTCFullYear(), ec.getUTCMonth(), 1, 5, 0);
}
