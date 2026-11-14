// Les films et les photos vivent dans `site/` (dépôt) : on en copie ce que la page utilise dans `public/media/` (non versionné).
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', '..', 'site');
const out = join(here, '..', 'public', 'media');
const VIDEOS = ['hero', 'hero-portrait', 'jour-montaigne', 'm-chauffeur', 'volant', 'm-van', 'van', 'arrivee', 'shopping', 'salon', 'vendome', 'rivoli', 'cles'];
const IMAGES = ['fleet-m5', 'fleet-g63', 'fleet-f296', 'fleet-classev'];
mkdirSync(out, { recursive: true });
let n = 0;
for (const v of VIDEOS) {
  for (const [dir, file] of [['video', v + '.mp4'], ['video', v + '.webm'], ['img', v + '-poster.jpg']]) {
    const from = join(src, dir, file);
    if (existsSync(from)) { cpSync(from, join(out, file)); n++; }
  }
}
for (const i of IMAGES) { const from = join(src, 'img', i + '.jpg'); if (existsSync(from)) { cpSync(from, join(out, i + '.jpg')); n++; } }
console.log(`médias copiés : ${n}`);
