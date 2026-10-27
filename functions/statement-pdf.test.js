import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statementData, statementPdf } from './statement-pdf.js';

const now = Date.UTC(2026, 9, 26, 17);
const ledger = [
  { kind: 'visita', proDelta: 23, createdAt: now - 3 * 864e5, bookingId: 'abc123XYZ987', payoutId: 'w1', availableAt: now - 864e5 },
  { kind: 'comision', proDelta: -3, createdAt: now - 3 * 864e5, bookingId: 'abc123XYZ987', payoutId: 'w1', availableAt: now - 864e5 },
  { kind: 'recaudo_visita', proDelta: 0, createdAt: now - 3 * 864e5, bookingId: 'abc123XYZ987', payoutId: null },
  { kind: 'plataforma', proDelta: -1.99, createdAt: now - 864e5, bookingId: 'cash00000001', payoutId: null, availableAt: now },
  { kind: 'multa', proDelta: -5, createdAt: now - 864e5, bookingId: 'fault0000001', payoutId: null, availableAt: now },
  { kind: 'visita', proDelta: 30, createdAt: now - 3600e3, bookingId: 'card00000001', payoutId: null, availableAt: now + 47 * 3600e3 },
];
const payouts = [{ week: '2026-10-26', status: 'pagado', net: 20, paidAt: now - 3600e3, createdAt: now - 7200e3, paymentReference: 'ORD-1' }];

test('estado de cuenta: suma lo que ve el profesional', () => {
  const d = statementData({ ledger, payouts, from: now - 30 * 864e5, to: now, now });
  assert.equal(d.rows.length, 5, 'sin movimientos internos de HULUL');
  assert.equal(d.groups.length, 4, 'una línea por reserva');
  assert.equal(d.groups[0].net, 20);
  assert.equal(d.earned, 53);
  assert.equal(d.fees, 4.99);
  assert.equal(d.fines, 5);
  assert.equal(d.paid, 20);
  assert.equal(d.pending, 23.01);
  assert.equal(d.held, 30);
});

test('genera un PDF', async () => {
  const d = statementData({ ledger, payouts, from: now - 30 * 864e5, to: now, now });
  const pdf = await statementPdf({ pro: { name: 'José Núñez', ruc: '0912345678001', regime: 'Régimen general', bank: 'Banco del Pacífico •••• 5678' }, from: now - 30 * 864e5, to: now, data: d });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 2000);
});
