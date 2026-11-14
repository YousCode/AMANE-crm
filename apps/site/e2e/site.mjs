/* Parcours du nouveau site sur le build (`npm run build --workspace apps/site` d'abord) :
   langues et sens de lecture, débordement, portes, échange, demande, mouvement réduit, téléphone.
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

let browser;
try {
  await up();
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];

  // ---- ordinateur
  let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  let p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE); await p.waitForFunction(() => !document.body.classList.contains('loading'), null, { timeout: 8000 });
  ok('chargement terminé, titre en français', (await p.textContent('.hero-title')).includes('Toutes les portes de Paris'));
  ok('huit portes, huit services dans le formulaire', (await p.$$('.door')).length === 8 && (await p.$$('#f-service option')).length === 8);
  ok('pas de débordement horizontal (français)', (await overflow(p)) <= 1, await overflow(p));
  const top = await p.evaluate(() => document.querySelector('#services').getBoundingClientRect().top + scrollY);
  await p.evaluate((y) => window.scrollTo({ top: y + 800, behavior: 'instant' }), top); await settle(p, 1400);
  ok('les portes glissent de côté au défilement', (await p.evaluate(() => document.querySelector('#doorsTrack').getBoundingClientRect().left)) < -300);
  ok('le fond suit la section (crème sur les services)', (await p.evaluate(() => document.body.dataset.tone)) === 'cream');

  for (const [l, dir, mot] of [['en', 'ltr', 'Every door in Paris'], ['es', 'ltr', 'París'], ['ar', 'rtl', 'باريس']]) {
    await p.click(`[data-lang="${l}"]`); await settle(p, 900);
    ok(`langue ${l} : sens ${dir}, textes traduits`, (await p.evaluate(() => document.documentElement.dir)) === dir && (await p.textContent('.hero-title')).includes(mot));
    ok(`langue ${l} : pas de débordement horizontal`, (await overflow(p)) <= 1, await overflow(p));
    ok(`langue ${l} : aucun texte manquant`, (await p.$$eval('[data-i18n]', (els) => els.filter((e) => !e.textContent.trim()).map((e) => e.dataset.i18n))).length === 0, (await p.$$eval('[data-i18n]', (els) => els.filter((e) => !e.textContent.trim()).map((e) => e.dataset.i18n))).join(','));
  }
  await p.click('[data-lang="fr"]'); await settle(p, 700);

  await p.evaluate(() => document.querySelector('#phone').scrollIntoView({ behavior: 'instant', block: 'center' }));
  await p.waitForFunction(() => document.querySelectorAll('#thread .bub.show').length === 4, null, { timeout: 9000 });
  ok('l’échange par message se joue en entier', true);
  await p.click('#accept');
  ok('la proposition se scelle', await p.isVisible('#acceptOk') && !(await p.isVisible('#accept')));

  await p.evaluate(() => document.querySelector('#askForm').scrollIntoView({ behavior: 'instant', block: 'center' })); await settle(p);
  await p.fill('#f-name', 'Sophie Laurent'); await p.selectOption('#f-service', 'van'); await p.fill('#f-date', '2026-11-20'); await p.fill('#f-guests', '6'); await p.fill('#f-msg', 'Arrivée à CDG à 9 h.');
  const msg = await p.textContent('#preview'); const wa = decodeURIComponent(await p.getAttribute('#wa', 'href'));
  ok('le message se compose (nom, service, date, passagers, occasion)', ['Sophie Laurent', 'Van VIP', '20 novembre', '6 passagers', 'Arrivée à CDG'].every((k) => msg.includes(k)), msg);
  ok('le bouton ouvre WhatsApp avec ce message', wa.startsWith('https://wa.me/') && wa.includes('Sophie Laurent'));
  ok('« Être rappelé » reste caché sans CRM derrière le site', !(await p.isVisible('#callback')));
  await p.evaluate(() => document.querySelector('.door[data-service="clip"] [data-ask]').click()); await settle(p, 300);
  ok('« Demander ce service » sur une porte choisit le service', (await p.inputValue('#f-service')) === 'clip');
  ok('lien prestataires', (await p.getAttribute('#partnerLink', 'href')).endsWith('/prestataires'));
  ok('aucune erreur JavaScript', errs.length === 0, errs.join(' | '));
  await ctx.close();

  // ---- mouvement réduit
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); p = await ctx.newPage(); await p.goto(BASE); await settle(p, 1500);
  ok('mouvement réduit : rien ne reste caché', (await p.evaluate(() => [...document.querySelectorAll('.reveal, .bub, #manifesto .w, [data-lines] .w > span')].filter((e) => getComputedStyle(e).opacity === '0').length)) === 0);
  ok('mouvement réduit : les portes ne sont pas épinglées', !(await p.evaluate(() => document.querySelector('#services').classList.contains('pinned'))));
  await ctx.close();

  // ---- téléphone
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' }); p = await ctx.newPage(); await p.goto(BASE); await settle(p, 2400);
  const H = await p.evaluate(() => document.documentElement.scrollHeight); let worst = 0;
  for (const f of [0, 0.2, 0.4, 0.6, 0.8, 1]) { await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round((H - 844) * f)); await settle(p, 500); worst = Math.max(worst, await overflow(p)); }
  ok('téléphone : pas de débordement horizontal sur toute la page', worst <= 1, worst);
  ok('téléphone : les portes se font glisser au doigt', (await p.evaluate(() => { const v = document.querySelector('#doorsViewport'); return v.scrollWidth > v.clientWidth + 200 && getComputedStyle(v).overflowX === 'auto'; })));
  ok('téléphone : boutons d’au moins 44 px', (await p.$$eval('.btn, .langs button, .faq-list summary', (els) => els.filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43.5).length)) === 0);
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
