/* Essai du moteur de films (`src/sequence.ts`) sur sa page d'essai (`e2e/sequence.html`), servie par Vite en mode dev sur un port libre
   (serveur à part : ni `vite.config.ts`, ni le cache du site) : planches sur disque, première image, chargement par planches,
   images dessinées (découpées dans leur planche), cadrage, planche manquante, repli sans createImageBitmap, économie de dessin,
   redimensionnement, destroy.
   node apps/site/e2e/sequence.mjs [--captures <dossier>]   (le dossier reçoit une vue du canvas à mi-parcours par film) */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createServer as tcp } from 'node:net';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSequences, layout, PER, SEQ_DIR } from '../scripts/frames.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALL = JSON.parse(readFileSync(join(root, 'sequences.json'), 'utf8'));
let FILMS = ALL; // moins les films "optional" dont la source n'est pas encore là
const shots = process.argv.includes('--captures') ? process.argv[process.argv.indexOf('--captures') + 1] : '';
const res = []; const ok = (name, cond, info = '') => res.push((cond ? 'PASS ' : 'FAIL ') + name + (!cond && info !== '' ? ' — ' + info : ''));
const part = async (name, fn) => { try { await fn(); } catch (e) { ok(`${name} : exécution`, false, e.message.split('\n')[0]); } };
const file = (n) => String(n).padStart(3, '0');
const sheetOf = (n) => 's' + String(Math.ceil(n / PER)).padStart(2, '0') + '.jpg'; // planche de l'image n (à partir de 1)
const at = (p, n) => Math.round(p * (n - 1)) + 1; // numéro de l'image attendue à l'avancement p
const SAME = 2, OTHER = 3; // écart moyen par couche (0…255) : même image en dessous de SAME ; une autre image s'en écarte d'au moins OTHER fois plus

// ---- dans la page
const frames = (p, n = 2) => p.evaluate((k) => new Promise((r) => { const f = () => (k-- > 0 ? requestAnimationFrame(f) : r()); f(); }), n);
const set = async (p, v) => { await p.evaluate((x) => window.essai.seq.set(x), v); await frames(p); };
/** taille du canvas, points non peints (bandes vides), contraste, signature de 24 × 16 points */
const look = (p, sel = '#film') => p.evaluate((s) => {
  const c = document.querySelector(s), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, sig = [];
  let holes = 0, min = 255, max = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) holes++;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) { const k = (Math.floor(((y + 0.5) * c.height) / 16) * c.width + Math.floor(((x + 0.5) * c.width) / 24)) * 4; const l = (d[k] + d[k + 1] + d[k + 2]) / 3; sig.push(l); min = Math.min(min, l); max = Math.max(max, l); }
  return { w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight, holes, contrast: max - min, sig };
}, sel);
const dist = (a, b) => a.sig.reduce((s, v, i) => s + Math.abs(v - b.sig[i]), 0) / a.sig.length;
/** écart moyen entre le canvas et l'image n du film (découpée dans sa planche selon layout() de frames.mjs) cadrée « cover »
    autour de (fx, fy) par un calcul indépendant du moteur */
