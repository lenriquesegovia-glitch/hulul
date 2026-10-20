/**
 * Dinero de HULUL: precio, impuestos, libro de movimientos y liquidación semanal.
 *
 * Modelo decidido por Luis el 20-oct-2026 (HULUL como "mercado en línea"):
 * - El profesional factura la visita al cliente (IVA solo si su régimen lo cobra).
 * - HULUL factura al cliente el cargo de plataforma y al profesional su comisión.
 * - Lo que el cliente paga con tarjeta por la visita es del profesional
 *   (valores por cuenta de terceros): HULUL lo retiene durante la ventana de
 *   reclamos y se lo paga cada lunes, menos comisión, retenciones, multas y
 *   deuda de cobros en efectivo.
 *
 * Funciones puras (sin Firestore) para poder probarlas: functions/money.test.js.
 * Misma fórmula de precio que packages/shared/src/pricing.ts y tax.ts.
 */

export const IVA_RATE = 0.15;
export const COMMISSION = 0.15;
export const PLATFORM_FEE = 1.99;
/** Parte de los cargos al cliente (cancelación tardía, cliente ausente) que va al profesional. */
export const PRO_SHARE_OF_CLIENT_FEES = 0.8;
/** Horas que se retiene lo cobrado antes de poder pagarlo (ventana de reclamos). */
export const PAYOUT_HOLD_HOURS = 48;

/**
 * Retenciones que HULUL practica al profesional (fracción de la base y del IVA).
 * POR DEFINIR CON EL CONTADOR: mientras tanto, 0. Igual que packages/shared/src/tax.ts.
 */
export const RETENTIONS = {
  general: { renta: 0, iva: 0 },
  rimpe_emprendedor: { renta: 0, iva: 0 },
  rimpe_popular: { renta: 0, iva: 0 },
};

export const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const TAX_REGIMES = ['general', 'rimpe_emprendedor', 'rimpe_popular'];

/** Régimen válido o "general" (cobra IVA) si no lo indicó. */
export const regimeOf = (v) => (TAX_REGIMES.includes(v) ? v : 'general');
/** RIMPE negocio popular no cobra IVA en su factura. */
export const chargesVat = (regime) => regimeOf(regime) !== 'rimpe_popular';

const invoiceLine = (base, vat) => {
  const b = r2(base);
  const iva = vat ? r2(b * IVA_RATE) : 0;
  return { base: b, iva, total: r2(b + iva) };
};

/** Precio de una visita y sus tres facturas. */
export function priceOf(visitRate, surchargeAmount, regime) {
  const subtotal = r2(r2(visitRate) + r2(Math.max(0, Number(surchargeAmount) || 0)));
  const proInvoice = invoiceLine(subtotal, chargesVat(regime));
  const platformInvoice = invoiceLine(PLATFORM_FEE, true);
  const commission = invoiceLine(subtotal * COMMISSION, true);
  return {
    subtotal, fee: PLATFORM_FEE, proInvoice, platformInvoice, commission,
    iva: r2(proInvoice.iva + platformInvoice.iva),
    total: r2(proInvoice.total + platformInvoice.total),
  };
}

/** Cobro adicional: lo factura el profesional (IVA según su régimen); comisión + IVA para HULUL. */
export function extraOf(amount, regime) {
  const inv = invoiceLine(amount, chargesVat(regime));
  const com = invoiceLine(inv.base * COMMISSION, true);
  return { amount: inv.base, iva: inv.iva, total: inv.total, commission: com.base, commissionIva: com.iva };
}

/* --------------------------- Libro de movimientos --------------------------- */

