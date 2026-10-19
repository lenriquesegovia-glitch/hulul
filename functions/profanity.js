/**
 * Filtro de malas palabras (copia de packages/shared/src/profanity.ts: si
 * agregas una palabra allá, agrégala aquí).
 */
const BAD_WORDS = [
  // Groserías
  'mierda', 'puta', 'puto', 'hijueputa', 'hijoeputa', 'hijodeputa', 'hdp', 'hptmr', 'verga', 'vrg', 'mamaverga', 'mamahuevo', 'mamahuevos',
  'pendejo', 'pendeja', 'pendejada', 'cabron', 'cabrona', 'culo', 'culero', 'culera', 'culiado', 'culeado', 'chucha', 'chuchatumadre', 'chuchetumadre',
  'conchatumadre', 'carajo', 'joder', 'jodete', 'malparido', 'malparida', 'gonorrea', 'zorra', 'cagada', 'cagado', 'cagar',
  'pajero', 'pajera', 'pija', 'ojete', 'huevon', 'huevona', 'guevon', 'guevona', 'huevada', 'guevada', 'mamada', 'mamon', 'mamona', 'chimba', 'marica',
  'maricon', 'maricona', 'mariconada', 'putamadre', 'putada', 'cojudo', 'cojuda', 'cojudez', 'longo', 'longa',
  // Insultos
  'idiota', 'imbecil', 'estupido', 'estupida', 'tarado', 'tarada', 'retrasado', 'retrasada', 'mongolico', 'mongolica', 'subnormal', 'baboso', 'babosa',
  'lacra', 'escoria',
];

export function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[0@4]/g, (c) => ({ '0': 'o', '@': 'a', '4': 'a' })[c] ?? c)
    .replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/\$|5/g, 's').replace(/7/g, 't')
    .replace(/([a-z])\1{2,}/g, '$1')
    .replace(/[^a-z\s]/g, ' ');
}

const PATTERNS = BAD_WORDS.map((w) => {
  const base = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z])${base}(s|es)?(?=$|[^a-z])`);
});

export const hasProfanity = (text) => PATTERNS.some((re) => re.test(normalizeText(text)));

/** El texto con las malas palabras tapadas (para el chat, que no se puede rechazar). */
export function maskProfanity(text) {
  let out = String(text ?? '');
  for (const w of out.split(/(\s+)/)) {
    if (w.trim() && hasProfanity(w)) out = out.replace(w, '•'.repeat(Math.min(w.length, 8)));
  }
  return out;
}

export const PROFANITY_MESSAGE = 'Tu mensaje tiene palabras que no publicamos. Puedes contar lo que pasó sin ellas: igual nos ayuda.';
