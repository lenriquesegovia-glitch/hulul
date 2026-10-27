import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStatement, readStatement } from './estado-tarjeta.js';

test('limpia la respuesta de la IA', () => {
  const r = parseStatement('Aquí está: {"periodo":{"desde":"2026-09-16","hasta":"2026-10-15"},"banco":"Pacífico","movimientos":[' +
    '{"n":1,"fecha":"2026-10-02","descripcion":"VERCEL INC 4111111111111111","monto":20,"tipo":"consumo","relacionado":null,"exterior":true},' +
    '{"n":2,"fecha":"2026-10-02","descripcion":"IVA SERV DIGITALES","monto":3,"tipo":"iva","relacionado":1,"exterior":false},' +
    '{"n":3,"fecha":"2026-10-10","descripcion":"PAGO","monto":-200,"tipo":"pago"},' +
    '{"n":4,"fecha":"10/10/2026","descripcion":"MAL","monto":5,"tipo":"consumo"},' +
    '{"n":5,"fecha":"2026-10-11","descripcion":"X","monto":7,"tipo":"raro"}]} fin');
  assert.equal(r.banco, 'Pacífico');
  assert.equal(r.movimientos.length, 4, 'descarta la fecha mal escrita');
  assert.equal(r.movimientos[0].descripcion, 'VERCEL INC', 'sin número de tarjeta');
  assert.equal(r.movimientos[1].relacionado, 1);
  assert.equal(r.movimientos[3].tipo, 'otro');
});

test('envía el PDF como documento', async () => {
  let sent;
  const fetchImpl = async (_u, o) => { sent = JSON.parse(o.body); return { ok: true, json: async () => ({ content: [{ type: 'text', text: '{}' }] }) }; };
  await readStatement({ key: 'k', pdf: 'QUJD', fetchImpl });
  assert.equal(sent.messages[0].content[0].type, 'document');
});
