import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptanceInput, acceptancePdf, caseInput, clientInfo, fingerprint } from './legal-core.js';

test('aceptación: valida documentos y versiones', () => {
  const ok = acceptanceInput({ tipo: 'cliente', docs: [{ doc: 'terminos', version: '2026-10-25', textoHash: 'a'.repeat(64) }, { doc: 'raro', version: 'x' }] });
  assert.equal(ok.docs.length, 1);
  assert.ok(acceptanceInput({ tipo: 'profesional', docs: [{ doc: 'terminos', version: '2026-10-25' }] }).error, 'profesional sin mandato');
  assert.ok(acceptanceInput({ tipo: 'admin', docs: [] }).error);
});

test('IP detrás del balanceador y huella estable', () => {
  assert.equal(clientInfo({ headers: { 'x-forwarded-for': '190.12.3.4, 10.0.0.1' } }).ip, '190.12.3.4');
  const rec = { uid: 'u', email: 'a@b.com', tipo: 'cliente', docs: [{ doc: 'terminos', version: '2026-10-25' }], ip: '1.2.3.4', userAgent: 'x', atIso: '2026-10-27T15:00:00.000Z' };
  assert.equal(fingerprint(rec), fingerprint({ ...rec }));
  assert.notEqual(fingerprint(rec), fingerprint({ ...rec, ip: '1.2.3.5' }));
});

test('caso legal y constancia en PDF', async () => {
  assert.ok(caseInput({ tipo: 'defensoria', titulo: 'X', notificado: '2026-10-01' }).error);
  assert.equal(caseInput({ tipo: 'defensoria', titulo: 'Reclamo por daño', notificado: '2026-10-01', estado: 'nada' }).estado, 'abierto');
  const pdf = await acceptancePdf({ id: 'A1', uid: 'u', email: 'a@b.com', nombre: 'Ana', tipo: 'cliente', momento: 'registro', canal: 'web', docs: [{ doc: 'terminos', version: '2026-10-25' }], ip: '1.2.3.4', userAgent: 'x', atIso: '2026-10-27T15:00:00.000Z', huella: 'f'.repeat(64) });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
});
