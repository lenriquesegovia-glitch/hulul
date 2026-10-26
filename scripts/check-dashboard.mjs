// Tablero de administración: etapas, calidad, contabilidad y proveedores con
// filas reales del servidor (functions/tablero-core.js y functions/money.js).
import assert from 'node:assert/strict';
import { bookingRow, ledgerRow, payoutRow, providerRow } from '../functions/tablero-core.js';
import { ledgerEntriesFor } from '../functions/money.js';
import {
  accounting, canDo, caseFlags, complianceAlerts, caseOutcome, clientStats, executive, periodRange, providerInvoices, providerStats, stageOf, toCsv,
} from '../packages/shared/src/dashboard.ts';

const now = Date.UTC(2026, 9, 26, 3); // domingo 25-oct-2026, 22:00 en Ecuador
const at = (date, slot) => { const [y, m, d] = date.split('-').map(Number); const [h, mi] = slot.split(':').map(Number); return Date.UTC(y, m - 1, d, h + 5, mi); };
const T = (n) => ({ toMillis: () => n });
const base = { category: 'plomeria', professionalId: 'P1', professionalName: 'Juan Vargas', contactName: 'Ana', clientId: 'C1', paymentMethod: 'tarjeta', visit: 20, fee: 1.99, iva: 3.3, total: 25.29, taxRegime: 'general' };
const raw = {
  ok: { ...base, date: '2026-10-20', slot: '10:00', status: 'completada', arrivedAt: T(at('2026-10-20', '10:05')), rating: 5, outcome: 'resuelto' },
  late: { ...base, date: '2026-10-21', slot: '10:00', status: 'completada', arrivedAt: T(at('2026-10-21', '10:40')), rating: 4 },
  bad: { ...base, date: '2026-10-22', slot: '09:00', status: 'completada', arrivedAt: T(at('2026-10-22', '09:00')), rating: 2 },
  reported: { ...base, clientId: 'C2', contactName: 'Pepe', date: '2026-10-22', slot: '15:00', status: 'completada', arrivedAt: T(at('2026-10-22', '15:00')), rating: 5, clientRating: { stars: 1 } },
  absent: { ...base, clientId: 'C2', contactName: 'Pepe', date: '2026-10-23', slot: '11:00', status: 'cancelada', cancelledBy: 'cliente_ausente', cancelFee: 20, arrivedAt: T(at('2026-10-23', '11:00')) },
  noshow: { ...base, date: '2026-10-23', slot: '16:00', status: 'cancelada', cancelledBy: 'sistema', proFault: 'no_se_presento', proFine: 10, clientCredit: 5 },
  dispute: { ...base, date: '2026-10-24', slot: '10:00', status: 'en_disputa', arrivedAt: T(at('2026-10-24', '10:00')) },
  future: { ...base, date: '2026-10-28', slot: '10:00', status: 'confirmada' },
  live: { ...base, date: '2026-10-25', slot: '21:00', status: 'en_curso' },
  nextMonth: { ...base, date: '2026-11-10', slot: '08:00', status: 'pendiente' },
};
const claims = { dispute: { status: 'en_revision', openedBy: 'cliente', kind: 'incompleto', kindLabel: 'Incompleto' } };
const bookings = Object.entries(raw).map(([id, b]) => bookingRow(`${id}0000000000`, b, claims[id] ?? null));
const by = Object.fromEntries(bookings.map((b) => [b.id.replace(/0+$/, ''), b]));

// Etapas
assert.equal(stageOf(by.ok), 'ejecutada');
assert.equal(stageOf(by.future), 'programada');
assert.equal(stageOf(by.live), 'ejecucion');
assert.equal(stageOf(by.dispute), 'reclamo');
assert.equal(stageOf(by.noshow), 'cancelada');

// Calidad
assert.ok(caseFlags(by.ok).success);
assert.ok(caseFlags(by.late).late && !caseFlags(by.late).success);
assert.equal(caseFlags(by.late).lateMin, 40);
assert.ok(caseFlags(by.bad).badService);
assert.ok(caseFlags(by.reported).clientReported && caseFlags(by.reported).success, 'el cliente reportado no le quita el éxito al profesional');
assert.equal(caseOutcome(by.absent), 'cliente_ausente');
assert.equal(caseOutcome(by.noshow), 'falla_profesional');
assert.equal(caseOutcome(by.dispute), 'en_reclamo');
assert.equal(caseOutcome(by.future), null);

// Periodos (domingo 25-oct: semana del lunes 19 al domingo 25)
assert.deepEqual(periodRange('semana', now), { from: '2026-10-19', to: '2026-10-25' });
assert.deepEqual(periodRange('proxima_semana', now), { from: '2026-10-26', to: '2026-11-01' });
assert.deepEqual(periodRange('mes', now), { from: '2026-10-01', to: '2026-10-31' });
assert.deepEqual(periodRange('proximo_mes', now), { from: '2026-11-01', to: '2026-11-30' });
assert.deepEqual(periodRange('proximo_mes', Date.UTC(2026, 11, 15)), { from: '2027-01-01', to: '2027-01-31' });

