/* Films qui avancent au défilement : `sequences.json` → planches `public/media/seq/<nom>/s01.jpg …` (non versionné).
   Planche : 8 images consécutives en grille 4 × 2 (image k, à partir de 0 → planche ⌊k / 8⌋ + 1, case k mod 8, ligne par ligne) ;
   chaque case est complétée en noir à droite et en bas jusqu'à un multiple de 16 px (les blocs JPEG ne mêlent pas deux images) ;
   la dernière planche d'un film dont le compte n'est pas un multiple de 8 garde des cases noires. Peu de fichiers : la page publiée
   en accepte 511 au plus. `src/sequence.ts` applique la même géométrie (layout ci-dessous).
   - source « frames » : `site/frames/f_001.jpg …`, réencodées au poids moyen des originaux ;
   - source « video » : `count` images régulièrement réparties sur `site/video/<video>.mp4`, de la première à la dernière
     (image i, à partir de 0 → image arrondi(i × (total − 1) / (count − 1)) du film), ramenées à width × height si la vidéo diffère ;
   - "optional": true : tant que la source manque ou n'est pas lisible (film en cours de dépôt), le film est ignoré
     avec un avertissement au lieu d'arrêter le build.
   Téléphone : `public/media/seq/<nom>/m/s01.jpg …`, 720 px de large (hauteur paire), une image sur deux, soit Math.ceil(count / 2) images ;
   l'image n du téléphone est l'image 2n − 1 de l'ordinateur (même début, `src/sequence.ts` applique la même règle).
   Poids : un seul passage de ffmpeg écrit plusieurs qualités ; on garde la plus fine dont le poids moyen par image tient sous POIDS.
   Rien n'est refait tant que les planches sont là, au complet, et que ni la source, ni la ligne du film dans `sequences.json`,
   ni ce script, ni FORMAT n'ont changé (empreintes dans `node_modules/.cache/amane-site/films.json`). Les anciennes images
   isolées (001.jpg …) sont supprimées du dossier de sortie.
   node scripts/frames.mjs [--force] */
