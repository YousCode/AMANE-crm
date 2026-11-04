/* Outils Playwright partagés : navigateur, polices neutralisées, capture des erreurs console, connexion PIN. */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
/* Playwright est installé globalement (require('playwright')) : résolution CommonJS. */
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium } = pw;

export const BASE = process.env.E2E_BASE || 'http://localhost:5173';
export const SHOTS = process.env.SHOTS || '/tmp/claude-0/-home-user-amane/979b8a77-7793-5ee1-8298-b9ba228fd4c0/scratchpad/web-shots';
export const DESKTOP = { width: 1440, height: 900 };
export const MOBILE = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
mkdirSync(SHOTS, { recursive: true });

let browser;
export async function launch() { browser = browser || (await chromium.launch()); return browser; }
export async function closeBrowser() { if (browser) await browser.close(); browser = null; }

/** Nouveau contexte + page ; les polices Google renvoient un CSS vide ; les erreurs console sont collectées. */
export async function newPage(viewport = DESKTOP, opts = {}) {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: !!viewport.isMobile, hasTouch: !!viewport.hasTouch, deviceScaleFactor: viewport.deviceScaleFactor || 1, locale: 'fr-FR', timezoneId: 'Europe/Paris', ...opts });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage(); const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return { ctx, page, errors };
}
export async function login(page, who = 'amel', pin = '1234') {
  await page.goto(BASE + '/'); await page.waitForSelector(`[data-testid="tile-${who}"]`, { timeout: 15000 }); await page.click(`[data-testid="tile-${who}"]`);
  for (const k of pin) await page.click(`button[aria-label="${k}"]`);
  await page.waitForSelector('[data-testid="live"]', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="live"]')?.textContent?.includes('Synchronisé'), null, { timeout: 15000 });
}
export async function shot(page, name) { await page.waitForTimeout(250); await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); }
/* Tolérés : le 401 attendu de /api/auth/me avant connexion (journalisé par le navigateur lui-même) et la note React DevTools. */
export const ignorable = (e) => /favicon|Failed to load resource: the server responded with a status of 401|download the React DevTools/.test(e);
export function assertNoErrors(errors, label, allow) { const real = errors.filter((e) => !ignorable(e) && !(allow && allow.test(e))); if (real.length) throw new Error(`${label}: ${real.length} erreur(s) console :\n` + real.join('\n')); }
export async function noOverflow(page, label) { const r = await page.evaluate(() => { const w = document.documentElement.clientWidth; const sw = document.documentElement.scrollWidth; const bad = []; document.querySelectorAll('body *').forEach((el) => { const b = el.getBoundingClientRect(); if (b.right > w + 1 && b.width > 0 && getComputedStyle(el).position !== 'fixed' && !el.closest('[data-kanban]') && !el.closest('.plan-wrap')) bad.push(el.tagName + '.' + String(el.className).slice(0, 40) + ' right=' + Math.round(b.right)); }); return { w, sw, bad: bad.slice(0, 6) }; }); if (r.sw > r.w + 1) throw new Error(`${label}: débordement horizontal (${r.sw} > ${r.w}) ${r.bad.join(' | ')}`); }
