// Le CRM historique (crm/index.html) fonctionne tel quel contre le serveur Express : connexion par PIN,
// création d'un client et d'une demande depuis l'interface, visibles dans /api/sync.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createApp } from '../src/app.js';

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { chromium = null; }

let api; let base; let browser;
before(async () => {
  for (const k of ['WHATSAPP_TOKEN', 'ANTHROPIC_API_KEY', 'TEAM_ALERT_NUMBERS', 'MONGODB_URI', 'AUTH_SECRET', 'AMANE_SETUP_CODE']) delete process.env[k];
  api = await createApp({ fake: true, devPins: 'amel:1234,aziz:1234' });
  const port = await api.listen(0, '127.0.0.1');
  base = `http://127.0.0.1:${port}`;
  if (chromium) browser = await chromium.launch();
});
after(async () => { if (browser) await browser.close(); await api.close(); });

test('ancien CRM servi par Express : connexion PIN, client + demande créés depuis l’interface, présents dans /api/sync', { skip: !chromium && 'playwright absent' }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.route('**', (r) => {
    const u = new URL(r.request().url());
    if (u.hostname.includes('fonts.g')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u.origin === base) return r.continue();
    return r.abort();
  });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base + '/crm');
  await p.waitForSelector('#login', { timeout: 10000 });
  assert.equal((await p.$$('#login .tile')).length, 3, 'trois tuiles');
  await p.click('#login [data-lgwho="amel"]');
  await p.waitForSelector('#lgPad');
  for (const k of '1234') await p.click(`#login [data-key="${k}"]`);
  await p.click('#login [data-key="ok"]');
  await p.waitForSelector('#login', { state: 'hidden', timeout: 10000 });
  assert.equal(await p.evaluate(() => localStorage.getItem('amane.me')), 'amel');
  await p.waitForFunction(() => ((document.querySelector('#live') || {}).textContent || '').includes('Synchronisé'), null, { timeout: 10000 });
  // Nouvelle demande + nouveau client depuis la fiche
  await p.evaluate(() => { location.hash = 'demandes'; });
  await p.waitForTimeout(500);
  await p.click('#newBtn');
  await p.waitForSelector('#f_titre');
  await p.fill('#f_titre', 'G 63 — dîner au Ritz');
  await p.selectOption('#f_clientId', '__new');
  await p.waitForSelector('#f_nom');
  await p.fill('#f_nom', 'M. Test Dupont');
  await p.fill('#f_tel', '+33 6 11 22 33 44');
  await p.click('[data-act="save"]');
  await p.waitForTimeout(600);
  await p.waitForSelector('#f_titre');
  await p.click('[data-act="save"]');
  await p.waitForTimeout(800);
  // Côté serveur
  const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: 'aziz', pin: '1234' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const deadline = Date.now() + 8000;
  let s;
  while (Date.now() < deadline) {
    s = await (await fetch(base + '/api/sync', { headers: { cookie } })).json();
    if (s.changes.missions.some((m) => m.titre === 'G 63 — dîner au Ritz') && s.changes.clients.some((c) => c.nom === 'M. Test Dupont')) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  const client = s.changes.clients.find((c) => c.nom === 'M. Test Dupont');
  const mission = s.changes.missions.find((m) => m.titre === 'G 63 — dîner au Ritz');
  assert.ok(client, 'client créé via le CRM : ' + JSON.stringify(s.changes.clients.map((c) => c.nom)));
  assert.equal(client.telNorm, '33611223344');
  assert.equal(client.updatedBy, 'amel');
  assert.ok(mission, 'demande créée via le CRM');
  assert.equal(mission.clientId, client.id);
  assert.equal(mission.statut, 'nouvelle');
  const act = await (await fetch(base + '/api/activity?docId=' + mission.id, { headers: { cookie } })).json();
  assert.equal(act.items.at(-1).resume, 'Création : G 63 — dîner au Ritz');
  // Une écriture d'Aziz arrive dans l'ancien CRM par la synchro (4 s)
  await fetch(base + '/api/doc/missions/mx', { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ titre: 'Rolls-Royce — mariage samedi', clientId: client.id, statut: 'nouvelle', service: 'chauffeur', debut: '2030-06-01T14:00', responsable: 'aziz' }) });
  await p.click('[data-act="close"]').catch(() => {});
  await p.waitForFunction(() => document.querySelector('#view').textContent.includes('Rolls-Royce — mariage samedi'), null, { timeout: 8000 });
  assert.deepEqual(errs, [], 'aucune erreur JavaScript dans la page');
  await ctx.close();
});
