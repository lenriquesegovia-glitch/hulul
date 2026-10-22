// Genera ../Index.html (el que se pega en Apps Script) desde Index.fuente.html.
//
// Por qué: al publicar, Google Apps Script recorta los comentarios del código y, en el
// proceso, rompe textos que contienen "/*" o "//" (por ejemplo "image/*" o "https://").
// Este paso quita todos los comentarios (HTML, CSS y JavaScript) y escribe esas secuencias
// escapadas ("\/*", "\/\/"), que en JavaScript significan lo mismo.
//
// Uso:  cd herramientas/registro-profesionales/fuente && npm i terser@5 && node construir.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { minify } from 'terser';

const here = new URL('.', import.meta.url);
let html = readFileSync(new URL('Index.fuente.html', here), 'utf8');

// 1) Comentarios HTML y CSS.
html = html.replace(/<!--[\s\S]*?-->/g, '');
html = html.replace(/<style>([\s\S]*?)<\/style>/g, (m, css) => '<style>' + css.replace(/\/\*[\s\S]*?\*\//g, '') + '</style>');

// 2) JavaScript: sin comentarios y sin las secuencias "/*" y "//".
const parts = [];
let last = 0;
const re = /<script>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html))) {
  parts.push(html.slice(last, m.index));
  const out = await minify(m[1], { compress: false, mangle: false, format: { comments: false, beautify: true, indent_level: 1 } });
  let code = out.code;
  // Fuera de comentarios (ya no hay), "/*" y "//" solo pueden estar dentro de textos o expresiones regulares.
  code = code.replace(/\/\*/g, '\\/*').replace(/\/\//g, '\\/\\/');
  const check = code.replace(/\\\//g, '');
  if (check.includes('/*') || check.includes('//')) throw new Error('Quedó una secuencia /* o // sin escapar');
  parts.push('<script>\n' + code + '\n</script>');
  last = re.lastIndex;
}
parts.push(html.slice(last));
const result = parts.join('');
writeFileSync(new URL('../Index.html', here), result);
console.log('Index.html generado:', Math.round(Buffer.byteLength(result) / 1024), 'KB');
