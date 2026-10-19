/**
 * Filtro de malas palabras para calificaciones, chat, reclamos y notas.
 * Lo que se escribe en HULUL lo leen otras personas: las reseñas son públicas.
 * Se puede contar cualquier molestia, pero sin groserías ni insultos.
 *
 * La misma lista está en functions/profanity.js (el servidor la vuelve a
 * revisar). Si agregas una palabra aquí, agrégala allá.
 */
export const BAD_WORDS = [
  // Groserías
  'mierda', 'puta', 'puto', 'hijueputa', 'hijoeputa', 'hijodeputa', 'hdp', 'hptmr', 'verga', 'vrg', 'mamaverga', 'mamahuevo', 'mamahuevos',
  'pendejo', 'pendeja', 'pendejada', 'cabron', 'cabrona', 'culo', 'culero', 'culera', 'culiado', 'culeado', 'chucha', 'chuchatumadre', 'chuchetumadre',
  'conchatumadre', 'carajo', 'joder', 'jodete', 'malparido', 'malparida', 'gonorrea', 'zorra', 'cagada', 'cagado', 'cagar',
  'pajero', 'pajera', 'pija', 'ojete', 'huevon', 'huevona', 'guevon', 'guevona', 'huevada', 'guevada', 'mamada', 'mamon', 'mamona', 'chimba', 'marica',
  'maricon', 'maricona', 'mariconada', 'putamadre', 'putada', 'cojudo', 'cojuda', 'cojudez', 'longo', 'longa',
  // Insultos
  'idiota', 'imbecil', 'estupido', 'estupida', 'tarado', 'tarada', 'retrasado', 'retrasada', 'mongolico', 'mongolica', 'subnormal', 'baboso', 'babosa',
  'lacra', 'escoria',
  // Abreviaturas y formas de chat (Ecuador)
  'crv', 'careverga', 'carevrg', 'carechimba', 'mmvg', 'mmgv', 'mmv', 'mamavrg', 'vrga', 'vrgas', 'verg', 'berga', 'vergazo',
  'ctm', 'ctmr', 'csm', 'cdsm', 'conchesumadre', 'chuchesumadre', 'ptm', 'ptmr', 'hpta', 'hpt', 'hptas', 'hijueputas', 'hueputa', 'jueputa', 'hdpt',
  'mrd', 'mrda', 'mierd', 'pndj', 'pndjo', 'pndja', 'cbrn', 'hvn', 'hvon', 'gvn',
  'cachudo', 'cachuda', 'plomazo', 'malnacido', 'malnacida', 'pelotudo', 'pelotuda', 'boludo', 'boluda', 'caremonda', 'monda',
  // Jerga ecuatoriana
  'cdtm', 'chdtm', 'ctmre', 'chuchamadre', 'chuchadetumadre', 'chuchesu', 'chuchas', 'mamaguevo', 'mamaguevos', 'mamaverguear', 'verguear', 'verguero',
  'huevas', 'huevadas', 'webon', 'webona', 'webada', 'wevon', 'wevona', 'wevada', 'wvn', 'gueva', 'guevas', 'careculo', 'carechucha', 'caretuca',
  'conchudo', 'conchuda', 'carishina', 'cholo', 'longuito', 'longuita', 'cagon', 'cagona', 'mierdoso', 'mierdosa', 'mierdero',
  'malparidos', 'mal parido', 'mal parida', 'hijo de perra', 'hija de perra', 'mariposon', 'mamarracho', 'sinverguenza', 'desgraciado', 'desgraciada',
  'lambon', 'lambona', 'ladilla', 'gil', 'gila', 'gilazo', 'cojudazo', 'pendejazo', 'huevonazo',
  // Inglés básico
  'fuck', 'fucking', 'fck', 'shit', 'bitch', 'asshole', 'motherfucker', 'dick',
];

/** Minúsculas, sin tildes, sin trucos (p3nd3j0, put@) y sin letras repetidas (mierdaaa). */
export function normalizeText(text: string): string {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[0@4]/g, (c) => ({ '0': 'o', '@': 'a', '4': 'a' })[c] ?? c)
    .replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/\$|5/g, 's').replace(/7/g, 't')
    .replace(/([a-z])\1{2,}/g, '$1')
    .replace(/[^a-zñ\s]/g, ' ');
}

const PATTERNS = BAD_WORDS.map((w) => {
  const base = w.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '\\s+');
  // Palabra completa, con plural opcional.
  return new RegExp(`(^|[^a-zñ])${base}(s|es)?(?=$|[^a-zñ])`);
});

/** ¿El texto tiene malas palabras? */
export function hasProfanity(text: string): boolean {
  const n = normalizeText(text);
  return PATTERNS.some((re) => re.test(n));
}

/** Mensaje para quien escribió una mala palabra. */
export const PROFANITY_MESSAGE = 'Tu mensaje tiene palabras que no publicamos. Puedes contar lo que pasó sin ellas: igual nos ayuda.';
