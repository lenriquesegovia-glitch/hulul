import { test } from 'node:test';
import assert from 'node:assert/strict';
import { submissionCheck, validCedula, verifySelfie, verifyText } from './doc-verify.js';

const ex = { cedula: '0926687856', ruc: '0926687856001', firstName: 'Luis Enrique', lastName: 'Segovia Torres', kind: 'persona' };
const today = new Date(2026, 9, 25);

test('cédula de ejemplo es válida', () => assert.ok(validCedula('0926687856')));

test('frente de cédula con número y apellido', () => {
  const r = verifyText('cedulaFrente', 'REPUBLICA DEL ECUADOR CEDULA DE CIUDADANIA No. 092668785-6 APELLIDOS SEGOVIA TORRES NOMBRES LUIS ENRIQUE FECHA DE EXPIRACION 12/05/2031', ex, today);
  assert.equal(r.status, 'ok');
});

test('cédula caducada se rechaza', () => {
  const r = verifyText('cedulaFrente', 'REPUBLICA DEL ECUADOR CEDULA 0926687856 SEGOVIA TORRES FECHA DE EXPIRACION 01/01/2020', ex, today);
  assert.equal(r.status, 'rechazado');
  assert.match(r.msg, /caducada/);
});

test('cédula de otra persona se rechaza', () => {
  const r = verifyText('cedulaFrente', 'REPUBLICA DEL ECUADOR CEDULA DE IDENTIDAD 1710034065 PEREZ GOMEZ JUAN', ex, today);
  assert.equal(r.status, 'rechazado');
});

test('archivo ilegible se rechaza', () => assert.equal(verifyText('ruc', 'hola', ex, today).status, 'rechazado'));

test('antecedentes recientes y limpios', () => {
  const r = verifyText('antecedentes', 'MINISTERIO DEL INTERIOR CERTIFICADO DE ANTECEDENTES PENALES 0926687856 SEGOVIA TORRES LUIS NO REGISTRA ANTECEDENTES PENALES FECHA 20/10/2026', ex, today);
  assert.equal(r.status, 'ok');
});

test('antecedentes viejos se rechazan', () => {
  const r = verifyText('antecedentes', 'CERTIFICADO DE ANTECEDENTES PENALES 0926687856 NO REGISTRA FECHA 01/03/2026', ex, today);
  assert.equal(r.status, 'rechazado');
});

test('antecedentes que registran quedan para revisión', () => {
  const r = verifyText('antecedentes', 'CERTIFICADO DE ANTECEDENTES PENALES 0926687856 SI REGISTRA ANTECEDENTES FECHA 20/10/2026', ex, today);
  assert.equal(r.status, 'revisar');
  assert.equal(r.flag, 'Registra antecedentes');
});

test('RUC propio y de otro', () => {
  assert.equal(verifyText('ruc', 'SERVICIO DE RENTAS INTERNAS REGISTRO UNICO DE CONTRIBUYENTES 0926687856001 SEGOVIA TORRES LUIS ACTIVO', ex, today).status, 'ok');
  assert.equal(verifyText('ruc', 'SERVICIO DE RENTAS INTERNAS RUC 1710034065001 PEREZ', ex, today).status, 'rechazado');
});

test('selfie: umbrales', () => {
  assert.equal(verifySelfie({ distance: 0.35, liveness: true }).status, 'ok');
  assert.equal(verifySelfie({ distance: 0.46, liveness: true }).status, 'revisar');
  assert.equal(verifySelfie({ distance: 0.55, liveness: true }).status, 'rechazado');
  assert.equal(verifySelfie({ distance: 0.35, liveness: false }).status, 'revisar');
  assert.equal(verifySelfie({ distance: 0.1, liveness: false }).status, 'rechazado');
  assert.equal(verifySelfie({}).status, 'rechazado');
});

test('envío: exige verificación del archivo actual con los datos actuales', () => {
  const p = { ...ex, docs: { cedulaFrente: { path: 'a' }, selfie: { path: 'b' } } };
  const expect = { cedula: ex.cedula, ruc: ex.ruc, firstName: ex.firstName, lastName: ex.lastName, businessName: '', kind: 'persona' };
  const v = { cedulaFrente: { path: 'a', status: 'ok', expect }, selfie: { path: 'viejo', status: 'ok', expect } };
  const r = submissionCheck(p, v, ['cedulaFrente', 'selfie', 'ruc']);
  assert.equal(r.problems.length, 2);
  const r2 = submissionCheck({ ...p, lastName: 'Otro' }, { ...v, selfie: { ...v.selfie, path: 'b' } }, ['cedulaFrente', 'selfie']);
  assert.match(r2.problems[0], /cambiaste tus datos/);
});
