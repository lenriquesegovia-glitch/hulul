import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, dashForRole, roleFor, roleInput } from './roles-core.js';

const owners = 'lenriquesegovia@gmail.com';
const tok = (email, v = true) => ({ email, email_verified: v });

test('dueño por ADMIN_EMAILS, con correo verificado', () => {
  assert.equal(roleFor(tok('LEnriqueSegovia@gmail.com'), owners, null), 'dueno');
  assert.equal(roleFor(tok('lenriquesegovia@gmail.com', false), owners, null), null);
});

test('rol asignado en adminRoles', () => {
  assert.equal(roleFor(tok('conta@x.com'), owners, { role: 'contabilidad' }), 'contabilidad');
  assert.equal(roleFor(tok('conta@x.com'), owners, { role: 'contabilidad', active: false }), null);
  assert.equal(roleFor(tok('conta@x.com'), owners, { role: 'dueno' }), null, 'nadie se hace dueño desde la base');
  assert.equal(roleFor(tok('otro@x.com'), owners, null), null);
});

test('permisos', () => {
  assert.ok(can('dueno', 'equipo'));
  assert.ok(!can('socio', 'equipo'));
  assert.ok(can('socio', 'reclamos'));
  assert.ok(can('contabilidad', 'pagos'));
  assert.ok(!can('contabilidad', 'reclamos'));
  assert.ok(!can('contabilidad', 'clientes'));
  assert.ok(can('cumplimiento', 'cumplimiento'));
  assert.ok(!can('cumplimiento', 'pagos'));
  assert.ok(!can('cumplimiento', 'reclamos'));
  assert.ok(!can(null, 'tablero'));
});

test('validación al dar acceso', () => {
  assert.deepEqual(roleInput({ email: ' Ana@Correo.com ', role: 'cumplimiento', name: 'Ana' }, owners), { email: 'ana@correo.com', role: 'cumplimiento', name: 'Ana' });
  assert.ok(roleInput({ email: 'a@b', role: 'socio', name: 'Ana' }, owners).error);
  assert.ok(roleInput({ email: 'lenriquesegovia@gmail.com', role: 'socio', name: 'Luis' }, owners).error);
  assert.ok(roleInput({ email: 'a@b.com', role: 'dueno', name: 'Ana' }, owners).error);
});

test('datos del tablero por rol', () => {
  const data = { bookings: [{ id: 'b', claim: { kindLabel: 'x' } }], ledger: [1], payouts: [1], providers: [1], clients: [1], claims: [1] };
  assert.equal(dashForRole(data, 'socio'), data);
  const c = dashForRole(data, 'contabilidad');
  assert.deepEqual([c.claims.length, c.clients.length, c.ledger.length, c.bookings[0].claim.kindLabel], [0, 0, 1, '']);
  const u = dashForRole(data, 'cumplimiento');
  assert.deepEqual([u.claims.length, u.clients.length], [0, 1]);
});
