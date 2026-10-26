import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankFile, paymentLines } from './bank-files.js';

const bank = { bank: 'Banco del Pacífico', type: 'ahorros', number: '0012-345678', holder: 'José Núñez', holderId: '0912345678' };

test('líneas de pago: separa las que no se pueden pagar', () => {
  const r = paymentLines([
    { id: 'w_a', proId: 'a', week: '2026-10-26', net: 45.5, bank },
    { id: 'w_b', proId: 'b', week: '2026-10-26', net: 20, bank: null },
    { id: 'w_c', proId: 'c', week: '2026-10-26', net: 10, bank: { ...bank, holderId: '12' } },
    { id: 'w_d', proId: 'd', week: '2026-10-26', net: 30, bank: { ...bank, type: 'corriente', holderId: '0912345678001' } },
  ], { b: 'Sin Banco' });
  assert.equal(r.ok.length, 2);
  assert.equal(r.total, 75.5);
  assert.deepEqual(r.skipped.map((s) => s.reason), ['Sin cuenta bancaria', 'Falta la cédula o RUC del titular']);
  assert.equal(r.ok[0].holder, 'JOSE NUNEZ');
  assert.equal(r.ok[0].account, '0012345678');
  assert.deepEqual([r.ok[1].idType, r.ok[1].accountType], ['R', 'CTE']);
});

test('plantilla CSV', () => {
  const { ok } = paymentLines([{ id: 'w_a', proId: 'a', week: '2026-10-26', net: 45.5, bank }]);
  const csv = bankFile(ok);
  const [head, line] = csv.replace('﻿', '').split('\r\n');
  assert.ok(head.startsWith('N;TIPO_ID;IDENTIFICACION'));
  assert.equal(line, '1;C;="0912345678";JOSE NUNEZ;BANCO DEL PACIFICO;AHO;="0012345678";45.50;HULUL SEMANA 2026-10-26');
  assert.throws(() => bankFile(ok, 'otro'));
});
