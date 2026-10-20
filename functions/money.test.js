// Pruebas del dinero: node --test functions/money.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { extraOf, ledgerDiff, ledgerEntriesFor, priceOf, reversalOf, weeklyPayout } from './money.js';

const sum = (xs, f) => Math.round(xs.reduce((s, x) => s + f(x), 0) * 100) / 100;

test('visita de $20, régimen general: igual que el modelo de negocio', () => {
  const q = priceOf(20, 0, 'general');
  assert.equal(q.proInvoice.total, 23);
  assert.equal(q.platformInvoice.total, 2.29);
  assert.equal(q.total, 25.29);
  assert.equal(q.commission.base, 3);
  assert.equal(q.commission.iva, 0.45);
});

test('visita de $20, RIMPE negocio popular: sin IVA en la visita', () => {
  const q = priceOf(20, 0, 'rimpe_popular');
  assert.equal(q.proInvoice.iva, 0);
  assert.equal(q.total, 22.29);
  assert.equal(q.commission.total, 3.45);
});

test('cobro adicional según régimen', () => {
  assert.deepEqual(extraOf(35, 'general'), { amount: 35, iva: 5.25, total: 40.25, commission: 5.25, commissionIva: 0.79 });
  assert.equal(extraOf(35, 'rimpe_popular').total, 35);
});

const done = { status: 'completada', paymentMethod: 'tarjeta', visit: 20, surcharge: 0, taxRegime: 'general' };

test('tarjeta: el profesional recibe su factura menos la comisión con IVA', () => {
  const es = ledgerEntriesFor(done);
  assert.equal(sum(es, (e) => e.proDelta), 23 - 3.45);
  // Ingreso propio de HULUL: solo cargo de plataforma y comisión.
  assert.equal(sum(es.filter((e) => e.bucket === 'ingreso_hulul'), (e) => e.amount), 1.99 + 3);
  // Lo recaudado cuadra con terceros + ingreso + IVA de HULUL.
  const recaudo = sum(es.filter((e) => e.bucket === 'recaudo'), (e) => e.amount);
  assert.equal(recaudo, 25.29);
  assert.equal(es.find((e) => e.kind === 'visita').hold, true);
});

test('efectivo: el profesional queda debiendo cargo de plataforma y comisión', () => {
  const es = ledgerEntriesFor({ ...done, paymentMethod: 'deuna' });
  assert.equal(sum(es, (e) => e.proDelta), -(2.29 + 3.45));
  assert.equal(es.some((e) => e.bucket === 'recaudo'), false);
});

test('cancelación tardía y multa', () => {
  const es = ledgerEntriesFor({ status: 'cancelada', cancelFee: 3, cancelledBy: 'cliente', paymentMethod: 'tarjeta' });
  assert.equal(sum(es, (e) => e.proDelta), 2.4);
  const fine = ledgerEntriesFor({ status: 'cancelada', cancelFee: 0, proFine: 5, clientCredit: 5 });
  assert.equal(sum(fine, (e) => e.proDelta), -5);
});

test('disputa no toca nada; devolución revierte todo', () => {
  assert.equal(ledgerEntriesFor({ ...done, status: 'en_disputa' }), null);
  const posted = ledgerEntriesFor(done).map((e, i) => ({ ...e, id: `x${i}` }));
  assert.deepEqual(ledgerDiff(ledgerEntriesFor(done), posted), { create: [], reverse: [] });
  const { create, reverse } = ledgerDiff(ledgerEntriesFor({ ...done, status: 'cancelada', cancelFee: 0 }), posted);
  assert.equal(create.length, 0);
  assert.equal(reverse.length, posted.length);
  assert.equal(sum([...posted, ...reverse.map((e) => reversalOf(e, e.id))], (e) => e.proDelta), 0);
});

test('liquidación semanal: tarjeta menos deuda de efectivo', () => {
  const card = ledgerEntriesFor(done);
  const cash = ledgerEntriesFor({ ...done, paymentMethod: 'deuna' });
  const liq = weeklyPayout([...card, ...cash], 'general');
  assert.equal(liq.net, Math.round((23 - 3.45 - 2.29 - 3.45) * 100) / 100);
  assert.equal(liq.retentions.renta, 0);
});
