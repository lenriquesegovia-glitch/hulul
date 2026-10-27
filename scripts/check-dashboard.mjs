// Tablero de administración: etapas, calidad, contabilidad y proveedores con
// filas reales del servidor (functions/tablero-core.js y functions/money.js).
import assert from 'node:assert/strict';
import { bookingRow, ledgerRow, payoutRow, providerRow } from '../functions/tablero-core.js';
import { ledgerEntriesFor } from '../functions/money.js';
import {
  accounting, canDo, caseFlags, complianceAlerts, hululSales, journal, ledgerByAccount, quality, weekMoney, caseOutcome, clientStats, executive, periodRange, providerInvoices, providerStats, stageOf, toCsv,
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

// Contabilidad NIIF: partida doble cuadrada; tarjeta deja en cero la cuenta por cobrar al cliente.
{
  const card = bookingRow('card000000000', { ...base, date: '2026-10-20', slot: '10:00', status: 'completada' });
  const cash = bookingRow('cash000000000', { ...base, date: '2026-10-20', slot: '11:00', status: 'completada', paymentMethod: 'efectivo' });
  const mk = (b, raw) => ledgerEntriesFor(raw).map((e, i) => ledgerRow(`${b.id}_${i}`, { ...e, bookingId: b.id, proId: 'P1', createdAt: T(at('2026-10-20', '12:00')), payoutId: null }));
  const lg = [...mk(card, { ...base, status: 'completada' }), ...mk(cash, { ...base, status: 'completada', paymentMethod: 'efectivo' })];
  const lines = journal({ ledger: lg, payouts: [], bookings: [card, cash], providers: [] }, { from: '2026-10-01', to: '2026-10-31' });
  const d = lines.reduce((t, l) => t + l.debit, 0), c = lines.reduce((t, l) => t + l.credit, 0);
  assert.ok(Math.abs(d - c) < 0.001, 'debe = haber');
  const acc = Object.fromEntries(ledgerByAccount(lines).map((a) => [a.code, a.balance]));
  assert.equal(acc['1010205'], 0, 'tarjeta: el cobro cancela la cuenta del cliente');
  assert.ok(acc['4102'] < 0 && acc['2010701'] < 0, 'ingreso e IVA al haber');
  const sales = hululSales({ ledger: lg, bookings: [card, cash], providers: [] }, { from: '2026-10-01', to: '2026-10-31' });
  assert.equal(sales.filter((x) => x.to === 'cliente').length, 2);
  assert.equal(sales.filter((x) => x.to === 'profesional').length, 2);
  const q = quality(bookings, { from: '2026-10-01', to: '2026-10-31' });
  assert.equal(q.stars.reduce((t, s) => t + s.count, 0), q.rated);
  const wm = weekMoney({ ledger: lg, payouts: [], bookings: [card, cash] }, now);
  assert.equal(typeof wm.nextPayout.estimate, 'number');
}

// Gastos y nómina (deben coincidir con functions/gastos-core.js)
{
  const core = await import('../functions/gastos-core.js');
  const sh = await import('../packages/shared/src/dashboard.ts');
  for (const [k, v] of Object.entries(core.EXPENSE_CATEGORIES)) assert.equal(sh.EXPENSE_CATEGORIES[k]?.code, v.code, `categoría ${k}`);
  assert.deepEqual(Object.keys(sh.EXPENSE_CATEGORIES).sort(), Object.keys(core.EXPENSE_CATEGORIES).sort());
  const g1 = { id: 'g1', ...core.expenseInput({ fecha: '2026-10-05', categoria: 'honorarios', proveedor: 'Contadora', base: 200, iva: 30, retRenta: 20, retIva: 21 }), pagadoEl: null };
  const g2 = { id: 'g2', ...core.expenseInput({ fecha: '2026-10-10', categoria: 'marketing', proveedor: 'Meta', base: 100, iva: 15, estado: 'por_pagar', vence: '2026-10-20' }), pagadoEl: null };
  const emp = { id: 'e1', nombre: 'Ana', sueldo: 482, ingreso: '2025-01-01', decimosMensuales: false, fondoMensual: false };
  const lines = [core.payrollLine(emp, { anticipos: 40 }, '2026-10')];
  const totals = core.payrollTotals(lines);
  const nom = core.payrollExpenses('2026-10', totals).map((g) => ({ ...g, pagadoEl: null }));
  const gastos = [g1, g2, ...nom];
  const range = { from: '2026-10-01', to: '2026-10-31' };
  const s = sh.expenseSummary(gastos, range, now);
  assert.equal(s.vencidos.total, 115, 'factura de Meta vencida');
  assert.equal(s.total, sh.r2(300 + nom.reduce((t, g) => t + g.base, 0)));
  assert.deepEqual(s.byGroup.map((g) => g.key), ['administrativos', 'nomina', 'marketing']);
  const lg = [{ id: 'l1', bucket: 'ingreso_hulul', kind: 'comision', amount: 1000, createdAt: Date.UTC(2026, 9, 12, 15) }, { id: 'l2', bucket: 'ingreso_hulul', kind: 'multa', amount: 10, createdAt: Date.UTC(2026, 9, 12, 15) }];
  const is = sh.incomeStatement(lg, gastos, range, now);
  assert.equal(is.ingresos.total, 1010);
  assert.equal(is.utilidad, sh.r2(1010 - s.total));
  const j = sh.expenseJournal(gastos, [{ mes: '2026-10', status: 'aprobado', lines, totals }], range);
  const dr = sh.r2(j.reduce((t, l) => t + l.debit, 0)); const cr = sh.r2(j.reduce((t, l) => t + l.credit, 0));
  assert.equal(dr, cr, 'asientos de gastos y nómina cuadran');
  for (const e of new Set(j.map((l) => l.entry))) {
    const x = j.filter((l) => l.entry === e);
    assert.equal(sh.r2(x.reduce((t, l) => t + l.debit, 0)), sh.r2(x.reduce((t, l) => t + l.credit, 0)), `asiento ${e} cuadra`);
  }
  assert.ok(!j.some((l) => l.entry.startsWith('FC') && l.detail.startsWith('Pago') && l.party === 'Meta'), 'lo pendiente no se paga en el diario');
  const serie = sh.resultSeries(lg, gastos, range, 'mes');
  assert.equal(serie.length, 1); assert.equal(serie[0].utilidad, is.utilidad);

  // Tarjeta, exterior y devengado.
  const apple = { id: 'g3', ...core.expenseInput({ fecha: '2026-10-03', categoria: 'tecnologia', proveedor: 'Apple', base: 99, iva: 14.85, isd: 4.95, formaPago: 'tarjeta', exterior: true, cubreMeses: 12, plataforma: 'apple' }), pagadoEl: '2026-10-03' };
  const gcp = { id: 'g4', ...core.expenseInput({ fecha: '2026-11-02', categoria: 'tecnologia', proveedor: 'Google Cloud', base: 40, iva: 6, formaPago: 'tarjeta', exterior: true, cubreDesde: '2026-10', plataforma: 'firebase', liquidacion: true }), pagadoEl: '2026-11-02' };
  const socio = { id: 'g5', ...core.expenseInput({ fecha: '2026-10-08', categoria: 'tecnologia', proveedor: 'Claude', base: 100, formaPago: 'tarjeta', pagador: 'socio', socio: 'Luis', plataforma: 'claude' }), pagadoEl: '2026-10-08' };
  const all = [apple, gcp, socio];
  const oct = sh.expenseSummary(all, range, now);
  assert.equal(oct.total, sh.r2(8.25 + 4.95 + 40 + 100), 'octubre: 1/12 de Apple + ISD + Google de octubre (cobrado en nov.) + Claude');
  assert.equal(oct.prepaid.diferido, sh.r2(99 - 8.25), 'lo anual pagado en octubre que se devenga después');
  const year = { from: '2026-01-01', to: '2027-12-31' };
  const jj = sh.expenseJournal(all, [], year, [{ id: 'p1', fecha: '2026-11-20', monto: 50, tarjeta: 'Visa', referencia: '' }]);
  for (const e of new Set(jj.map((l) => l.entry))) {
    const x = jj.filter((l) => l.entry === e);
    assert.equal(sh.r2(x.reduce((t, l) => t + l.debit, 0)), sh.r2(x.reduce((t, l) => t + l.credit, 0)), `asiento ${e} cuadra`);
  }
  const bal = (code) => sh.r2(jj.filter((l) => l.code === code).reduce((t, l) => t + l.credit - l.debit, 0));
  assert.equal(bal('2010401'), sh.r2(apple.aPagar + gcp.aPagar - 50), 'deuda de la tarjeta = cargos − pagos');
  assert.equal(bal('20108'), 100, 'se le debe al socio');
  const reemb = sh.expenseJournal(all, [], year, [{ id: 'r1', fecha: '2026-11-25', monto: 100, tipo: 'reembolso', socio: 'Luis', tarjeta: '', referencia: '' }]);
  assert.equal(sh.r2(reemb.filter((l) => l.code === '20108').reduce((t, l) => t + l.credit - l.debit, 0)), 0, 'reembolsado al socio');
  assert.equal(sh.cardStatus(all, [{ id: 'r1', fecha: '2026-11-25', monto: 100, tipo: 'reembolso', socio: 'Luis', tarjeta: '', referencia: '' }], now).socios.length, 0);
  assert.equal(bal('1010404'), 0, 'lo pagado por anticipado se devengó completo en el año');
  assert.equal(bal('2010301'), 0, 'la provisión de octubre se cerró con el cargo de noviembre');
  assert.equal(sh.r2(jj.filter((l) => l.code === '520228').reduce((t, l) => t + l.debit, 0)), 239, 'gasto total devengado de plataformas');
  const cs = sh.cardStatus(all, [{ id: 'p1', fecha: '2026-11-20', monto: 50, tarjeta: '', referencia: '' }], now);
  assert.equal(cs.saldo, sh.r2(apple.aPagar + gcp.aPagar - 50));
  assert.deepEqual(cs.sinLiquidacion.ids, ['g3']);
  const pc = sh.platformCosts(all, now);
  assert.equal(pc.find((x) => x.key === 'apple').months.at(-1).monto, 13.2, 'la cuota del mes + el ISD del cargo');

  // Bandeja de novedades
  const dash = { range, generatedAt: now, bookings, ledger: [], payouts: [], providers: [], clients: [], claims: [] };
  const inbox = sh.inboxItems(dash, () => true, now, { gastos: { gastos: [g2, ...all], roles: [], pagosTarjeta: [] } });
  assert.ok(inbox.some((i) => i.id === 'gastos-vencidos' && i.level === 'alta'));
  assert.ok(inbox.some((i) => i.id === 'liquidaciones'));
  assert.ok(inbox.some((i) => i.id === 'socio-Luis'));
  assert.ok(!sh.inboxItems(dash, (p) => p === 'tablero', now, {}).some((i) => i.area === 'Gastos'), 'sin permiso no ve gastos');
  for (let i = 1; i < inbox.length; i++) assert.ok({ alta: 0, media: 1, info: 2 }[inbox[i - 1].level] <= { alta: 0, media: 1, info: 2 }[inbox[i].level]);
}

console.log('Tablero: OK');