const gap = (p, a) => p.evaluate(async ({ film, mobile, n, fx = 0.5, fy = 0.5, g, PER }) => {
  const c = document.querySelector('#film'), img = new Image();
  img.src = `/media/seq/${film}/${mobile ? 'm/' : ''}s${String(Math.ceil(n / PER)).padStart(2, '0')}.jpg`; await img.decode();
  const j = (n - 1) % PER, one = document.createElement('canvas'); one.width = g.w; one.height = g.h;
  one.getContext('2d').drawImage(img, (j % 4) * g.cellW, Math.floor(j / 4) * g.cellH, g.w, g.h, 0, 0, g.w, g.h);
  const k = document.createElement('canvas'); k.width = c.width; k.height = c.height;
  const x = k.getContext('2d'); x.imageSmoothingQuality = 'high';
  const iw = g.w, ih = g.h, s = Math.max(k.width / iw, k.height / ih), sw = k.width / s, sh = k.height / s;
  x.drawImage(one, Math.min(Math.max(fx * iw - sw / 2, 0), iw - sw), Math.min(Math.max(fy * ih - sh / 2, 0), ih - sh), sw, sh, 0, 0, k.width, k.height);
  const A = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, B = x.getImageData(0, 0, c.width, c.height).data;
  let sum = 0; for (let i = 0; i < A.length; i += 4) sum += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
  return sum / ((A.length / 4) * 3);
}, { ...a, g: layout(ALL[a.film], !!a.mobile), PER });
/** le canvas montre l'image n, et pas une de ses voisines */
const shows = async (p, a, total, lost = 0) => {
  const g = await gap(p, a), near = [];
  for (const m of [a.n - 1, a.n + 1]) if (m >= 1 && m <= total && m !== lost) near.push(await gap(p, { ...a, n: m }));
  return { yes: g < SAME && near.every((v) => v > g * OTHER), info: `écart ${g.toFixed(2)}, voisines ${near.map((v) => v.toFixed(2)).join(' / ')}` };
};
const state = (p) => p.evaluate(() => { const e = window.essai; return { ready: e.ready, loaded: e.loaded, progress: e.progress, doneAtReady: e.doneAtReady, tReady: Math.round(e.tReady), tLoaded: Math.round(e.tLoaded) }; });
const until = (p, key, timeout) => p.waitForFunction((k) => window.essai && window.essai[k], key, { timeout });
const save = async (p, name) => { if (!shots) return; mkdirSync(shots, { recursive: true }); writeFileSync(join(shots, name + '.jpg'), Buffer.from((await p.evaluate(() => document.querySelector('#film').toDataURL('image/jpeg', 0.85))).split(',')[1], 'base64')); };

