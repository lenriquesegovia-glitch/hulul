/**
 * Tablero de administración (hululec.com/admin): convierte los documentos de
 * Firestore en filas planas para el panel, sin datos de contacto completos.
 * Los cálculos (etapas, éxito, atrasos, contabilidad) están en
 * packages/shared/src/dashboard.ts, para poder filtrar por fechas en el navegador.
 * Funciones puras: pruebas en tablero-core.test.js.
 */
import { maskContact } from './reclamos-core.js';

export const DASH_PAST_DAYS = 180;
export const DASH_FUTURE_DAYS = 90;
export const DASH_MAX_DAYS = 400;
const DAY = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const ms = (t) => (t?.toMillis?.() ?? (typeof t === 'number' && Number.isFinite(t) ? t : null));
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const str = (v, max = 120) => String(v ?? '').trim().slice(0, max);

/** Fecha de Ecuador (AAAA-MM-DD) de un instante. */
export const ecDay = (t) => new Date(t - 5 * 3_600_000).toISOString().slice(0, 10);

/** Rango de fechas pedido por el panel; por defecto 180 días atrás y 90 adelante. */
export function dashRange(input, now = Date.now()) {
  let from = ISO_DAY.test(input?.desde) ? input.desde : ecDay(now - DASH_PAST_DAYS * DAY);
  let to = ISO_DAY.test(input?.hasta) ? input.hasta : ecDay(now + DASH_FUTURE_DAYS * DAY);
  if (from > to) [from, to] = [to, from];
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY;
  if (span > DASH_MAX_DAYS) from = ecDay(Date.parse(`${to}T12:00:00Z`) - DASH_MAX_DAYS * DAY);
  return { from, to };
}

/** Hora de la cita en milisegundos (Ecuador, UTC-5). */
export function appointmentAt(date, slot) {
  const [y, m, d] = String(date ?? '').split('-').map(Number);
  const [h, min] = String(slot ?? '').split(':').map(Number);
  if (![y, m, d].every(Number.isFinite)) return null;
  return Date.UTC(y, m - 1, d, (Number.isFinite(h) ? h : 0) + 5, Number.isFinite(min) ? min : 0);
}

/** Reserva → fila del tablero. claim = reclamos/{id} si existe. */
export function bookingRow(id, b, claim = null, review = null) {
  const extra = b.extra && typeof b.extra === 'object'
    ? { amount: num(b.extra.amount), status: str(b.extra.status, 30), method: str(b.extra.method, 20) }
    : null;
  const delay = b.delay && typeof b.delay === 'object' ? { minutes: num(b.delay.minutes), status: str(b.delay.status, 20) } : null;
  return {
    id,
    code: id.slice(-6).toUpperCase(),
    date: str(b.date, 10),
    slot: str(b.slot, 5),
    at: appointmentAt(b.date, b.slot),
    createdAt: ms(b.createdAt),
    acceptedAt: ms(b.acceptedAt),
    enRouteAt: ms(b.enRouteAt),
    category: str(b.category, 40),
    status: str(b.status, 20),
    demo: !!b.demo,
    source: str(b.source, 10),
    clientId: str(b.clientId, 60),
    clientName: str(b.contactName, 80),
    clientPhone: maskContact(b.contactPhone),
    proId: str(b.professionalId, 60),
    proName: str(b.professionalName, 80),
    paymentMethod: str(b.paymentMethod, 20),
    visit: num(b.visit ?? b.subtotal),
    surcharge: num(b.surcharge),
    surchargeKind: str(b.surchargeKind, 10),
    fee: num(b.fee),
    iva: num(b.iva),
    total: num(b.total),
    taxRegime: str(b.taxRegime, 30),
    extra,
    arrivedAt: ms(b.arrivedAt),
    startedAt: ms(b.startedAt),
    finishedAt: ms(b.finishedAt ?? b.completedAt),
    cancelledAt: ms(b.cancelledAt),
    cancelledBy: str(b.cancelledBy, 30),
    cancelReason: str(b.cancelReason, 200),
    cancelFee: num(b.cancelFee),
    proFault: str(b.proFault, 30),
    proFine: num(b.proFine),
    clientCredit: num(b.clientCredit),
    delay,
    rings: Array.isArray(b.rings) ? b.rings.length : 0,
    outcome: str(b.outcome, 20),
    rating: Number(b.rating) > 0 ? Number(b.rating) : null,
    ratingText: str(review?.text, 300),
    clientStars: Number(b.clientRating?.stars) > 0 ? Number(b.clientRating.stars) : null,
    photos: (Array.isArray(b.diagnosisPhotos) ? b.diagnosisPhotos.length : 0),
    photoUrls: {
      request: (Array.isArray(b.photos) ? b.photos : []).filter((u) => typeof u === 'string' && u.startsWith('https://')).slice(0, 8),
      work: (Array.isArray(b.diagnosisPhotos) ? b.diagnosisPhotos : []).filter((u) => typeof u === 'string' && u.startsWith('https://')).slice(0, 8),
    },
    claim: claim ? {
      status: str(claim.status, 30), openedBy: str(claim.openedBy, 20), kind: str(claim.kind, 30), kindLabel: str(claim.kindLabel, 80),
      outcome: str(claim.decision?.outcome, 20), openedAt: ms(claim.openedAt), resolveDueAt: ms(claim.resolveDueAt),
      text: str(claim.text, 400), response: str(claim.response?.text, 400), decisionNote: str(claim.decision?.note, 300), formal: true,
    } : b.dispute && typeof b.dispute === 'object' ? {
      // Reclamo anterior al protocolo V5.5: solo vive en la reserva (bookings.dispute).
      status: b.status === 'en_disputa' && b.dispute.status !== 'resuelto' ? 'en_revision' : 'resuelto', openedBy: str(b.dispute.by, 20) || 'cliente',
      kind: str(b.dispute.kind, 30), kindLabel: str(b.dispute.kind, 80).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), outcome: str(b.dispute.outcome, 20),
      openedAt: ms(b.dispute.at ?? b.disputedAt), resolveDueAt: null, text: str(b.dispute.text, 400), response: '', decisionNote: '', formal: false,
    } : null,
  };
}