// Resumen ejecutivo de la semana
const ex = executive(bookings, periodRange('semana', now));
assert.equal(ex.total, 8);
assert.equal(ex.closed, 7);
assert.equal(ex.open, 1);
const out = Object.fromEntries(ex.outcomes.map((o) => [o.key, o.count]));
assert.deepEqual([out.exito, out.atrasado, out.mal_servicio, out.en_reclamo, out.falla_profesional, out.cliente_ausente], [2, 1, 1, 1, 1, 1]);
assert.equal(ex.outcomes.reduce((s, o) => s + o.count, 0), ex.closed, 'el pastel suma el 100 % de lo terminado');
assert.equal(ex.counts.success, 2);
assert.equal(ex.counts.clientReported, 1);
assert.equal(ex.avgLateMin, 40);
assert.equal(ex.watchClients[0].name, 'Pepe');
assert.equal(ex.watchPros[0].name, 'Juan Vargas');

// Contabilidad con el libro real
let n = 0;
const ledger = [];
for (const [id, b] of Object.entries(raw)) {
  for (const e of ledgerEntriesFor(b) ?? []) {
    const { hold, ...rest } = e;
    const createdAt = at(b.date, b.slot) + 3_600_000;
    ledger.push(ledgerRow(`L${++n}`, { ...rest, bookingId: `${id}0000000000`, proId: 'P1', clientId: b.clientId, payoutId: id === 'ok' ? 'W1_P1' : null, availableAt: hold ? createdAt + 48 * 3_600_000 : createdAt, createdAt: T(createdAt) }));
  }
}
const payouts = [payoutRow('W1_P1', { proId: 'P1', week: '2026-10-19', status: 'pagado', net: 17.25 }), payoutRow('W2_P1', { proId: 'P1', week: '2026-10-26', status: 'por_pagar', net: 30 })];
const acc = accounting({ ledger, payouts, bookings }, periodRange('semana', now), now);
assert.equal(acc.before.count, 1, 'solo la que está en curso: la del 28 cae la próxima semana');
assert.ok(acc.incomeTotal > 0 && acc.vatDue > 0 && acc.collected > 0);
assert.equal(acc.after.paid, 17.25);
assert.equal(acc.after.toPay, 30);
assert.equal(acc.during.held, 0, 'ya pasaron las 48 h de todo lo cobrado');
assert.ok(acc.during.available > 0 && acc.during.owedByPros === 0);
assert.ok(acc.income.some((i) => i.kind === 'multa' && i.amount === 10));

// Proveedores y facturas
const data = { range: { from: '2026-01-01', to: '2027-01-01' }, generatedAt: now, bookings, ledger, payouts, providers: [providerRow('P1', { firstName: 'Juan', lastName: 'Vargas', status: 'aprobado' }, now)], clients: [], claims: [] };
const inv = providerInvoices('P1', data);
assert.equal(inv.length, 4, 'una factura por visita completada (la de reclamo aún no tiene movimientos)');
assert.ok(inv.every((i) => i.total === 23 && i.base === 20 && i.iva === 3));
const ps = providerStats(data, periodRange('mes', now), now)[0];
assert.equal(ps.done, 4);
assert.equal(ps.billed.total, 92);
assert.equal(ps.fines, 10);
assert.equal(ps.nextJob, '2026-10-28');

// Clientes
const cs = clientStats(data, now);
const pepe = cs.find((c) => c.clientId === 'C2');
assert.equal(pepe.absent, 1);
assert.equal(pepe.reported, 1);
assert.equal(pepe.spent, 25.29 + 20);

// Exportar
const csv = toCsv([{ a: 'x;y', b: 1.5 }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]);
assert.ok(csv.includes('"x;y";1,5'));

// Roles (deben coincidir con functions/roles-core.js)
const { ROLE_PERMS: serverPerms } = await import('../functions/roles-core.js');
const { ROLE_PERMS: webPerms } = await import('../packages/shared/src/dashboard.ts');
assert.deepEqual(webPerms, serverPerms, 'permisos iguales en servidor y panel');
assert.ok(canDo('contabilidad', 'pagos') && !canDo('cumplimiento', 'pagos') && !canDo('socio', 'equipo'));

// Cumplimiento (UAFE)
const big = bookingRow('big0000000000', { ...base, clientId: 'C9', contactName: 'Grande', date: '2026-10-20', slot: '10:00', status: 'completada', visit: 1200, total: 1400, paymentMethod: 'efectivo' });
const many = Array.from({ length: 9 }, (_, i) => bookingRow(`m${i}000000000000`, { ...base, clientId: 'C9', contactName: 'Grande', date: `2026-10-${String(10 + i).padStart(2, '0')}`, slot: '10:00', status: 'completada', visit: 1000, total: 1200, paymentMethod: 'efectivo' }));
const alerts = complianceAlerts({ bookings: [big, ...many], payouts: [], providers: [] }, { from: '2026-10-01', to: '2026-10-31' });
const kinds = new Set(alerts.map((a) => a.kind));
for (const k of ['operacion', 'acumulado', 'efectivo', 'repetido']) assert.ok(kinds.has(k), `alerta ${k}`);
assert.equal(alerts[0].level, 'alta');
assert.equal(complianceAlerts({ bookings, payouts: [], providers: [] }, { from: '2026-10-01', to: '2026-10-31' }).length, 0, 'operaciones normales sin alertas');

console.log('Tablero: OK');