import { execFile, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const self = fileURLToPath(import.meta.url);
const here = dirname(self);
const SITE = join(here, '..', '..', '..', 'site');
const LIST = join(here, '..', 'sequences.json');
const STAMPS = join(here, '..', 'node_modules', '.cache', 'amane-site', 'films.json');
export const SEQ_DIR = join(here, '..', 'public', 'media', 'seq');
const MOBILE_W = 720;
const POIDS = { full: 56 * 1024, m: 26 * 1024 }; // poids moyen visé par image (octets)
const Q = [5, 6, 7, 8, 9]; // échelle JPEG de ffmpeg (2 = le plus fin, 31 = le plus léger) : qualités essayées, de la plus fine à la plus légère
const FORMAT = 'planches 4x2, cases au multiple de 16 px — v2'; // à changer si la géométrie change : tout est refait
export const COLS = 4, ROWS = 2, PER = COLS * ROWS;

/** géométrie d'un film : taille d'une image, pas d'une case, nombre d'images et de planches (même calcul dans src/sequence.ts) */
export function layout(d, mobile = false) {
  const w = mobile ? Math.min(MOBILE_W, d.width) : d.width, h = mobile ? Math.round((d.height * w) / d.width / 2) * 2 : d.height;
  const count = mobile ? Math.ceil(d.count / 2) : d.count;
  return { w, h, cellW: Math.ceil(w / 16) * 16, cellH: Math.ceil(h / 16) * 16, count, sheets: Math.ceil(count / PER) };
}
const file = (i) => String(i).padStart(3, '0') + '.jpg';
const sheet = (i) => 's' + String(i).padStart(2, '0') + '.jpg';
const list = (dir, re) => (existsSync(dir) ? readdirSync(dir).filter((f) => re.test(f)) : []);
const sheets = (dir) => list(dir, /^s\d{2}\.jpg$/);
const ko = (n) => Math.round(n / 1024);
const weight = (dir) => sheets(dir).reduce((s, f) => s + statSync(join(dir, f)).size, 0);
const why = (e) => String(e.stderr || e.message).trim().split('\n').pop();
/** au complet : s01 … sN, rien de plus, aucun fichier vide, plus d'anciennes images isolées */
const complete = (dir, n) => { const seen = sheets(dir); return seen.length === n && !list(dir, /^\d{3}\.jpg$/).length && seen.every((f) => { const i = Number(f.slice(1, 3)); return i >= 1 && i <= n && statSync(join(dir, f)).size > 0; }); };
const empty = (dir) => { mkdirSync(dir, { recursive: true }); for (const f of list(dir, /^(s\d{2}|\d{3})\.jpg$/)) rmSync(join(dir, f)); };

// pas plus de quelques ffmpeg de front : une vidéo en haute définition occupe vite la mémoire et les cœurs
const SLOTS = Math.max(2, Math.min(4, availableParallelism())), waiting = []; let busy = 0;
const slot = async (fn) => { while (busy >= SLOTS) await new Promise((r) => waiting.push(r)); busy++; try { return await fn(); } finally { busy--; waiting.shift()?.(); } };

function tools() {
  for (const t of ['ffmpeg', 'ffprobe']) {
    const r = spawnSync(t, ['-version'], { stdio: 'ignore' });
    if (r.error || r.status !== 0) throw new Error(`${t} introuvable : il prépare les films du site (apt install ffmpeg, brew install ffmpeg…)`);
  }
}
async function probe(name, src) {
  try {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=width,height,nb_frames,nb_read_packets', '-of', 'json', src]);
    const s = JSON.parse(stdout).streams[0];
    return { width: s.width, height: s.height, total: Number(s.nb_frames) || Number(s.nb_read_packets) || 0 };
  } catch (e) { throw new Error(`film « ${name} » : source illisible (${src}) — ${why(e)}`); }
}
/** met les images `picks` (numéros dans la source, à partir de 0) en planches dir/s01.jpg … ; renvoie la qualité retenue */
async function extract(name, input, picks, g, scale, dir, target) {
  const tmp = (q) => join(dir, '.q' + q), wipe = () => Q.forEach((q) => rmSync(tmp(q), { recursive: true, force: true }));
  const chain = [`select='${picks.map((n) => `eq(n,${n})`).join('+')}'`, ...(scale ? [scale] : []), `pad=${g.cellW}:${g.cellH}:0:0:black`, 'setpts=N/FRAME_RATE/TB', `tile=${COLS}x${ROWS}`, `split=${Q.length}`].join(',');
  empty(dir); wipe(); Q.forEach((q) => mkdirSync(tmp(q)));
  try {
    await slot(() => run('ffmpeg', ['-v', 'error', '-y', ...input, '-filter_complex', `[0:v]${chain}${Q.map((q) => `[q${q}]`).join('')}`, ...Q.flatMap((q) => ['-map', `[q${q}]`, '-q:v', String(q), '-start_number', '1', join(tmp(q), 's%02d.jpg')])]));
    const q = Q.find((x) => weight(tmp(x)) / picks.length <= target) ?? Q[Q.length - 1], got = sheets(tmp(q));
    if (got.length !== g.sheets) throw new Error(`${got.length} planche(s) au lieu de ${g.sheets}`);
    for (const f of got) renameSync(join(tmp(q), f), join(dir, f));
    return q;
  } catch (e) { throw new Error(`film « ${name} » : extraction impossible depuis ${basename(input[input.length - 1])} — ${why(e)}`); } finally { wipe(); }
}

async function film(name, d, stamps, script, force) {
  const warnings = [];
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`sequences.json : nom de film invalide « ${name} » (minuscules, chiffres, tirets)`);
  if (!Number.isInteger(d.count) || d.count < 1 || d.count > 999 || !(d.width > 0) || !(d.height > 0)) throw new Error(`sequences.json : « ${name} » demande count (1 … 999), width et height`);
  const dir = join(SEQ_DIR, name), dirM = join(dir, 'm'), all = Array.from({ length: d.count }, (_, i) => i);
  const G = layout(d), GM = layout(d, true), nM = GM.count, scaleM = `scale=${GM.w}:${GM.h}:flags=lanczos`;
  let sources, full, mobile; // full / mobile : fabriquent les images et renvoient ce qui a été fait
  if (d.source === 'frames') {
    sources = all.map((i) => join(SITE, 'frames', 'f_' + file(i + 1)));
    const input = ['-start_number', '1', '-i', join(SITE, 'frames', 'f_%03d.jpg')];
    full = async () => {
      const p = await probe(name, sources[0]);
      if (p.width !== d.width || p.height !== d.height) throw new Error(`film « ${name} » : images en ${p.width}×${p.height}, sequences.json annonce ${d.width}×${d.height}`);
      const avg = sources.reduce((s, f) => s + statSync(f).size, 0) / sources.length; // la qualité des originaux, au même poids
      return 'q' + (await extract(name, input, all, G, '', dir, avg));
    };
    mobile = async () => 'q' + (await extract(name, input, all.filter((i) => i % 2 === 0), GM, scaleM, dirM, POIDS.m));
  } else if (d.source === 'video') {
    if (typeof d.video !== 'string' || !/^[a-z0-9-]+$/.test(d.video)) throw new Error(`sequences.json : « ${name} » demande video (nom du film dans site/video, sans extension)`);
    sources = [join(SITE, 'video', d.video + '.mp4')];
    let picks; // sondé une seule fois, et seulement s'il faut extraire
    const plan = () => (picks ??= probe(name, sources[0]).then((p) => {
      if (p.total < d.count) throw new Error(`film « ${name} » : ${d.count} images demandées, la vidéo n'en compte que ${p.total}`);
      if (Math.abs(p.width / p.height / (d.width / d.height) - 1) > 0.004) warnings.push(`film « ${name} » : la vidéo est en ${p.width}×${p.height}, sequences.json annonce ${d.width}×${d.height} — proportions différentes, l'image est déformée (corriger width / height)`);
      return { list: all.map((i) => (d.count === 1 ? 0 : Math.round((i * (p.total - 1)) / (d.count - 1)))), scale: p.width === d.width && p.height === d.height ? '' : `scale=${d.width}:${d.height}:flags=lanczos` };
    }));
    full = async () => { const p = await plan(); return 'q' + (await extract(name, ['-i', sources[0]], p.list, G, p.scale, dir, POIDS.full)); };
    mobile = async () => { const p = await plan(); return 'q' + (await extract(name, ['-i', sources[0]], p.list.filter((_, i) => i % 2 === 0), GM, scaleM, dirM, POIDS.m)); };
  } else throw new Error(`sequences.json : « ${name} » a une source inconnue (${d.source}) — « frames » ou « video »`);

  const missing = sources.find((f) => !existsSync(f));
  if (missing && d.optional) return { name, skipped: true, absent: missing, done: false, warnings, line: `${name} : ignoré, source absente pour l'instant (${missing})` };
  if (missing) throw new Error(`film « ${name} » : source introuvable (${missing})`);
  // empreinte : format des planches, ce script, la ligne du film, l'état de la source (taille et date)
  const stamp = createHash('sha1').update(JSON.stringify([FORMAT, script, { ...d, optional: undefined }, sources.map((f) => { const s = statSync(f); return [s.size, s.mtimeMs]; })])).digest('hex');
  try {
    const [a, b] = await Promise.all([[name, dir, G.sheets, full], [name + '/m', dirM, GM.sheets, mobile]].map(async ([key, to, n, make]) => {
      if (!force && stamps[key] === stamp && complete(to, n)) return 'à jour';
      delete stamps[key]; const made = await make(); stamps[key] = stamp; return made;
    }));
    return { name, skipped: false, warnings, count: d.count, countMobile: nM, bytes: weight(dir), bytesMobile: weight(dirM), done: a !== 'à jour' || b !== 'à jour', sheets: G.sheets, sheetsMobile: GM.sheets, line: `${name} : ${d.count} images en ${G.sheets} planches, ${ko(weight(dir))} Ko (${a}) · téléphone ${nM} images en ${GM.sheets} planches, ${ko(weight(dirM))} Ko (${b})` };
  } catch (e) {
    if (!d.optional) throw e;
    return { name, skipped: true, done: false, warnings: [...warnings, `${e.message} — film ignoré pour l'instant (dépôt en cours ?)`], line: `${name} : ignoré, source illisible pour l'instant` };
  }
}

