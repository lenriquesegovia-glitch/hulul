// Estado de cuenta del profesional: usa los movimientos reales del servidor (functions/money.js).
import assert from 'node:assert/strict';
import { ledgerEntriesFor, reversalOf } from '../functions/money.js';
import { statementFor, pendingBalance, rowEffect, recentStrikes, visibleToPro } from '../packages/shared/src/statement.ts';

const now = Date.UTC(2026, 9, 24, 17);
let n = 0;
const rows = (b, at, available = at) => ledgerEntriesFor(b).map((e) => ({ id: `${b.id}_${++n}`, ...e, createdAtMs: at, availableAt: available, payoutId: null }));
// 1) Visita $20 en efectivo, régimen RIMPE popular (sin IVA en la visita).
const cash = rows({ id: 'A', status: 'completada', paymentMethod: 'efectivo', visit: 20, taxRegime: 'rimpe_popular' }, now - 3 * 86400000);
// 2) Visita $30 con tarjeta (dinero retenido 48 h).
const card = rows({ id: 'B', status: 'completada', paymentMethod: 'tarjeta', visit: 30, taxRegime: 'rimpe_popular' }, now - 3600000, now + 47 * 3600000);
// 3) Falta: no salió → multa $10.
const fault = rows({ id: 'C', status: 'cancelada', cancelFee: 0, proFine: 10, proFault: 'no_salio' }, now - 2 * 86400000);
// 4) Cobro adicional $15 con tarjeta en una visita en efectivo de $20.
const extra = rows({ id: 'D', status: 'completada', paymentMethod: 'efectivo', visit: 20, taxRegime: 'rimpe_popular', extra: { status: 'pagado_tarjeta', method: 'tarjeta', amount: 15 } }, now - 5 * 3600000);
const all = [...cash, ...card, ...fault, ...extra];
// 5) La multa se anula después (reverso).
const fine = fault.find((e) => e.kind === 'multa');
all.push({ id: 'C_rev', ...reversalOf(fine, fine.id), createdAtMs: now - 86400000, availableAt: now - 86400000, payoutId: null });

const st = statementFor(all, now - 30 * 86400000, now);
assert.ok(st.rows.every(visibleToPro));
assert.ok(!st.rows.some((e) => e.kind.startsWith('recaudo')), 'los movimientos internos de HULUL no se muestran');
assert.equal(st.earned, 85, 'ganado: 20 + 30 + 20 + 15');
assert.equal(st.fines, 0, 'la multa anulada no cuenta');
assert.equal(st.cashCollected, 40, 'visitas en efectivo: el dinero ya lo tiene el profesional');
assert.ok(st.commission > 0 && st.cashOwed > 0);
assert.equal(st.net, Math.round((st.earned - st.commission - st.fines - st.retentions) * 100) / 100);
const bal = pendingBalance(all, now);
assert.ok(bal.held > 0, 'la visita con tarjeta queda retenida 48 h');
assert.equal(bal.total, Math.round(all.reduce((t, e) => t + e.proDelta, 0) * 100) / 100);
assert.deepEqual(rowEffect(fine), { sign: '−', amount: 10 });
assert.deepEqual(rowEffect(all.at(-1)), { sign: '+', amount: 10 }, 'el reverso de una multa suma');
assert.equal(recentStrikes([now - 40 * 86400000, now - 5 * 86400000, now - 86400000], now), 2);
console.log(`PASS: estado de cuenta — ganado $${st.earned}, comisión $${st.commission}, efectivo de HULUL $${st.cashOwed}, neto $${st.net}, saldo disponible $${bal.available}, retenido $${bal.held}.`);
