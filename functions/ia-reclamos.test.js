import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClaimPrompt, callClaude, parseAnalysis } from './ia-reclamos.js';

const file = {
  claim: { code: 'R1', openedBy: 'cliente', kind: 'no_vino', kindLabel: 'No se realizó el servicio', text: 'No llegó', privado: { apertura: 'No llegó nunca' }, photos: ['https://x/1.jpg'], response: null, responseMissed: true },
  booking: { category: 'plomeria', date: '2026-10-20', slot: '10:00', status: 'en_disputa', paymentMethod: 'tarjeta', visit: 20, rings: [], contactPhone: '0991234567', address: 'Av. Siempre Viva 123' },
  messages: [{ at: 1, from: 'cliente', kind: 'texto', text: '¿Dónde está?', original: null }, { at: 1, from: 'cliente', kind: 'texto', text: 'llámame al 099 123 4567 o ana@mail.com', original: null }, { at: 2, from: 'profesional', kind: 'foto', photo: 'https://x/2.jpg' }],
  parties: { client: { reclamos: 1 }, pro: { reclamos: 3, strikes: 2 } }, stats: {},
};

test('el mensaje para la IA lleva el chat y las fotos, sin teléfono ni dirección', () => {
  const p = buildClaimPrompt(file);
  assert.ok(p.text.includes('No llegó nunca'));
  assert.ok(p.text.includes('¿Dónde está?'));
  assert.ok(!p.text.includes('0991234567') && !p.text.includes('Siempre Viva'));
  assert.ok(!p.text.includes('099 123 4567') && !p.text.includes('ana@mail.com') && p.text.includes('[número oculto]'));
  assert.deepEqual(p.photos, ['https://x/1.jpg', 'https://x/2.jpg']);
});

test('lee y limita la respuesta', () => {
  const a = parseAnalysis('Aquí va: {"lado":"cliente","confianza":"alta","resumen":"r","decision":{"multaPro":999,"creditoCliente":5,"faltaPro":true},"motivo":"m"} fin');
  assert.equal(a.lado, 'cliente');
  assert.equal(a.decision.multaPro, 200);
  const b = parseAnalysis('{"lado":"profesional","decision":{"multaPro":10,"creditoCliente":5}}');
  assert.deepEqual([b.decision.multaPro, b.decision.creditoCliente, b.confianza], [0, 0, 'baja']);
  assert.throws(() => parseAnalysis('sin json'));
});

test('llama a la API (simulada) y reintenta sin fotos si fallan', async () => {
  let calls = 0;
  const fake = async (_u, init) => {
    calls += 1;
    const body = JSON.parse(init.body);
    if (body.messages[0].content.some((c) => c.type === 'image')) return { ok: false, status: 400, json: async () => ({ error: { message: 'Could not fetch image url' } }) };
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: '{"lado":"cliente"}' }], usage: { input_tokens: 10 } }) };
  };
  const r = await callClaude({ key: 'k', system: 's', text: 't', photos: ['https://x/1.jpg'], fetchImpl: fake });
  assert.equal(calls, 2);
  assert.equal(r.photosSent, 0);
  assert.ok(r.text.includes('cliente'));
});