// ---- serveur
const freePort = () => new Promise((r, ko) => { const s = tcp(); s.on('error', ko); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => r(port)); }); });
const cache = mkdtempSync(join(tmpdir(), 'amane-seq-'));
let server, browser;
try {
  const built = await buildSequences(); // les images des films, si elles ne sont pas déjà prêtes
  const waiting = built.filter((f) => f.skipped).map((f) => f.name);
  FILMS = Object.fromEntries(Object.entries(ALL).filter(([name]) => !waiting.includes(name)));
  if (waiting.length) console.log(`films en attente de leur source, non essayés : ${waiting.join(', ')}\n`);
  for (const [film, d] of Object.entries(FILMS)) {
    const look = (sub) => readdirSync(join(SEQ_DIR, film, sub)).filter((f) => f.endsWith('.jpg'));
    const a = look(''), b = look('m'), G = layout(d), GM = layout(d, true);
    ok(`${film} : ${G.sheets} planches sur ordinateur, ${GM.sheets} sur téléphone, plus aucune image isolée`, a.length === G.sheets && b.length === GM.sheets && [...a, ...b].every((f) => /^s\d{2}\.jpg$/.test(f)), `${a.join(',')} | ${b.join(',')}`);
  }
  const PORT = await freePort(), BASE = `http://127.0.0.1:${PORT}/e2e/sequence.html`;
  server = await createServer({ configFile: false, root, base: './', logLevel: 'silent', cacheDir: cache, optimizeDeps: { noDiscovery: true, include: [] }, server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
  await server.listen();
  browser = await chromium.launch();
  const errs = [];
  const open = async (ctx, query, prepare) => { const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(`${query} : ${e.message}`)); if (prepare) await prepare(p); await p.goto(`${BASE}?${query}`); return p; };

  // ---- ordinateur, film par film
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  for (const [film, d] of Object.entries(FILMS)) {
    await part(film, async () => {
      const t0 = Date.now(), p = await open(desk, `film=${film}&manuel=1`);
      await until(p, 'ready', 8000);
      const tNav = Date.now() - t0, first = await look(p), s0 = await state(p);
      ok(`${film} : la première image s'affiche vite (${s0.tReady} ms après le script, ${tNav} ms après l'ouverture), avant les autres`, s0.tReady < 1000 && s0.doneAtReady <= 1 && first.holes === 0 && first.contrast > 30, JSON.stringify({ ...s0, progress: s0.progress.length, holes: first.holes, contrast: first.contrast }));
      await until(p, 'loaded', 30000);
      const s1 = await state(p), steps = s1.progress.map((x) => x[0]), G = layout(d);
      ok(`${film} : loaded se résout, onProgress compte en images jusqu'à ${d.count}, une fois par planche (${G.sheets})`, steps.length === G.sheets && steps.at(-1) === d.count && steps.every((v, i) => v > (steps[i - 1] ?? 0) && v - (steps[i - 1] ?? 0) <= PER) && s1.progress.every((x) => x[1] === d.count), steps.join(','));
      const views = [];
      for (const v of [0, 0.5, 1]) {
        await set(p, v); views.push(await look(p));
        const r = await shows(p, { film, n: at(v, d.count) }, d.count);
        ok(`${film} : set(${v}) dessine l'image ${file(at(v, d.count))} (planche ${sheetOf(at(v, d.count))})`, r.yes, r.info);
        if (v === 0.5) await save(p, film);
      }
      const ds = [dist(views[0], views[1]), dist(views[1], views[2]), dist(views[0], views[2])];
      ok(`${film} : set(0), set(0.5), set(1) donnent trois images différentes`, ds.every((v) => v > 1), ds.map((v) => v.toFixed(2)).join(' / '));
      const v = views[1];
      ok(`${film} : cadrage « cover » en 1440×900, aucune bande vide`, v.w === 1440 && v.h === 900 && v.holes === 0, `${v.w}×${v.h}, ${v.holes} points vides`);
      await p.close();
    });
  }

  // ---- ordre et débit du chargement
  await part('chargement', async () => {
    const asked = [], ended = []; let flying = 0, peak = 0, alone = true;
    const p = await open(desk, 'film=porte&manuel=1', async (pg) => {
      pg.on('request', (r) => { if (!r.url().includes('/media/seq/')) return; if (asked.length === 1 && ended.length === 0) alone = false; asked.push(r.url().split('/seq/')[1]); peak = Math.max(peak, ++flying); });
      for (const ev of ['requestfinished', 'requestfailed']) pg.on(ev, (r) => { if (r.url().includes('/media/seq/')) { ended.push(r.url()); flying--; } });
      await pg.route('**/media/seq/**', async (route) => { await new Promise((r) => setTimeout(r, 80)); await route.continue(); });
    });
    await until(p, 'loaded', 30000);
    ok('chargement : la planche de la première image part seule', asked[0] === 'porte/s01.jpg' && alone, asked.slice(0, 3).join(', '));
    ok('chargement : puis la dernière planche, puis le milieu du film', asked[1] === 'porte/s06.jpg' && asked.slice(2, 4).includes('porte/s05.jpg'), asked.join(', '));
    ok(`chargement : 6 planches demandées une seule fois, ${peak} de front au plus (limite 3)`, asked.length === 6 && new Set(asked).size === 6 && peak <= 3 && peak >= 2, `${asked.length} demandes, ${peak} de front`);
    await p.close();
  });

  // ---- images manquantes
  await part('image manquante', async () => {
    const lost = (...names) => (pg) => pg.route('**/media/seq/porte/**', (route) => (names.some((n) => route.request().url().endsWith(n)) ? route.fulfill({ status: 404, body: '' }) : route.continue()));
    let p = await open(desk, 'film=porte&manuel=1', lost('/s04.jpg'));
    await until(p, 'loaded', 30000);
    let s = await state(p);
    ok('planche s04 (images 025 à 032) en 404 : loaded se résout quand même, onProgress va jusqu\'à 48', s.loaded && s.progress.length === 6 && s.progress.at(-1)[0] === 48, JSON.stringify(s.progress));
    await set(p, 24 / 47);
    let r = await shows(p, { film: 'porte', n: 24 }, 48, 25);
    ok('planche s04 en 404 : set() vers l\'image 025 dessine la voisine chargée 024, sans bande vide', r.yes && (await look(p)).holes === 0, r.info);
    await set(p, 31 / 47);
    r = await shows(p, { film: 'porte', n: 33 }, 48, 32);
    ok('planche s04 en 404 : set() vers l\'image 032 dessine la voisine chargée 033', r.yes, r.info);
    await p.close();

    p = await open(desk, 'film=porte&manuel=1', lost('/s01.jpg'));
    await until(p, 'ready', 8000); await until(p, 'loaded', 30000);
    r = await shows(p, { film: 'porte', n: 9 }, 48, 8);
    ok('première planche en 404 : ready se résout, l\'image 009 (planche suivante) est dessinée', r.yes, r.info);
    await p.close();

    p = await open(desk, 'film=porte&manuel=1', (pg) => pg.route('**/media/seq/porte/**', (route) => route.fulfill({ status: 404, body: '' })));
    await until(p, 'loaded', 30000); s = await state(p); await set(p, 0.5);
    ok('toutes les planches en 404 : ready et loaded se résolvent, set() ne casse rien', s.ready && s.loaded && s.progress.length === 6);
    await p.close();
  });

  // ---- repli sans createImageBitmap : balise <img> puis découpe sur canvas hors écran
  await part('repli', async () => {
    const p = await open(desk, 'film=rivoli&manuel=1', (pg) => pg.addInitScript(() => { window.createImageBitmap = undefined; }));
    await until(p, 'ready', 8000); await until(p, 'loaded', 30000);
    const views = [];
    for (const v of [0.5, 1]) { await set(p, v); const r = await shows(p, { film: 'rivoli', n: at(v, 52) }, 52); views.push(r); }
    const v = await look(p);
    ok('sans createImageBitmap : les planches passent par <img> et un canvas, set(0.5) et set(1) (planche incomplète) dessinent la bonne image', views.every((r) => r.yes) && v.holes === 0, views.map((r) => r.info).join(' | '));
    await p.close();
  });

  // ---- économie de dessin, défilement, redimensionnement, destroy
  await part('dessin', async () => {
    const p = await open(desk, 'film=porte');
    await until(p, 'loaded', 30000); await frames(p);
    const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), max / 2); await frames(p, 3);
    let r = await shows(p, { film: 'porte', n: at(0.5, 48) }, 48);
    ok('défilement : à mi-page, le canvas montre l\'image du milieu', r.yes, r.info);
    await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), max); await frames(p, 3);
    r = await shows(p, { film: 'porte', n: 48 }, 48);
    ok('défilement : en bas de page, la dernière image', r.yes, r.info);

    // compteurs posés sur le canvas : dessins, changements de définition
    await p.evaluate(() => {
      const c = document.querySelector('#film'), ctx = c.getContext('2d'), draw = ctx.drawImage.bind(ctx), k = (window.count = { draws: 0, sizes: 0 });
      ctx.drawImage = (...a) => { k.draws++; return draw(...a); };
      for (const side of ['width', 'height']) { const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, side); Object.defineProperty(c, side, { configurable: true, get: () => d.get.call(c), set: (v) => { k.sizes++; d.set.call(c, v); } }); }
    });
    const count = () => p.evaluate(() => ({ ...window.count }));
    await p.evaluate(() => { for (let i = 0; i <= 200; i++) window.essai.seq.set(1 - i / 200); }); await frames(p, 3);
    let c = await count(); r = await shows(p, { film: 'porte', n: 1 }, 48);
    ok('201 set() dans la même image d\'animation : un seul dessin, le dernier demandé gagne', c.draws === 1 && r.yes, `${c.draws} dessins, ${r.info}`);
    await p.evaluate(async () => { for (let i = 0; i < 20; i++) { window.essai.seq.set(0); window.essai.seq.set(0.004); await new Promise((f) => requestAnimationFrame(f)); } });
    c = await count();
    ok('set() répété sur la même image : aucun nouveau dessin', c.draws === 1, `${c.draws} dessins`);
    await p.evaluate(async () => { for (let i = 0; i <= 120; i++) { window.essai.seq.set(i / 120); await new Promise((f) => requestAnimationFrame(f)); } }); await frames(p);
    c = await count();
    ok(`parcours du film en 120 images d'animation : ${c.draws - 1} dessins pour 48 images, canvas jamais redimensionné`, c.draws - 1 === 47 && c.sizes === 0, JSON.stringify(c));

    for (const [w, h] of [[1024, 600], [700, 1000]]) {
      await p.setViewportSize({ width: w, height: h }); await frames(p, 3);
      const v = await look(p); r = await shows(p, { film: 'porte', n: 48 }, 48);
      ok(`redimensionnement en ${w}×${h} : le canvas suit, image entière, aucune bande vide`, v.w === w && v.h === h && v.holes === 0 && r.yes, `${v.w}×${v.h}, ${v.holes} points vides, ${r.info}`);
    }
    c = await count();
    ok('redimensionnement : la définition ne change qu\'à ce moment (2 fois)', c.sizes === 4, `${c.sizes} affectations`);

    const first = await p.evaluate(async () => { // un set() posé dès la création choisit la première image chargée
      const seen = []; const obs = new PerformanceObserver((l) => seen.push(...l.getEntries().map((e) => e.name))); obs.observe({ type: 'resource' });
      const k = document.createElement('canvas'); k.id = 'autre'; k.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:180px'; document.body.append(k);
      const s = window.essai.createSequence({ canvas: k, name: 'cles', focus: (t) => [0.3 + 0.4 * t, 0.5] }); s.set(1); await s.ready; await s.loaded; obs.takeRecords().forEach((e) => seen.push(e.name)); obs.disconnect();
      const out = { first: seen.filter((u) => u.includes('/seq/cles/'))[0]?.split('/seq/')[1], w: k.width, h: k.height }; s.destroy(); k.remove(); return out;
    });
    ok('second film sur la même page, set(1) dès la création : la planche de la dernière image est chargée la première', first.first === 'cles/s07.jpg' && first.w === 320 && first.h === 180, JSON.stringify(first));

    const before = await count();
    const after = await p.evaluate(async () => {
      const s = window.essai.seq; s.destroy(); s.set(0.3); s.resize(); s.destroy(); await s.ready; await s.loaded;
      window.dispatchEvent(new Event('resize')); await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
      let unknown = ''; try { window.essai.createSequence({ canvas: document.createElement('canvas'), name: 'nexistepas' }); } catch (e) { unknown = e.message; }
      return { ...window.count, unknown };
    });
    ok('destroy() : plus aucun dessin, set() et resize() sans effet ni erreur, second destroy() sans effet', after.draws === before.draws && after.sizes === before.sizes, JSON.stringify(after));
    ok('film inconnu : erreur claire à la création', after.unknown.includes('nexistepas'), after.unknown);
    await p.close();
  });

  await part('destroy en cours de chargement', async () => {
    const asked = []; let failed = 0;
    const p = await open(desk, 'film=rivoli&manuel=1', async (pg) => {
      pg.on('request', (r) => { if (r.url().includes('/media/seq/')) asked.push(r.url()); });
      pg.on('requestfailed', (r) => { if (r.url().includes('/media/seq/')) failed++; });
      await pg.route('**/media/seq/**', async (route) => { await new Promise((r) => setTimeout(r, 250)); await route.continue().catch(() => {}); });
    });
    await until(p, 'ready', 8000); await p.waitForTimeout(80);
    const done = await p.evaluate(async () => { const s = window.essai.seq; s.destroy(); await s.loaded; return window.essai.progress.length; });
    const n = asked.length; await p.waitForTimeout(700);
    ok(`destroy() pendant le chargement : loaded se résout, les demandes en cours sont annulées (${failed}), aucune autre ne part`, done < 7 && asked.length === n && n <= 4 && failed >= 1, `${done} planches terminées, ${n} → ${asked.length} demandes, ${failed} annulées`);
    await p.close();
  });
  await desk.close();

  // ---- téléphone : version allégée, écran dense, cadrage en hauteur
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  for (const [film, d] of Object.entries(FILMS)) {
    await part(`téléphone, ${film}`, async () => {
      const asked = [], GM = layout(d, true), nM = GM.count;
      const p = await open(phone, `film=${film}&manuel=1`, (pg) => pg.on('request', (r) => { if (r.url().includes('/media/seq/')) asked.push(r.url().split('/seq/')[1]); }));
      await until(p, 'loaded', 30000);
      const s = await state(p);
      ok(`téléphone, ${film} : ${nM} images (une sur deux) en ${GM.sheets} planches, toutes dans m/`, asked.length === GM.sheets && asked.every((u) => u.startsWith(`${film}/m/s`)) && s.progress.at(-1)[0] === nM, `${asked.length} demandes, ${asked.filter((u) => !u.includes('/m/')).length} hors m/`);
      await set(p, 0.5);
      const v = await look(p), r = await shows(p, { film, mobile: true, n: at(0.5, nM) }, nM);
      ok(`téléphone, ${film} : cadrage « cover » en 390×844, définition × 2 au plus (780×1688), aucune bande vide`, v.w === 780 && v.h === 1688 && v.cssW === 390 && v.cssH === 844 && v.holes === 0 && r.yes, `${v.w}×${v.h}, ${v.holes} points vides, ${r.info}`);
      await save(p, `${film}-telephone`);
      await set(p, 1);
      const last = await shows(p, { film, mobile: true, n: nM }, nM);
      ok(`téléphone, ${film} : set(1) dessine la dernière image (${file(nM)}, ${nM % PER ? `planche incomplète de ${nM % PER}` : 'planche pleine'})`, last.yes, last.info);
      await p.close();
    });
  }
  await part('téléphone, point d\'intérêt', async () => {
    const p = await open(phone, 'film=porte&manuel=1&focus=0.2,0.5');
    await until(p, 'loaded', 30000); await set(p, 0);
    const left = await gap(p, { film: 'porte', mobile: true, n: 1, fx: 0.2 }), centre = await gap(p, { film: 'porte', mobile: true, n: 1 });
    ok('téléphone : le cadrage rogne autour du point d\'intérêt (focus 0.2, 0.5)', left < SAME && centre > left * OTHER, `écart ${left.toFixed(2)} au cadrage attendu, ${centre.toFixed(2)} au cadrage centré`);
    await save(p, 'porte-telephone-focus');
    const loose = await p.evaluate(async () => { // canvas sans taille CSS : il ne doit pas grossir à chaque passage
      const k = document.createElement('canvas'); k.style.cssText = 'position:static;width:auto;height:auto'; document.body.append(k);
      const s = window.essai.createSequence({ canvas: k, name: 'porte', mobile: true }); await s.ready; s.resize(); window.dispatchEvent(new Event('resize')); s.resize();
      const out = [k.width, k.height, k.clientWidth]; s.destroy(); k.remove(); return out;
    });
    ok('canvas sans taille CSS : sa définition ne grossit pas', loose[0] === 300 && loose[1] === 150, loose.join(' × '));
    await p.close();
  });
  await phone.close();

  ok('aucune erreur JavaScript sur l\'ensemble du parcours', errs.length === 0, errs.join(' | '));
} catch (e) {
  ok('exécution de l\'essai', false, e.message.split('\n')[0]);
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
  rmSync(cache, { recursive: true, force: true });
}
console.log(res.join('\n'));
const fails = res.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${res.length - fails}/${res.length} PASS`);
process.exit(fails ? 1 : 0);
