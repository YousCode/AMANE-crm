// Les affiches et les photos vivent dans `site/` (dépôt) : on en copie ce que la page utilise dans `public/media/` (non versionné),
// puis on prépare les films qui avancent au défilement (`sequences.json` → `public/media/seq/`, voir `frames.mjs` ; ffmpeg requis).
import { cpSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSequences } from './frames.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', '..', 'site');
const out = join(here, '..', 'public', 'media');
// Affiches des services (la porte en arche les montre pendant que leur film charge) ; les films eux-mêmes passent par `frames.mjs`.
const POSTERS = ['jour-montaigne', 'm-chauffeur', 'm-van', 'arrivee', 'shopping', 'salon', 'vendome', 'hero'];
const IMAGES = ['fleet-m5', 'fleet-g63', 'fleet-f296', 'fleet-classev'];
mkdirSync(out, { recursive: true });
// Vidéos laissées par une version précédente du site : la page n'en lit plus aucune.
for (const f of readdirSync(out)) if (/\.(mp4|webm)$/.test(f)) rmSync(join(out, f));
let n = 0;
for (const v of POSTERS) {
  const from = join(src, 'img', v + '-poster.jpg');
  if (existsSync(from)) { cpSync(from, join(out, v + '-poster.jpg')); n++; }
}
for (const i of IMAGES) { const from = join(src, 'img', i + '.jpg'); if (existsSync(from)) { cpSync(from, join(out, i + '.jpg')); n++; } }
console.log(`médias copiés : ${n}`);

const t0 = performance.now();
try {
  const films = await buildSequences();
  const absent = films.filter((f) => f.absent);
  for (const f of films) if (!f.skipped) console.log(`film ${f.line}`);
  for (const w of films.flatMap((f) => f.warnings)) console.warn(`ATTENTION — ${w}`);
  if (absent.length) console.warn(`ATTENTION — ${absent.length} film(s) ignoré(s), source absente pour l'instant dans ${dirname(absent[0].absent)} : ${absent.map((f) => basename(f.absent)).join(', ')}`);
  console.log(`films ${films.some((f) => f.done) ? 'préparés' : 'à jour'} en ${Math.round(performance.now() - t0)} ms`);
} catch (e) {
  console.error(`\nfilms : ${e.message}\n`);
  process.exit(1);
}
