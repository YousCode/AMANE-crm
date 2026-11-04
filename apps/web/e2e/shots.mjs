/* Captures d'écran : Aujourd'hui, Messages (fil arabe traduit), Demandes kanban, fiche mission mobile, Planning, Finances. */
import { newPage, login, shot, closeBrowser, DESKTOP, MOBILE, assertNoErrors } from './lib.mjs';

async function run() {
  const { page, errors, ctx } = await newPage(DESKTOP); await login(page);
  await shot(page, 'aujourdhui-desktop');
  await page.goto('http://localhost:5173/messages/971501234567'); await page.waitForSelector('[data-testid="thread"]'); await shot(page, 'messages-desktop');
  await page.goto('http://localhost:5173/demandes'); await page.waitForSelector('[data-kanban]'); await shot(page, 'demandes-desktop');
  await page.goto('http://localhost:5173/planning'); await page.waitForTimeout(300); await shot(page, 'planning-desktop');
  await page.goto('http://localhost:5173/finances'); await page.waitForTimeout(300); await shot(page, 'finances-desktop');
  await page.goto('http://localhost:5173/clients'); await page.waitForTimeout(300); await shot(page, 'clients-desktop');
  await page.goto('http://localhost:5173/flotte'); await page.waitForTimeout(300); await shot(page, 'flotte-desktop');
  await page.goto('http://localhost:5173/relances'); await page.waitForTimeout(500); await shot(page, 'relances-desktop');
  await page.goto('http://localhost:5173/demandes'); await page.click('[data-testid="card-m_sejour"]'); await page.waitForSelector('[data-testid="drawer"]'); await shot(page, 'mission-desktop');
  await page.click('[data-testid="tab-devis"]'); await shot(page, 'mission-devis-desktop');
  assertNoErrors(errors, 'desktop'); await ctx.close();
  const m = await newPage(MOBILE); await login(m.page);
  await shot(m.page, 'aujourdhui-mobile');
  await m.page.goto('http://localhost:5173/messages/971501234567'); await m.page.waitForSelector('[data-testid="thread"]'); await shot(m.page, 'messages-mobile');
  await m.page.goto('http://localhost:5173/demandes'); await m.page.waitForSelector('[data-testid="lcard-m_sejour"]'); await shot(m.page, 'demandes-mobile');
  await m.page.click('[data-testid="lcard-m_sejour"]'); await m.page.waitForSelector('[data-testid="drawer"]'); await shot(m.page, 'mission-mobile');
  await m.page.goto('http://localhost:5173/planning'); await m.page.waitForTimeout(300); await shot(m.page, 'planning-mobile');
  await m.page.goto('http://localhost:5173/finances'); await m.page.waitForTimeout(300); await shot(m.page, 'finances-mobile');
  await m.page.goto('http://localhost:5173/'); await m.page.click('button[aria-label="Plus"]'); await m.page.waitForTimeout(300); await shot(m.page, 'plus-mobile');
  assertNoErrors(m.errors, 'mobile'); await m.ctx.close();
  const l = await newPage(MOBILE); await l.page.goto('http://localhost:5173/'); await l.page.waitForSelector('[data-testid="tile-amel"]'); await shot(l.page, 'login-mobile'); await l.ctx.close();
  await closeBrowser(); console.log('captures ok');
}
run().catch(async (e) => { console.error(e); await closeBrowser(); process.exit(1); });
