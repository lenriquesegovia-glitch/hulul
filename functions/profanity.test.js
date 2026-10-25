import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasProfanity, maskProfanity } from './profanity.js';

test('detecta groserías comunes de Ecuador y México', () => {
  for (const t of ['eres un hijo de la chingada', 'HIJO DE LA CHINGADA!!', 'pinche cliente', 'vete a la chingadaaa', 'ch1ngada', 'hijo de puta', 'p3nd3j0', 'hijueputa']) {
    assert.equal(hasProfanity(t), true, t);
  }
});

test('no bloquea palabras normales', () => {
  for (const t of ['la cancha está lista', 'el pincel está nuevo', 'chinchilla', 'gracias por la puntualidad', 'cono de tránsito', 'mi cuñado', '¡Llegué!', 'Listo!!']) {
    assert.equal(hasProfanity(t), false, t);
  }
});

test('el chat tapa la grosería', () => {
  assert.equal(hasProfanity(maskProfanity('eres un hijo de la chingada')), false);
});
