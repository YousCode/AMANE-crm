/* Parcours Playwright (9 parcours × 1440×900 et 390×844 + absence de débordement horizontal sur chaque route à 390×844).
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
    await page.locator('[data-testid^="relance-"]').filter({ hasText: 'Envoyer' }).first().locator('text=Envoyer').click();
    await page.waitForSelector('[data-testid="thread"]'); const v = await page.inputValue('[data-testid="composer"]'); if (!v) throw new Error('brouillon de relance non prérempli');
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
  /* Prestataires : inscription validée → lien du portail → demande sur le van d'un loueur → dispo demandée → il répond « oui » sur son portail → « Disponible ». */
  async prestataire(page, vp) {
    const etat = (k) => page.waitForFunction((x) => document.querySelector('[data-testid="dispo-etat"]')?.dataset.etat === x, k, { timeout: 8000 });
    const ouvrir = async () => { if (isMobile(vp)) await page.click('[data-testid="lcard-m_seminaire"]', { position: { x: 60, y: 22 } }); else await page.click('[data-testid="card-m_seminaire"]'); await page.waitForSelector('[data-testid="dispo"]'); };
    await login(page, 'youssouf'); await page.goto(BASE + '/carnet');
    // 1. L'inscription reçue du site est en tête du Carnet : la valider crée le lien et ouvre la fiche.
    await page.waitForSelector('[data-testid="inscriptions"]'); await page.click('[data-testid="insc-ok-p_marais"]');
    await page.waitForSelector('[data-testid="portail-url"]'); const l0 = await page.textContent('[data-testid="portail-url"]'); if (!/\/p\/[A-Za-z0-9_-]{24}$/.test(l0)) throw new Error('lien du portail invalide après validation : ' + l0);
    await page.waitForFunction(() => { const p = window.__amaneMock.state().db.partenaires.get('p_marais'); return !p.aValider && !!p.portailToken; });
    await page.click('[data-testid="drawer"] button[aria-label="Fermer"]'); if (await page.locator('[data-testid="inscriptions"]').count()) throw new Error('l’inscription validée est encore à valider'); await page.waitForSelector('[data-testid="part-p_marais"]');
    // 2. Loueur déjà validé : créer le lien de son portail, prêt à envoyer par WhatsApp.
    await page.click('[data-testid="part-p_rivoli"] .main-t'); await page.waitForSelector('[data-testid="portail-btn"]'); await page.click('[data-testid="portail-btn"]'); await page.waitForSelector('text=Lien créé');
    const link = await page.textContent('[data-testid="portail-url"]'); const token = link.split('/p/')[1]; if (!token || token.length !== 24) throw new Error('lien invalide : ' + link);
    const wa = await page.getAttribute('[data-testid="portail"] a.btn', 'href'); if (!wa || !wa.startsWith('https://wa.me/33639980001?text=') || !decodeURIComponent(wa).includes(link)) throw new Error('lien WhatsApp du portail incorrect : ' + wa);
    const pj = await page.evaluate(async (t) => (await fetch('/api/portail/' + t)).json(), token); if (pj.partenaire?.nom !== 'Loueur Test Rivoli' || pj.vehicules.length !== 2) throw new Error('portail du prestataire incomplet');
    await page.click('[data-testid="drawer"] button[aria-label="Fermer"]');
    // 3. Demande sur son van, hors de ses jours déclarés : la dispo est à demander.
    await page.goto(BASE + '/demandes'); await ouvrir(); await etat('a_demander'); if (!/1.350.€/.test(await page.textContent('[data-testid="marge"]'))) throw new Error('marge absente');
    // Ordinateur : envoi automatique indisponible → message à envoyer soi-même ; téléphone : WhatsApp part tout seul.
    if (!isMobile(vp)) await mock(page, () => { window.__amaneMock.state().whatsappOn = false; });
    await page.click('[data-testid="dispo-btn"]'); await etat('attente');
    if (!isMobile(vp)) { await page.waitForSelector('[data-testid="dispo-msg"]'); const w = await page.getAttribute('[data-testid="dispo-wa"]', 'href'); if (!w || !w.includes('wa.me/33639980001') || !decodeURIComponent(w).includes('/p/' + token)) throw new Error('message WhatsApp au prestataire incorrect'); }
    else await page.waitForSelector('[data-testid="dispo-envoyee"]');
    await page.waitForFunction(() => (window.__amaneMock.state().db.missions.get('m_seminaire').dispoDemandes || [])[0]?.statut === 'envoyee');
    // 4. Le prestataire répond « oui » sur son portail (même origine : msw répond) : la fiche ouverte passe à « Disponible ».
    const r = await page.evaluate(async (t) => (await fetch(`/api/portail/${t}/demandes/m_seminaire`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vehiculeId: 'v_rivoli_v', reponse: 'oui' }) })).json(), token); if (!r.ok || r.statut !== 'oui') throw new Error('réponse du prestataire refusée');
    await etat('oui'); if (!(await page.textContent('[data-testid="dispo-etat"]')).includes('Disponible')) throw new Error('état « Disponible » absent'); if (await page.locator('[data-testid="dispo-btn"]').count()) throw new Error('bouton de demande encore affiché');
    // La fiche rouverte garde l'état, et la flotte compte le van comme libre sur ces jours.
    await page.click('[data-testid="drawer"] button[aria-label="Fermer"]'); await page.goto(BASE + '/demandes'); await ouvrir(); await etat('oui');
    if (!(await page.evaluate(() => (window.__amaneMock.state().db.vehicules.get('v_rivoli_v').dispos || []).length))) throw new Error('jours de la demande non ajoutés aux jours déclarés');
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
