/* Parcours du site sur le build (`npm run build --workspace apps/site` d'abord) :
   films qui réagissent au défilement, services, langues et sens de lecture, débordement, demande, mouvement réduit, téléphone.
   node apps/site/e2e/site.mjs */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4179, BASE = `http://127.0.0.1:${PORT}/`;
const res = []; const ok = (name, cond, info = '') => res.push((cond ? 'PASS ' : 'FAIL ') + name + (!cond && info !== '' ? ' — ' + info : ''));

const server = spawn(process.execPath, [join(root, '..', '..', 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const up = async () => { for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE)).ok) return; } catch { /* pas encore prêt */ } await new Promise((r) => setTimeout(r, 250)); } throw new Error('serveur de prévisualisation indisponible'); };
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const settle = (p, ms = 700) => p.waitForTimeout(ms);
const scrollTo = async (p, y, ms = 900) => { await p.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), y); await settle(p, ms); };
const topOf = (p, sel) => p.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + scrollY, sel);
/** Empreinte grossière de ce qu'un canvas montre (moyenne de quelques pixels). */
const look = (p, sel) => p.evaluate((s) => { const c = document.querySelector(s); const x = c.getContext('2d'); const pts = [[0.2, 0.3], [0.5, 0.5], [0.8, 0.4], [0.5, 0.8], [0.35, 0.6]]; return pts.map(([a, b]) => [...x.getImageData(Math.floor(c.width * a), Math.floor(c.height * b), 1, 1).data.slice(0, 3)].join(',')).join('|'); }, sel);