/**
 * Cada movimiento:
 * - kind: qué es (visita, comision, multa…).
 * - bucket: a qué "bolsa" pertenece en la contabilidad:
 *     recaudo         dinero que entró por la pasarela (para cuadrar con Kushki)
 *     terceros        dinero del profesional que HULUL tiene por cuenta de él
 *     ingreso_hulul   ingreso propio de HULUL (lo único que HULUL declara como venta)
 *     iva_por_pagar   IVA de las facturas de HULUL
 *     pasivo_cliente  créditos a favor del cliente
 * - amount: monto positivo del concepto.
 * - base / iva: desglose cuando es una factura.
 * - proDelta: cómo cambia lo que HULUL le debe al profesional
 *   (+ HULUL le debe más; − el profesional debe o se le descuenta).
 * - hold: true si se retiene hasta que pase la ventana de reclamos.
 */
const TERMINAL_CARD = ['tarjeta'];

const entry = (kind, bucket, amount, proDelta, extra = {}) => ({ kind, bucket, amount: r2(amount), proDelta: r2(proDelta), ...extra });

/**
 * Movimientos que DEBEN existir para una reserva en su estado actual.
 * null = no tocar lo que ya hay (por ejemplo, mientras está en disputa).
 * El servidor compara esto con lo ya registrado y agrega o revierte la
 * diferencia, así que se puede llamar cuantas veces sea.
 */
export function ledgerEntriesFor(b) {
  if (!b || b.demo) return [];
  if (b.status === 'en_disputa') return null;
  const out = [];
  const card = TERMINAL_CARD.includes(b.paymentMethod);

  if (b.status === 'completada') {
    const regime = regimeOf(b.taxRegime);
    const visit = Number(b.visit ?? b.subtotal ?? 0);
    const q = priceOf(visit, Number(b.surcharge ?? 0), regime);
    if (card) out.push(entry('recaudo_visita', 'recaudo', q.total, 0, { memo: 'Cobrado al cliente con tarjeta (visita + cargo de plataforma).' }));
    out.push(entry('visita', 'terceros', q.proInvoice.total, card ? q.proInvoice.total : 0,
      { base: q.proInvoice.base, iva: q.proInvoice.iva, hold: card, memo: card ? 'Factura del profesional al cliente. Dinero del profesional retenido por HULUL.' : 'Factura del profesional al cliente. Cobrada por él directamente.' }));
    out.push(entry('plataforma', 'ingreso_hulul', q.platformInvoice.base, card ? 0 : -q.platformInvoice.base, { memo: card ? 'Cargo de plataforma (factura de HULUL al cliente).' : 'Cargo de plataforma: lo cobró el profesional, lo debe a HULUL.' }));
    out.push(entry('plataforma_iva', 'iva_por_pagar', q.platformInvoice.iva, card ? 0 : -q.platformInvoice.iva));
    out.push(entry('comision', 'ingreso_hulul', q.commission.base, -q.commission.base, { memo: 'Comisión de HULUL (factura al profesional).' }));
    out.push(entry('comision_iva', 'iva_por_pagar', q.commission.iva, -q.commission.iva));

    const ex = b.extra;
    if (ex && ['por_cobrar', 'pagado', 'pagado_tarjeta', 'pagado_efectivo'].includes(ex.status)) {
      const exCard = ex.method === 'tarjeta';
      const x = extraOf(Number(ex.amount ?? 0), regime);
      if (exCard) out.push(entry('recaudo_adicional', 'recaudo', x.total, 0));
      out.push(entry('adicional', 'terceros', x.total, exCard ? x.total : 0, { base: x.amount, iva: x.iva, hold: exCard, memo: 'Cobro adicional facturado por el profesional.' }));
      out.push(entry('adicional_comision', 'ingreso_hulul', x.commission, -x.commission));
      out.push(entry('adicional_comision_iva', 'iva_por_pagar', x.commissionIva, -x.commissionIva));
    }
  }

  if (b.status === 'cancelada') {
    // Cargo al cliente (cancelación tardía o cliente ausente): 80 % profesional, 20 % HULUL.
    // Tratamiento tributario por confirmar con el contador.
    const fee = r2(Number(b.cancelFee ?? 0));
    if (fee > 0) {
      const pro = r2(fee * PRO_SHARE_OF_CLIENT_FEES);
      out.push(entry('cargo_cancelacion', 'terceros', pro, pro, { base: pro, iva: 0, hold: true, memo: b.cancelledBy === 'cliente_ausente' ? 'Cliente ausente: parte del profesional.' : 'Cancelación tardía: parte del profesional.' }));
      out.push(entry('cargo_cancelacion_hulul', 'ingreso_hulul', r2(fee - pro), 0));
    }
    const fine = r2(Number(b.proFine ?? 0));
    if (fine > 0) out.push(entry('multa', 'ingreso_hulul', fine, -fine, { memo: `Multa al profesional (${b.proFault ?? 'falta'}).` }));
    const credit = r2(Number(b.clientCredit ?? 0));
    if (credit > 0) out.push(entry('credito_cliente', 'pasivo_cliente', credit, 0, { memo: 'Crédito al cliente por falta del profesional.' }));
  }
  return out.filter((e) => e.amount !== 0 || e.proDelta !== 0);
}

