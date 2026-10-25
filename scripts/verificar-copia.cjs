#!/usr/bin/env node
// Bloqueo contra publicaciones desde código antiguo.
// Lo llaman publicar-app.bat y publicar-firebase.bat antes de publicar, y el
// publicador de GitHub Actions. Sale con error (y no se publica) si:
//  - la copia es la carpeta raíz antigua (C:\Users\lsego\Hulul);
//  - hay cambios sin guardar en Git;
//  - el commit actual no es exactamente el último de origin/main en GitHub.
// Uso: node scripts/verificar-copia.cjs [--rama <nombre>]  (por defecto main)
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const args = process.argv.slice(2);
const i = args.indexOf('--rama');
const branch = i >= 0 && args[i + 1] ? args[i + 1] : 'main';
const root = path.resolve(__dirname, '..');
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const stop = (msg) => {
  console.error('\n  NO SE PUBLICA: ' + msg + '\n');
  console.error('  Publica desde una copia actualizada de GitHub (C:\\Users\\lsego\\Hulul\\implementacion-v3 o el publicador de GitHub Actions).\n');
  process.exit(1);
};

// 1) Carpeta raíz antigua.
if (root.replace(/[\\/]+$/, '').toLowerCase() === 'c:\\users\\lsego\\hulul') stop('esta es la carpeta raíz antigua (C:\\Users\\lsego\\Hulul).');

// 2) Repositorio y cambios sin guardar.
try { git('rev-parse', '--is-inside-work-tree'); } catch { stop('esta carpeta no es una copia de Git del repositorio.'); }
const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).replace(/\s+$/, '');
if (dirty) stop('hay cambios sin guardar en Git:\n' + dirty.split('\n').map((l) => '    ' + l).join('\n'));

// 3) Igual al último commit de GitHub.
try { git('fetch', '--quiet', 'origin', branch); } catch (e) { stop('no se pudo consultar GitHub (git fetch). Revisa la conexión.'); }
const head = git('rev-parse', 'HEAD');
const remote = git('rev-parse', 'FETCH_HEAD');
if (head !== remote) {
  let detail = '';
  try {
    const behind = git('rev-list', '--count', `${head}..${remote}`);
    const ahead = git('rev-list', '--count', `${remote}..${head}`);
    detail = ` (te faltan ${behind} commit(s) de GitHub${ahead !== '0' ? ` y tienes ${ahead} sin subir` : ''})`;
  } catch {}
  stop(`esta copia (${head.slice(0, 7)}) no es la última de origin/${branch} (${remote.slice(0, 7)})${detail}. Corre actualizar.bat o integra los cambios antes.`);
}

console.log(`  Copia verificada: ${head.slice(0, 7)} = último origin/${branch}. Se puede publicar.`);
