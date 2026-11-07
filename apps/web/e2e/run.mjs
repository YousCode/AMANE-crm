/* Parcours Playwright (8 parcours × 1440×900 et 390×844 + absence de débordement horizontal sur chaque route à 390×844).
   Lancer le serveur de développement (npm run dev, msw actif) puis : node e2e/run.mjs */
import { newPage, login, closeBrowser, DESKTOP, MOBILE, BASE, assertNoErrors, noOverflow, shot } from './lib.mjs';

const ROUTES = ['/', '/messages', '/messages/971501234567', '/demandes', '/planning', '/clients', '/carnet', '/flotte', '/flotte/rentabilite', '/finances', '/relances', '/contrats', '/services', '/reglages', '/aide'];
const mock = (page, code) => page.evaluate(code);
const isMobile = (vp) => !!vp.isMobile;

const journeys = {
  async login(page, vp) {
    await page.goto(BASE + '/'); await page.waitForSelector('[data-testid="tile-amel"]'); await page.click('[data-testid="tile-youssouf"]');
    for (const k of '0000') await page.click(`button[aria-label="${k}"]`);
    await page.waitForSelector('text=Code incorrect.');
    for (const k of '1234') await page.click(`button[aria-label="${k}"]`);
    await page.waitForFunction(() => document.querySelector('[data-testid="live"]')?.textContent?.includes('Synchronisé'));
    if (!(await page.textContent('body')).includes('Youssouf')) throw new Error('prénom absent après connexion');
    await page.reload(); await page.waitForFunction(() => document.querySelector('[data-testid="live"]')?.textContent?.includes('Synchronisé'));
  },
  async 'créer demande'(page, vp) {
    await login(page);
    if (isMobile(vp)) await page.click('button[aria-label="Nouvelle demande"]'); else await page.click('text=Nouvelle demande');
    await page.waitForSelector('[data-testid="drawer"]');
    await page.fill('#f_titre', 'Parcours — Urus week-end'); await page.selectOption('#f_clientId', 'c_laurent'); await page.selectOption('#f_vehiculeId', 'urus'); await page.fill('#f_montant', '2500');
    await page.click('[data-testid="save"]'); await page.waitForSelector('text=Enregistré');
    await page.waitForFunction(() => [...window.__amaneMock.state().db.missions.values()].some((m) => m.titre === 'Parcours — Urus week-end'));
    await page.click('[data-testid="drawer"] button[aria-label="Fermer"]'); await page.goto(BASE + '/demandes');
    await page.waitForSelector('text=Parcours — Urus week-end');
  },
  async 'drag statut'(page, vp) {
    await login(page); await page.goto(BASE + '/demandes');
    if (isMobile(vp)) {
      await page.waitForSelector('[data-testid="lcard-m_shop"]'); const b = await page.locator('[data-testid="lcard-m_shop"]').boundingBox();
      const sx = b.x + b.width * .62, sy = b.y + 22; /* sur le titre : les boutons ronds (appeler, WhatsApp, itinéraire) font désormais 44 px et ne déclenchent pas le balayage */ await page.mouse.move(sx, sy); await page.mouse.down(); for (let i = 1; i <= 8; i++) await page.mouse.move(sx - i * 20, sy); await page.mouse.up();
    } else {
      await page.waitForSelector('[data-testid="card-m_shop"]'); const c = await page.locator('[data-testid="card-m_shop"]').boundingBox(); const col = await page.locator('[data-testid="col-proposition"]').boundingBox();
      await page.mouse.move(c.x + 40, c.y + 20); await page.mouse.down(); await page.mouse.move(c.x + 60, c.y + 30); for (let i = 1; i <= 6; i++) await page.mouse.move(c.x + 60 + ((col.x + 80 - c.x) * i) / 6, c.y + 60); await page.mouse.up();
    }
    await page.waitForFunction(() => window.__amaneMock.state().db.missions.get('m_shop')?.statut === 'proposition', null, { timeout: 8000 });
    if (!isMobile(vp)) { const n = await page.locator('[data-testid="col-proposition"] [data-testid="card-m_shop"]').count(); if (n !== 1) throw new Error('carte non déplacée dans la colonne Proposition'); }
  },
  async 'envoyer message traduit'(page, vp) {
    await login(page); await page.goto(BASE + '/messages/971501234567'); await page.waitForSelector('[data-testid="thread"]');
    const tr = await page.locator('[data-testid="translation"]').count(); if (tr < 2) throw new Error('traductions FR absentes sous les messages arabes');
    await page.fill('[data-testid="composer"]', 'Bonjour, votre Urus avec chauffeur est confirmé pour samedi 20 h.'); await page.click('[data-testid="send"]');
    await page.waitForSelector('[data-testid="preview"]'); const pv = await page.inputValue('[data-testid="preview"] textarea'); if (!/مرحباً/.test(pv)) throw new Error('aperçu non traduit en arabe : ' + pv);
    await page.click('[data-testid="send-translated"]');
    await page.waitForFunction(() => { const o = window.__amaneMock.state().outbox; return o.length && o[o.length - 1].lang === 'AR' && /مرحباً/.test(o[o.length - 1].text); });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="msg-out"]')].some((b) => b.textContent.includes('Bonjour, votre Urus')));
    await page.waitForFunction(() => [...document.querySelectorAll('.tk')].some((t) => t.textContent === '✓✓'), null, { timeout: 5000 });
    // note interne
    await page.click('[data-testid="note-toggle"]'); await page.fill('[data-testid="composer"]', 'Youssouf, peux-tu vérifier l’Urus ?'); await page.click('[data-testid="send"]');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="msg-note"]').length >= 2);
  },
  async 'accepter devis via lien'(page, vp) {
    await login(page); await page.goto(BASE + '/demandes');
    if (isMobile(vp)) { await page.click('[data-testid="lcard-m_g63"]'); } else await page.click('[data-testid="card-m_g63"]');
    await page.waitForSelector('[data-testid="drawer"]'); await page.click('[data-testid="tab-devis"]'); await page.waitForSelector('[data-testid="dv-share"]'); await page.click('[data-testid="dv-share"]');
    await page.waitForSelector('text=Lien créé'); const link = await page.textContent('[data-testid="drawer"] code'); const token = link.split('/d/')[1]; if (!token || token.length !== 24) throw new Error('jeton invalide : ' + link);
    // Le client ouvre la page publique et accepte (même origine : msw répond).
    const html = await page.evaluate(async (t) => (await fetch('/d/' + t)).text(), token); if (!html.includes('Quotation D-2026-0013') && !html.includes('D-2026-0013')) throw new Error('page publique du devis incomplète');
    await page.evaluate(async (t) => { await fetch('/d/' + t + '/accepter', { method: 'POST' }); }, token);
    await page.waitForFunction(() => window.__amaneMock.state().db.missions.get('m_g63').devis.statut === 'accepte');
    await page.click('[data-testid="drawer"] button[aria-label="Fermer"]');
    if (!isMobile(vp)) await page.click('[data-testid="card-m_g63"]'); else await page.click('[data-testid="lcard-m_g63"]');
    await page.click('[data-testid="tab-devis"]'); await page.waitForFunction(() => document.querySelector('#f_devis_statut')?.value === 'accepte');
  },
  async relances(page, vp) {
    await login(page); await page.goto(BASE + '/relances'); await page.waitForSelector('[data-testid^="relance-"]');
    const n = await page.locator('[data-testid^="relance-"]').count(); if (n < 2) throw new Error('moins de deux relances');
    if (!(await page.locator('[data-testid="relance-facture"]').count())) throw new Error('facture en retard absente');
    const avant = await page.evaluate(() => window.__amaneMock.state().relances.length);
    await page.locator('[data-testid="relance-facture"] [data-testid="relancer"]').first().click();
    await page.waitForSelector('text=/Relance envoyée/');
    if (await page.evaluate(() => window.__amaneMock.state().relances.length) !== avant + 1) throw new Error('relance non enregistrée');
    await page.click('[data-testid="vue-faites"]'); await page.waitForSelector('[data-testid="relance-facture"] [data-testid="bloquee"]');
  },
  async 'planning conflit'(page, vp) {
    await login(page);
    if (isMobile(vp)) await page.click('button[aria-label="Nouvelle demande"]'); else await page.click('text=Nouvelle demande');
    await page.waitForSelector('[data-testid="drawer"]');
    const g = await page.evaluate(() => window.__amaneMock.state().db.missions.get('m_g63'));
    await page.fill('#f_titre', 'Conflit G 63'); await page.selectOption('#f_clientId', 'c_chen'); await page.selectOption('#f_vehiculeId', 'g63'); await page.fill('#f_debut', g.debut); await page.fill('#f_fin', g.fin); await page.selectOption('#f_statut', 'confirmee');
    await page.waitForSelector('[data-testid="clash"]'); await page.click('[data-testid="save"]'); await page.waitForSelector('text=Enregistré'); await page.click('[data-testid="drawer"] button[aria-label="Fermer"]');
    await page.goto(BASE + '/planning'); if (isMobile(vp)) await page.click('text=Grille');
    await page.waitForSelector('[data-clash="1"]'); const n = await page.locator('[data-clash="1"]').count(); if (n < 2) throw new Error('conflit non signalé sur les deux barres');
  },
  async 'hors ligne'(page, vp) {
    await login(page);
    await mock(page, () => { window.__amaneMock.setOffline(true); window.dispatchEvent(new Event('offline')); });
    await page.goto(BASE + '/demandes', { waitUntil: 'domcontentloaded' });
    if (isMobile(vp)) await page.click('[data-testid="lcard-m_clip"]'); else await page.click('[data-testid="card-m_clip"]');
    await page.waitForSelector('[data-testid="drawer"]'); await page.fill('#f_lieu', 'Pont des Arts'); await page.click('[data-testid="save"]'); await page.waitForSelector('text=Enregistré');
    await page.waitForFunction(() => /Hors ligne — 1 modification en attente/.test(document.querySelector('[data-testid="live"]')?.textContent || ''), null, { timeout: 8000 });
    if (await page.evaluate(() => window.__amaneMock.state().db.missions.get('m_clip').lieu) === 'Pont des Arts') throw new Error('écrit sur le serveur malgré le mode hors ligne');
    await mock(page, () => { window.__amaneMock.setOffline(false); window.dispatchEvent(new Event('online')); });
    await page.waitForFunction(() => /Synchronisé/.test(document.querySelector('[data-testid="live"]')?.textContent || ''), null, { timeout: 15000 });
    await page.waitForFunction(() => window.__amaneMock.state().db.missions.get('m_clip').lieu === 'Pont des Arts');
  },
};