/**
 * Diferencia entre lo que debe existir y lo ya registrado (solo movimientos
 * vigentes: sin revertir y que no son reversos). Devuelve los movimientos a
 * crear y los ids a revertir. Un movimiento ya liquidado (payoutId) que deja de
 * corresponder se revierte igual: el reverso entra en la próxima liquidación.
 */
export function ledgerDiff(desired, existing) {
  if (desired === null) return { create: [], reverse: [] };
  const live = existing.filter((e) => !e.reversedBy && !e.reverses);
  const key = (e) => `${e.kind}|${r2(e.amount)}|${r2(e.proDelta)}`;
  const pool = new Map();
  for (const e of live) pool.set(key(e), [...(pool.get(key(e)) ?? []), e]);
  const create = [];
  for (const d of desired) {
    const list = pool.get(key(d));
    if (list?.length) list.shift(); else create.push(d);
  }
  const reverse = [...pool.values()].flat();
  return { create, reverse };
}

/** Movimiento que anula otro. */
export const reversalOf = (e, id) => ({
  kind: e.kind, bucket: e.bucket, amount: -r2(e.amount), proDelta: -r2(e.proDelta),
  ...(e.base !== undefined ? { base: -r2(e.base) } : {}), ...(e.iva !== undefined ? { iva: -r2(e.iva) } : {}),
  reverses: id, memo: `Reverso de ${e.kind}.`,
});

/* --------------------------- Liquidación semanal --------------------------- */

/**
 * Liquidación de un profesional con sus movimientos pendientes y disponibles.
 * Retenciones: sobre la base y el IVA de lo que HULUL le paga por cuenta de
 * él (bolsa "terceros"), con los porcentajes de RETENTIONS.
 */
export function weeklyPayout(entries, regime) {
  const rates = RETENTIONS[regimeOf(regime)];
  let gross = 0, deductions = 0, base = 0, iva = 0;
  const byKind = {};
  for (const e of entries) {
    const d = r2(e.proDelta);
    if (d > 0) gross = r2(gross + d); else deductions = r2(deductions - d);
    byKind[e.kind] = r2((byKind[e.kind] ?? 0) + d);
    if (e.bucket === 'terceros' && d !== 0) { base = r2(base + Number(e.base ?? 0)); iva = r2(iva + Number(e.iva ?? 0)); }
  }
  const retentions = { renta: r2(Math.max(0, base) * rates.renta), iva: r2(Math.max(0, iva) * rates.iva) };
  const net = r2(gross - deductions - retentions.renta - retentions.iva);
  return { gross, deductions, retentions, net, byKind, entryCount: entries.length };
}

/** Lunes (fecha en Ecuador, AAAA-MM-DD) de la semana que se liquida. */
export function payoutWeek(nowMs = Date.now()) {
  const ec = new Date(nowMs - 5 * 3_600_000);
  return ec.toISOString().slice(0, 10);
}