/** Movimiento del libro → fila. */
export function ledgerRow(id, e) {
  return {
    id, bookingId: e.bookingId ? str(e.bookingId, 60) : null, proId: str(e.proId, 60), clientId: e.clientId ? str(e.clientId, 60) : null,
    kind: str(e.kind, 40), bucket: str(e.bucket, 40), amount: num(e.amount), base: e.base === undefined ? null : num(e.base),
    iva: e.iva === undefined ? null : num(e.iva), proDelta: num(e.proDelta), payoutId: e.payoutId ? str(e.payoutId, 80) : null,
    availableAt: ms(e.availableAt), createdAt: ms(e.createdAt), reverses: e.reverses ? str(e.reverses, 80) : null,
    reversedBy: e.reversedBy ? str(e.reversedBy, 80) : null, paymentMethod: str(e.paymentMethod, 20),
  };
}

/** Liquidación semanal → fila (cuenta bancaria tapada). */
export function payoutRow(id, p) {
  const acct = String(p.bank?.number ?? '').replace(/\D/g, '');
  return {
    id, proId: str(p.proId, 60), week: str(p.week, 10), status: str(p.status, 20), regime: str(p.regime, 30),
    gross: num(p.gross), deductions: num(p.deductions), net: num(p.net),
    retentions: { renta: num(p.retentions?.renta), iva: num(p.retentions?.iva) },
    byKind: Object.fromEntries(Object.entries(p.byKind ?? {}).map(([k, v]) => [str(k, 40), num(v)])),
    entries: Array.isArray(p.entryIds) ? p.entryIds.length : 0,
    bank: p.bank ? `${str(p.bank.bank, 40)} ${acct ? `•••• ${acct.slice(-4)}` : ''}`.trim() : '',
    createdAt: ms(p.createdAt), paidAt: ms(p.paidAt),
  };
}

/** Profesional → fila (correo y celular tapados). */
export function providerRow(uid, p, now = Date.now()) {
  const name = p.kind === 'empresa' && p.businessName ? str(p.businessName, 80) : `${str(p.firstName, 40)} ${str(p.lastName, 40)}`.trim();
  const since = now - 30 * DAY;
  return {
    uid, name, kind: str(p.kind, 20) || 'persona', status: str(p.status, 20),
    categories: Array.isArray(p.categories) ? p.categories.map((c) => str(c, 40)) : [],
    catStatus: p.catStatus && typeof p.catStatus === 'object' ? p.catStatus : {},
    cities: Array.isArray(p.cities) ? p.cities.slice(0, 30).map((c) => str(c, 40)) : [],
    rating: Number(p.rating) > 0 ? num(p.rating) : null, reviewCount: Number(p.reviewCount) || 0, jobsDone: Number(p.jobsDone) || 0,
    strikes30: (Array.isArray(p.strikeLog) ? p.strikeLog : []).filter((t) => Number(t) > since).length,
    suspendedUntil: Number(p.suspendedUntil) > now ? Number(p.suspendedUntil) : null, suspendedReason: str(p.suspendedReason, 120),
    payoutBalance: num(p.payoutBalance), cashDebt: num(p.cashDebt), fines: num(p.fines),
    taxRegime: str(p.taxRegime, 30) || 'general', eSignature: !!p.eSignature, acceptsCash: !!p.acceptsCash, tester: !!p.tester,
    ruc: str(p.ruc, 13), email: maskContact(p.email), phone: maskContact(p.phone),
    submittedAt: ms(p.submittedAt), reviewedAt: ms(p.reviewedAt),
  };
}

/** Cliente → fila (contacto tapado). */
export function clientRow(uid, c) {
  return {
    uid, name: str(c.name, 80), phone: maskContact(c.phone), email: maskContact(c.email),
    balance: num(c.balance), noShows: Number(c.noShows) || 0, strikes: Number(c.strikes) || 0, createdAt: ms(c.createdAt),
  };
}

/** Reclamo → fila (para el contador del tablero; el expediente sigue en /admin/reclamos). */
export function claimRow(id, c) {
  return {
    id, code: str(c.code, 20), bookingId: str(c.bookingId ?? id, 60), openedBy: str(c.openedBy, 20), kind: str(c.kind, 30), kindLabel: str(c.kindLabel, 80),
    status: str(c.status, 30), outcome: str(c.decision?.outcome, 20), clientId: str(c.clientId, 60), proId: str(c.proId, 60),
    category: str(c.category, 40), openedAt: ms(c.openedAt), resolveDueAt: ms(c.resolveDueAt), decidedAt: ms(c.decision?.at),
    multaPro: num(c.decision?.multaPro), creditoCliente: num(c.decision?.creditoCliente),
  };
}