async function run() {
  const results = []; const only = process.argv[2];
  for (const [name, fn] of Object.entries(journeys)) {
    if (only && !name.includes(only)) continue;
    for (const [vl, vp] of [['1440×900', DESKTOP], ['390×844', MOBILE]]) {
      const label = `${name} @ ${vl}`; const { ctx, page, errors } = await newPage(vp);
      try { await fn(page, vp); /* hors ligne : le navigateur journalise lui-même les requêtes coupées (net::ERR_FAILED), ce n'est pas une erreur de l'application */ assertNoErrors(errors, label, name === 'hors ligne' ? /^Failed to load resource: net::ERR_FAILED$/ : undefined); results.push([label, 'ok']); console.log('✓', label); }
      catch (e) { results.push([label, 'ÉCHEC']); console.log('✗', label, '—', e.message.split('\n').slice(0, 4).join(' | ')); await shot(page, 'fail-' + label.replace(/[^a-z0-9]+/gi, '-')); }
      finally { await ctx.close(); }
    }
  }
  if (!only) {
    const { ctx, page, errors } = await newPage(MOBILE); const bad = [];
    try { await login(page); for (const r of ROUTES) { await page.goto(BASE + r); await page.waitForTimeout(350); try { await noOverflow(page, r); } catch (e) { bad.push(e.message); } } assertNoErrors(errors, 'overflow'); }
    catch (e) { bad.push(e.message); } finally { await ctx.close(); }
    if (bad.length) { results.push(['pas de débordement horizontal (390×844)', 'ÉCHEC']); console.log('✗ débordement :', bad.join('\n  ')); } else { results.push(['pas de débordement horizontal (390×844)', 'ok']); console.log('✓ pas de débordement horizontal sur', ROUTES.length, 'routes @ 390×844'); }
  }
  await closeBrowser();
  const ko = results.filter((r) => r[1] !== 'ok').length; console.log(`\n${results.length - ko}/${results.length} parcours réussis`); process.exit(ko ? 1 : 0);
}
run().catch(async (e) => { console.error(e); await closeBrowser(); process.exit(1); });
