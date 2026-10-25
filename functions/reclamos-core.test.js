import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimBlocked, deadlines, dueActions, decisionPatch, responseStats, timeline, maskContact, isAdminToken, cleanClaimPhotos } from './reclamos-core.js';

const H = 3_600_000;
const now = Date.UTC(2026, 9, 25, 20);

test('cliente: dentro de 48 h de terminada sí; después no', () => {
  assert.equal(claimBlocked({ status: 'completada', finishedAt: now - 10 * H }, 'cliente', 'incompleto', now), null);
  assert.match(claimBlocked({ status: 'completada', finishedAt: now - 50 * H }, 'cliente', 'incompleto', now), /48 horas/);
  assert.equal(claimBlocked({ status: 'por_aprobar', finishedAt: now - H }, 'cliente', 'cobro', now), null);
});

test('cliente: "sí estaba" solo con cliente ausente', () => {
  assert.match(claimBlocked({ status: 'completada', finishedAt: now - H }, 'cliente', 'si_estaba', now), /no te encontró/);
  assert.equal(claimBlocked({ status: 'cancelada', cancelledBy: 'cliente_ausente', cancelledAt: now - H }, 'cliente', 'si_estaba', now), null);
});

test('profesional: visita terminada o cancelada por el cliente; no dos reclamos', () => {
  assert.equal(claimBlocked({ status: 'completada', finishedAt: now - H }, 'profesional', 'no_pago', now), null);
  assert.equal(claimBlocked({ status: 'cancelada', cancelledBy: 'cliente', cancelledAt: now - H }, 'profesional', 'agresion', now), null);
  assert.ok(claimBlocked({ status: 'cancelada', cancelledBy: 'profesional', cancelledAt: now - H }, 'profesional', 'agresion', now));
  assert.match(claimBlocked({ status: 'completada', finishedAt: now - H, dispute: { status: 'abierta' } }, 'profesional', 'no_pago', now), /Ya hay/);
  assert.equal(claimBlocked({ status: 'completada', finishedAt: now - H }, 'profesional', 'si_estaba', now), 'Elige qué pasó.');
});

test('plazos 24 h / 72 h y avisos una sola vez', () => {
  const d = deadlines(now);
  assert.equal(d.responseDueAt - now, 24 * H);
  assert.equal(d.resolveDueAt - now, 72 * H);
  const c = { status: 'esperando_respuesta', ...d };
  assert.deepEqual(dueActions(c, now + H), []);
  assert.deepEqual(dueActions(c, now + 25 * H), ['sin_respuesta']);
  assert.deepEqual(dueActions({ ...c, status: 'en_revision' }, now + 61 * H), ['por_vencer']);
  assert.deepEqual(dueActions({ ...c, status: 'en_revision', alerts: { porVencer: true } }, now + 73 * H), ['vencido']);
  assert.deepEqual(dueActions({ ...c, status: 'resuelto' }, now + 100 * H), []);
});

test('decisión a favor del profesional: se paga (o se mantiene el cargo de ausente)', () => {
  const p = decisionPatch({ status: 'en_disputa', previousStatus: 'por_aprobar', dispute: { kind: 'cobro' } }, { openedBy: 'cliente' }, { outcome: 'profesional' });
  assert.equal(p.status, 'completada');
  const a = decisionPatch({ status: 'en_disputa', previousStatus: 'cancelada', cancelFee: 25 }, { openedBy: 'cliente' }, { outcome: 'profesional' });
  assert.equal(a.status, 'cancelada');
  assert.equal(a.cancelFee, undefined);
});

test('decisión a favor del cliente: sin cobro, multa y crédito con tope', () => {
  const p = decisionPatch({ status: 'en_disputa', previousStatus: 'completada' }, { openedBy: 'cliente' }, { outcome: 'cliente', multaPro: 10, creditoCliente: 9999 });
  assert.equal(p.status, 'cancelada');
  assert.equal(p.cancelFee, 0);
  assert.equal(p.cancelledBy, 'reclamo');
  assert.equal(p.proFine, 10);
  assert.equal(p.clientCredit, 500);
  const a = decisionPatch({ status: 'en_disputa', previousStatus: 'cancelada', cancelledBy: 'cliente_ausente' }, { openedBy: 'cliente' }, { outcome: 'cliente' });
  assert.equal(a.cancelFee, 0);
  assert.equal(a.cancelledBy, undefined);
});

test('reclamo del profesional no mueve el dinero de la reserva', () => {
  const p = decisionPatch({ status: 'completada' }, { openedBy: 'profesional' }, { outcome: 'profesional', multaPro: 10 });
  assert.equal(p.status, undefined);
  assert.equal(p.dispute.status, 'resuelta');
});

test('tiempos de respuesta en el chat', () => {
  const m = (from, min) => ({ from, at: now + min * 60_000 });
  const s = responseStats([m('cliente', 0), m('cliente', 2), m('profesional', 10), m('cliente', 70), m('profesional', 75)]);
  assert.equal(s.profesional.replies, 2);
  assert.equal(s.profesional.avgMin, 8); // (10 + 5) / 2 redondeado
  assert.equal(s.cliente.replies, 1);
  assert.equal(s.cliente.avgMin, 60);
  assert.equal(s.cliente.count, 3);
});

test('línea de tiempo ordenada con timbres y GPS', () => {
  const t = timeline({ createdAt: now, arrivedAt: now + 3 * H, arrivedPos: { distance: 40, accuracy: 12 }, rings: [now + 3.1 * H, now + 3.2 * H], cancelledAt: now + 3.5 * H, cancelledBy: 'cliente_ausente' }, { openedBy: 'cliente', openedAt: now + 4 * H, kindLabel: 'x' }, [{ from: 'cliente', at: now + H, text: 'hola' }]);
  assert.deepEqual(t.map((e) => e.what), ['Reservó', 'Escribió en el chat', 'Marcó "Estoy en la dirección"', 'Timbró al cliente (1)', 'Timbró al cliente (2)', 'Canceló', 'Abrió el reclamo']);
  assert.match(t[2].detail, /40 m/);
});

test('privacidad: contacto enmascarado, administradores verificados y fotos solo propias', () => {
  assert.equal(maskContact('0991234567'), '•••• 4567');
  assert.equal(maskContact('juanperez@gmail.com'), 'ju•••@gmail.com');
  assert.equal(isAdminToken({ email: 'Dueno@Gmail.com', email_verified: true }, 'dueno@gmail.com, otro@x.com'), true);
  assert.equal(isAdminToken({ email: 'dueno@gmail.com', email_verified: false }, 'dueno@gmail.com'), false);
  assert.equal(isAdminToken({ email: 'x@gmail.com', email_verified: true }, ''), false);
  const ok = `https://firebasestorage.googleapis.com/v0/b/hulul-59081.firebasestorage.app/o/${encodeURIComponent('reclamos/u1/b1/')}f.jpg?alt=media`;
  const other = `https://firebasestorage.googleapis.com/v0/b/hulul-59081.firebasestorage.app/o/${encodeURIComponent('reclamos/u2/b1/')}f.jpg`;
  assert.deepEqual(cleanClaimPhotos([ok, other, 'https://evil.com/x.jpg'], 'u1', 'b1'), [ok]);
});
