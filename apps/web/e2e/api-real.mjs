/* Vérification contre le vrai serveur (apps/api, FAKE_DB=1) qui sert apps/web/dist sous /app : connexion PIN, création d'une demande, lecture dans /api/sync, message WhatsApp simulé poussé en direct. */
import { newPage, closeBrowser, DESKTOP, assertNoErrors, shot } from './lib.mjs';
const API = process.env.API_BASE || 'http://localhost:3100';
const { ctx, page, errors } = await newPage(DESKTOP);
try {
  await page.goto(API + '/app/'); await page.waitForSelector('[data-testid="tile-amel"]', { timeout: 15000 }); await page.click('[data-testid="tile-amel"]');
  for (const k of '1234') await page.click(`button[aria-label="${k}"]`);
  await page.waitForFunction(() => /Synchronisé/.test(document.querySelector('[data-testid="live"]')?.textContent || ''), null, { timeout: 15000 });
  const live = await page.textContent('[data-testid="live"]'); console.log('live :', live);
  await page.click('text=Nouvelle demande'); await page.waitForSelector('[data-testid="drawer"]');
  await page.fill('#f_titre', 'Vrai serveur — G 63 samedi'); await page.selectOption('#f_vehiculeId', 'g63'); await page.fill('#f_lieu', 'Plaza Athénée'); await page.click('[data-testid="save"]'); await page.waitForSelector('text=Enregistré');
  await page.waitForFunction(() => /Synchronisé/.test(document.querySelector('[data-testid="live"]')?.textContent || ''), null, { timeout: 10000 });
  const sync = await page.evaluate(async () => (await fetch('/api/sync', { credentials: 'include' })).json());
  const m = sync.changes.missions.find((x) => x.titre === 'Vrai serveur — G 63 samedi'); if (!m) throw new Error('demande absente de /api/sync'); console.log('/api/sync : demande présente, id', m.id, 'updatedBy', m.updatedBy);
  await page.click('[data-testid="drawer"] button[aria-label="Fermer"]');
  // Message WhatsApp simulé → doit apparaître en direct (WebSocket) sans recharger.
  const r = await fetch(API + '/__dev/inbound', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ from: '971509998877', name: 'Test Direct', text: 'مرحباً، هل الفيراري متاحة غداً؟' }) }); console.log('inbound :', r.status);
  await page.waitForFunction(() => (document.querySelector('[aria-label="Messages (1)"], [aria-label^="Messages ("]') != null), null, { timeout: 15000 }).catch(() => { });
  await page.goto(API + '/app/messages'); await page.waitForSelector('[data-testid="conv-971509998877"]', { timeout: 15000 }); await page.click('[data-testid="conv-971509998877"]'); await page.waitForSelector('[data-testid="thread"]');
  const bubbles = await page.locator('[data-testid="msg-in"]').count(); console.log('fil ouvert, messages entrants :', bubbles);
  await page.fill('[data-testid="composer"]', 'Bonjour, oui, la Ferrari est disponible demain.'); await page.click('[data-testid="send"]');
  await page.waitForSelector('[data-testid="preview"], [data-testid="msg-out"]', { timeout: 15000 });
  const hasPrev = await page.locator('[data-testid="preview"]').count(); if (hasPrev) { await page.click('[data-testid="send-translated"]'); }
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="msg-out"]').length >= 1, null, { timeout: 15000 });
  const out = await fetch(API + '/__dev/outbox').then((x) => x.json()); console.log('outbox :', JSON.stringify(out).slice(0, 200));
  await shot(page, 'real-api-messages');
  assertNoErrors(errors, 'vrai serveur'); console.log('vrai serveur : OK');
} catch (e) { console.error('ÉCHEC vrai serveur :', e.message.split('\n')[0]); await shot(page, 'fail-real-api'); process.exitCode = 1; }
finally { await ctx.close(); await closeBrowser(); }
