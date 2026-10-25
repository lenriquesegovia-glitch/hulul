import assert from 'node:assert/strict';
import { oneEmail, safeMessage } from './mail-safety.js';
assert.equal(oneEmail('cliente@gmail.com'), 'cliente@gmail.com');
assert.equal(oneEmail(' Cliente.Uno+x@Hotmail.com '), 'Cliente.Uno+x@Hotmail.com');
for (const bad of ['a@x.com, b@y.com', 'a@x.com;b@y.com', '"x" <a@x.com>', 'a@x.com (b@y.com)', 'a@x', '', null, 'a@x.com\nbcc:b@y.com', 'x'.repeat(170) + '@a.com'])
  assert.equal(oneEmail(bad), '', `debe rechazar ${JSON.stringify(bad)}`);
assert.equal(safeMessage({ to: 'a@x.com, b@y.com', subject: 's' }), null);
assert.deepEqual(safeMessage({ to: 'a@x.com', replyTo: 'b@y.com, c@z.com', bcc: 'd@w.com', subject: 's' }), { to: 'a@x.com', subject: 's' });
assert.deepEqual(safeMessage({ to: 'equipo@hululec.com, luis@x.com', trusted: true, replyTo: 'c@z.com' }), { to: 'equipo@hululec.com, luis@x.com', replyTo: 'c@z.com' });
console.log('mail-safety: 14 casos correctos');