/** prépare tous les films de `sequences.json` ; lève une erreur claire si ffmpeg ou une source manque (sauf film "optional" : `skipped`) */
export async function buildSequences({ force = false } = {}) {
  tools();
  let defs, stamps = {};
  try { defs = JSON.parse(readFileSync(LIST, 'utf8')); } catch (e) { throw new Error(`sequences.json illisible — ${e.message}`); }
  try { stamps = JSON.parse(readFileSync(STAMPS, 'utf8')); } catch { /* première fois, ou cache effacé : tout est refait */ }
  const before = JSON.stringify(stamps), script = createHash('sha1').update(readFileSync(self)).digest('hex');
  try { return await Promise.all(Object.entries(defs).map(([name, d]) => film(name, d, stamps, script, force))); }
  finally { if (JSON.stringify(stamps) !== before) { mkdirSync(dirname(STAMPS), { recursive: true }); writeFileSync(STAMPS, JSON.stringify(stamps, null, 1)); } }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { for (const f of await buildSequences({ force: process.argv.includes('--force') })) { console[f.skipped ? 'warn' : 'log']((f.skipped ? 'ATTENTION — ' : '') + f.line); f.warnings.forEach((w) => console.warn(`ATTENTION — ${w}`)); } }
  catch (e) { console.error(`films : ${e.message}`); process.exit(1); }
}