let browser;
try {
  await up();
  browser = await chromium.launch();
  const errs = [];

  // ---- ordinateur
  let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  let p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE); await p.waitForFunction(() => !document.body.classList.contains('loading'), null, { timeout: 9000 });
  ok('chargement terminé, titre en français', (await p.textContent('.seuil-title')).includes('Toutes les portes de Paris'));
  ok('le logo n’apparaît qu’une fois, dans la barre du haut', (await p.$$eval('svg path[d^="M452 -6"]', (e) => e.map((x) => !!x.closest('.nav-logo')))).join() === 'true');
  ok('huit services dans la liste et dans le formulaire', (await p.$$('#svcList li')).length === 8 && (await p.$$('#f-service option')).length === 8);
  ok('pas de débordement horizontal (français)', (await overflow(p)) <= 1, await overflow(p));

  // Le seuil : la porte s'ouvre avec le défilement, les textes se relaient.
  await p.waitForFunction(() => { const c = document.querySelector('#porte'); return c.width > 0 && c.getContext('2d').getImageData(c.width >> 1, c.height >> 1, 1, 1).data[3] > 0; }, null, { timeout: 9000 });
  const seuilH = await p.evaluate(() => document.querySelector('#top').offsetHeight - innerHeight);
  const a0 = await look(p, '#porte');
  await scrollTo(p, seuilH * 0.45, 1400); const a1 = await look(p, '#porte');
  ok('le film d’ouverture avance avec le défilement', a0 !== a1, a0);
  ok('le premier texte s’efface en cours de route', (await p.evaluate(() => +getComputedStyle(document.querySelector('#seuilA')).opacity)) < 0.05);
  await scrollTo(p, seuilH * 0.95, 1400); const a2 = await look(p, '#porte');
  ok('la porte continue de s’ouvrir jusqu’au bout', a1 !== a2);
  ok('le second texte arrive quand le hall se découvre', (await p.evaluate(() => +getComputedStyle(document.querySelector('#seuilB')).opacity)) > 0.9);
  ok('le filet de progression avance', (await p.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('#progress')).transform).a)) > 0.02);

  // Les services : la ligne lue s'éclaire, la porte change de film.
  const li5 = await topOf(p, '#svcList li[data-i="5"]');
  await scrollTo(p, li5 - 900 * 0.5, 1200);
  ok('la ligne en cours de lecture s’éclaire', await p.evaluate(() => document.querySelector('#svcList li[data-i="5"]').classList.contains('on') && document.querySelectorAll('#svcList li.on').length === 1));
  ok('la porte montre le film du service en cours', await p.evaluate(() => { const c = document.querySelector('#svcArch canvas'); return document.querySelector('#svcArch img').src.endsWith('/salon-poster.jpg') && !c.hidden && c.dataset.seq === 'porte-sejour'; }), await p.evaluate(() => document.querySelector('#svcArch canvas').dataset.seq));
  // Le film de la porte avance pendant qu'on lit la ligne.
  const s0 = await look(p, '#svcArch canvas');
  await scrollTo(p, li5 - 900 * 0.5 + 120, 1200);
  ok('le film de la porte avance avec la lecture', s0 !== (await look(p, '#svcArch canvas')), s0);

  // L'heure bleue : le second film avance lui aussi.
  const heure = await topOf(p, '#heure'); const heureH = await p.evaluate(() => document.querySelector('#heure').offsetHeight - innerHeight);
  await scrollTo(p, heure + heureH * 0.1, 1400); const h0 = await look(p, '#rivoli');
  await scrollTo(p, heure + heureH * 0.9, 1400); const h1 = await look(p, '#rivoli');
  ok('le second film avance avec le défilement', h0 !== h1, h0);
  ok('sa légende est lisible', (await p.evaluate(() => +getComputedStyle(document.querySelector('#heureText')).opacity)) > 0.9);

  await scrollTo(p, 0, 600);
  for (const [l, dir, mot] of [['en', 'ltr', 'Every door in Paris'], ['es', 'ltr', 'París'], ['ar', 'rtl', 'باريس']]) {
    await p.click(`[data-lang="${l}"]`); await settle(p, 900);
    ok(`langue ${l} : sens ${dir}, textes traduits`, (await p.evaluate(() => document.documentElement.dir)) === dir && (await p.textContent('.seuil-title')).includes(mot));
    ok(`langue ${l} : pas de débordement horizontal`, (await overflow(p)) <= 1, await overflow(p));
    const vides = await p.$$eval('[data-i18n]', (els) => els.filter((e) => !e.textContent.trim()).map((e) => e.dataset.i18n));
    ok(`langue ${l} : aucun texte manquant`, vides.length === 0, vides.join(','));
  }
  await p.click('[data-lang="fr"]'); await settle(p, 700);

  await p.evaluate(() => document.querySelector('#askForm').scrollIntoView({ behavior: 'instant', block: 'center' })); await settle(p);
  await p.fill('#f-name', 'Sophie Laurent'); await p.selectOption('#f-service', 'van'); await p.fill('#f-date', '2026-11-20'); await p.fill('#f-guests', '6'); await p.fill('#f-msg', 'Arrivée à CDG à 9 h.');
  const msg = await p.textContent('#preview'); const wa = decodeURIComponent(await p.getAttribute('#wa', 'href'));
  ok('le message se compose (nom, service, date, passagers, occasion)', ['Sophie Laurent', 'Van VIP', '20 novembre', '6 passagers', 'Arrivée à CDG'].every((k) => msg.includes(k)), msg);
  ok('le bouton ouvre WhatsApp avec ce message', wa.startsWith('https://wa.me/') && wa.includes('Sophie Laurent'));
  ok('« Être rappelé » reste caché sans CRM derrière le site', !(await p.isVisible('#callback')));
  await p.evaluate(() => document.querySelector('#svcList li[data-i="7"] [data-ask]').click()); await settle(p, 300);
  ok('« Demander ce service » choisit le service dans le formulaire', (await p.inputValue('#f-service')) === 'clip');
  ok('lien prestataires', (await p.getAttribute('#partnerLink', 'href')).endsWith('/prestataires'));
  ok('aucune erreur JavaScript', errs.length === 0, errs.join(' | '));
  await ctx.close();

  // ---- mouvement réduit : une page ordinaire, tout est lisible
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); p = await ctx.newPage(); await p.goto(BASE); await settle(p, 1800);
  ok('mouvement réduit : rien ne reste caché', (await p.evaluate(() => [...document.querySelectorAll('.reveal, #manifesto .w, [data-lines] .w > span, #svcList li, #seuilB, #heureText')].filter((e) => +getComputedStyle(e).opacity < 0.99 || getComputedStyle(e).visibility === 'hidden').length)) === 0);
  ok('mouvement réduit : pas de longue section épinglée', (await p.evaluate(() => document.querySelector('#top').offsetHeight)) < 900 * 2.2);
  ok('mouvement réduit : le film d’ouverture montre une image', (await p.evaluate(() => { const c = document.querySelector('#porte'); return c.width > 0 && c.getContext('2d').getImageData(c.width >> 1, c.height >> 1, 1, 1).data[3] > 0; })));
  await ctx.close();

  // ---- téléphone
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' }); p = await ctx.newPage(); await p.goto(BASE); await settle(p, 2600);
  const H = await p.evaluate(() => document.documentElement.scrollHeight); let worst = 0;
  for (const f of [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1]) { await scrollTo(p, Math.round((H - 844) * f), 500); worst = Math.max(worst, await overflow(p)); }
  ok('téléphone : pas de débordement horizontal sur toute la page', worst <= 1, worst);
  const petits = await p.$$eval('.btn, .langs button, .faq summary, .link', (els) => els.filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43.5).map((e) => e.className + ' « ' + e.textContent.trim().slice(0, 24) + ' » :' + Math.round(e.getBoundingClientRect().height)));
  ok('téléphone : boutons et liens d’au moins 44 px', petits.length === 0, petits.join(', '));
  await p.click('[data-lang="ar"]'); await settle(p, 900);
  ok('téléphone, arabe : pas de débordement horizontal', (await overflow(p)) <= 1, await overflow(p));
  await ctx.close();
} catch (e) {
  ok('exécution du parcours', false, e.message.split('\n')[0]);
} finally {
  if (browser) await browser.close();
  server.kill();
}
console.log(res.join('\n'));
const fails = res.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${res.length - fails}/${res.length} PASS`);
process.exit(fails ? 1 : 0);
