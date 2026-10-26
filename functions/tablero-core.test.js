import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appointmentAt, bookingRow, clientRow, dashRange, ecDay, ledgerRow, payoutRow, providerRow } from './tablero-core.js';

const T = (n) => ({ toMillis: () => n });

test('rango por defecto: 180 días atrás y 90 adelante; ordena y limita', () => {
  const now = Date.UTC(2026, 9, 26, 3); // 25-oct 22:00 en Ecuador
  assert.equal(ecDay(now), '2026-10-25');
  const r = dashRange({}, now);
  assert.equal(r.from, '2026-04-28');
  assert.equal(r.to, '2027-01-23');
  assert.deepEqual(dashRange({ desde: '2026-12-01', hasta: '2026-11-01' }, now), { from: '2026-11-01', to: '2026-12-01' });
  const big = dashRange({ desde: '2020-01-01', hasta: '2026-12-31' }, now);
  assert.equal(big.to, '2026-12-31');
  assert.ok(big.from > '2025-11-01');
  assert.deepEqual(dashRange({ desde: 'x', hasta: 1 }, now), r);
});

test('hora de la cita en Ecuador', () => {
  assert.equal(appointmentAt('2026-10-25', '09:30'), Date.UTC(2026, 9, 25, 14, 30));
  assert.equal(appointmentAt('', '09:30'), null);
});

test('reserva → fila sin contacto completo', () => {
  const row = bookingRow('AbCdEf1234567890xyz9', {
    date: '2026-10-20', slot: '10:00', status: 'completada', category: 'plomeria', contactName: 'Ana Pérez', contactPhone: '0991234567',
    contactEmail: 'ana@x.com', address: 'Calle 1', professionalId: 'P1', professionalName: 'Juan', visit: 20, fee: 1.99, iva: 3.3, total: 25.29,
    paymentMethod: 'tarjeta', arrivedAt: T(5), rating: 5, clientRating: { stars: 2 }, diagnosisPhotos: ['a', 'b'], rings: [1, 2], delay: { minutes: 15, status: 'aceptado', reason: 'tráfico' },
  }, { status: 'resuelto', openedBy: 'cliente', kind: 'cobro', kindLabel: 'Cobro', decision: { outcome: 'profesional' } });
  assert.equal(row.code, '90XYZ9');
  assert.equal(row.clientPhone, '•••• 4567');
  assert.equal(row.arrivedAt, 5);
  assert.equal(row.clientStars, 2);
  assert.equal(row.photos, 2);
  assert.equal(row.rings, 2);
  assert.deepEqual(row.delay, { minutes: 15, status: 'aceptado' });
  assert.equal(row.claim.outcome, 'profesional');
  const json = JSON.stringify(row);
  assert.ok(!json.includes('0991234567') && !json.includes('ana@x.com') && !json.includes('Calle 1'));
});

test('libro, liquidación, profesional y cliente', () => {
  const l = ledgerRow('L1', { bookingId: 'B', proId: 'P', kind: 'visita', bucket: 'terceros', amount: 23, base: 20, iva: 3, proDelta: 23, payoutId: null, availableAt: 9, createdAt: T(8) });
  assert.equal(l.createdAt, 8);
  assert.equal(l.payoutId, null);
  const p = payoutRow('2026-10-26_P', { proId: 'P', week: '2026-10-26', status: 'por_pagar', net: 40.5, bank: { bank: 'Pichincha', number: '2200123456' }, entryIds: ['a', 'b'] });
  assert.equal(p.bank, 'Pichincha •••• 3456');
  assert.equal(p.entries, 2);
  const now = Date.UTC(2026, 9, 25);
  const pr = providerRow('P', { firstName: 'Juan', lastName: 'Vargas', email: 'juan@x.com', strikeLog: [now - 86_400_000, now - 40 * 86_400_000], suspendedUntil: now - 1, rating: 4.6 }, now);
  assert.equal(pr.name, 'Juan Vargas');
  assert.equal(pr.strikes30, 1);
  assert.equal(pr.suspendedUntil, null);
  assert.equal(pr.email, 'ju•••@x.com');
  assert.equal(providerRow('E', { kind: 'empresa', businessName: 'Frío SA', firstName: 'X' }).name, 'Frío SA');
  assert.equal(clientRow('C', { name: 'Ana', phone: '0991112222', balance: 3 }).phone, '•••• 2222');
});
