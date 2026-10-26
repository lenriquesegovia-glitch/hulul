import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskBank, providerFiles, reviewMessage, reviewPatch } from './pro-review.js';

const pro = { status: 'en_revision', categories: ['plomeria', 'electricidad'], catStatus: { plomeria: 'en_revision', electricidad: 'en_revision' } };

test('aprobar aprueba las categorías en revisión', () => {
  const r = reviewPatch({ decision: 'aprobado' }, pro);
  assert.equal(r.patch.status, 'aprobado');
  assert.deepEqual(r.patch.catStatus, { plomeria: 'aprobado', electricidad: 'aprobado' });
});

test('aprobar respetando una categoría rechazada', () => {
  const r = reviewPatch({ decision: 'aprobado', catStatus: { electricidad: 'rechazado' } }, pro);
  assert.deepEqual(r.patch.catStatus, { plomeria: 'aprobado', electricidad: 'rechazado' });
});

test('no se aprueba si todas las categorías quedan rechazadas', () => {
  const r = reviewPatch({ decision: 'aprobado', catStatus: { plomeria: 'rechazado', electricidad: 'rechazado' } }, pro);
  assert.ok(r.error);
});

test('observar o rechazar exige motivo', () => {
  assert.ok(reviewPatch({ decision: 'observado', note: 'corto' }, pro).error);
  assert.equal(reviewPatch({ decision: 'observado', note: 'La foto de la cédula está borrosa.' }, pro).patch.status, 'observado');
  assert.ok(reviewPatch({ decision: 'rechazado' }, pro).error);
});

test('decisión inválida o borrador', () => {
  assert.ok(reviewPatch({ decision: 'publicado' }, pro).error);
  assert.ok(reviewPatch({ decision: 'aprobado' }, { ...pro, status: 'borrador' }).error);
});

test('solo actividades nuevas no se puede aprobar', () => {
  assert.ok(reviewPatch({ decision: 'aprobado' }, { status: 'en_revision', categories: [], proposals: [{ name: 'Chef' }] }).error);
});

test('mensajes incluyen el motivo', () => {
  assert.match(reviewMessage('observado', 'Luis Enrique', 'Sube la cédula nítida.').text, /Sube la cédula nítida/);
  assert.match(reviewMessage('rechazado', 'Luis', 'Antecedentes.').text, /Motivo: Antecedentes/);
  assert.match(reviewMessage('aprobado', 'Luis', '').subject, /HULUL/);
});

test('archivos solo de la carpeta del profesional', () => {
  const files = providerFiles({ docs: { selfie: { path: 'providers/abc/s.jpg' }, ruc: { path: 'otros/x.pdf' } }, catEvidence: { plomeria: { files: ['providers/abc/e1.jpg'] } } }, 'abc');
  assert.deepEqual(files.map((f) => f.path), ['providers/abc/s.jpg', 'providers/abc/e1.jpg']);
});

test('banco con número tapado', () => {
  assert.equal(maskBank({ number: '2201234567' }).number, '•••• 4567');
});
