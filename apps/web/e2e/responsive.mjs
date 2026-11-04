/* Audit responsive : chaque écran × chaque taille d'écran, vérifications automatiques + captures.
   Lancer le serveur de développement (npm run dev, msw actif) puis : node e2e/responsive.mjs [--vp 390x844] [--state demandes] [--no-shots]
   Captures : $RESP_SHOTS (défaut : <scratchpad>/resp/<état>-<l>x<h>[-dark|-lg].png).
   Vérifications : débordement horizontal (page, conteneurs qui ne devraient pas défiler), chevauchements de frères, texte tronqué,
   cibles tactiles < 44 px, texte < 12 px (11 px pour les capitales espacées), champs < 16 px sur tactile (zoom iOS), barres fixes
   qui couvrent le contenu, tiroir (en-tête, corps défilant, pied « Enregistrer » visible), kanban (accrochage), planning (colonne
   fixe), arabe aligné à droite, images non déformées, contraste (clair et sombre), bascule rail / barre d'onglets à 1020 px. */
import { mkdirSync } from 'node:fs';
import { newPage, login, closeBrowser, BASE, ignorable } from './lib.mjs';

const OUT = process.env.RESP_SHOTS || '/tmp/claude-0/-home-user-amane/979b8a77-7793-5ee1-8298-b9ba228fd4c0/scratchpad/resp';
mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2); const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : ''; };
const ONLY_VP = arg('--vp'), ONLY_ST = arg('--state'), NO_SHOTS = args.includes('--no-shots'), QUIET = args.includes('--quiet');

const T = { isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
export const VIEWPORTS = [
  ['320x568', { width: 320, height: 568, ...T }],
  ['360x740', { width: 360, height: 740, ...T }],
  ['390x844', { width: 390, height: 844, ...T }],
  ['414x896', { width: 414, height: 896, ...T }],
  ['430x932', { width: 430, height: 932, ...T }],
  ['844x390', { width: 844, height: 390, ...T }],
  ['768x1024', { width: 768, height: 1024, ...T }],
  ['1024x768', { width: 1024, height: 768, ...T }],
  ['1180x820', { width: 1180, height: 820, ...T }],
  ['1280x800', { width: 1280, height: 800 }],
  ['1440x900', { width: 1440, height: 900 }],
  ['1920x1080', { width: 1920, height: 1080 }],
  ['390x844-lg', { width: 390, height: 844, ...T, bigText: true }],
  ['390x844-dark', { width: 390, height: 844, ...T, dark: true }],
  ['1440x900-dark', { width: 1440, height: 900, dark: true }],
];

const LONG_CLIENT = 'Son Altesse Sheikha Maryam bint Mohammed Al Maktoum-Rashid Al-Thani (famille et entourage)';
const LONG_TEL = '971559998877';
/* Données réalistes ajoutées au faux serveur : client au nom très long, demande au titre arabe + long, conversation arabe avec URL interminable. */
async function seed(page) {
  await page.evaluate(({ LONG_CLIENT, LONG_TEL }) => {
    const sim = window.__amaneMock; const S = sim.state(); if (S.db.clients.has('c_long')) return;
    const pad = (n) => String(n).padStart(2, '0'); const at = (d, h) => { const x = new Date(); x.setHours(h, 0, 0, 0); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:00`; };
    const now = new Date().toISOString();
    sim.change('clients', { id: 'c_long', nom: LONG_CLIENT, tel: '+971 55 999 8877', telNorm: LONG_TEL, langue: 'AR', pays: 'Émirats arabes unis', hotel: 'Hôtel Plaza Athénée, 25 avenue Montaigne, 75008 Paris — suite Eiffel, dernier étage', canal: 'WhatsApp', statut: 'vip', responsable: 'amel', tags: ['vip', 'famille'], prefs: 'Discrétion absolue, chauffeur arabophone, eau plate, presse en arabe et en anglais chaque matin à 8 h.', attentions: ['Eau Evian plate en cabine', 'Sièges enfant (2)', 'Journaux en arabe'], entourage: [{ nom: 'Abdullah bin Mohammed Al Maktoum-Rashid', lien: 'Époux', tel: '+971 55 111 2233' }], createdAt: now, updatedAt: now, updatedBy: 'amel' });
    sim.change('missions', { id: 'm_long', titre: 'حفل زفاف — Classe V + G 63 — transfert aéroport Charles-de-Gaulle, dîner gastronomique et suite au Plaza Athénée (quatre jours)', clientId: 'c_long', service: 'sejour', vehiculeId: 'classev', chauffeurId: 'p_karim', chauffeur: 'Karim B.', debut: at(1, 9), fin: at(4, 22), lieu: 'Aéroport Paris-Charles-de-Gaulle, terminal 2E, porte K, salon Première — puis Plaza Athénée', montant: 24800, acompte: 8000, statut: 'confirmee', responsable: 'amel', paiement: 'acompte', source: 'whatsapp', canal: 'WhatsApp', convId: LONG_TEL,
      contrat: { statut: 'envoye', caution: 20000, cautionStatut: 'aucune', pieces: { permis: true, passeport: false, domicile: false }, edlDepart: { fait: false, km: '', carburant: 'Plein', notes: '' }, edlRetour: { fait: false, km: '', carburant: 'Plein', notes: '' } },
      devis: { numero: 'D-2026-0014', statut: 'envoye', date: at(-1, 9).slice(0, 10), lignes: [{ d: 'Séjour clé en main — Classe V VIP avec chauffeur arabophone, disponible 24 h / 24', q: 4, u: 'jour', pu: 2100 }, { d: 'G 63 — soirée de mariage, livraison et reprise au Plaza Athénée', q: 1, u: 'forfait', pu: 1650 }, { d: 'Conciergerie, réservations, dîner gastronomique (hors additions)', q: 1, u: 'forfait', pu: 1200 }], remise: 5, tva: 20, paiements: [{ date: at(-1, 9).slice(0, 10), montant: 8000, moyen: 'virement' }] },
      commissions: [{ partenaireId: 'p_maroq', base: 9000, pct: 8, statut: 'attendue' }, { partenaireId: 'p_table', base: 2400, pct: 10, statut: 'recue', recueLe: at(-1, 9).slice(0, 10) }],
      programme: [{ dt: at(1, 9), type: 'transfert', lieu: 'CDG 2E, porte K, salon Première', partenaireId: '', client: 'Votre chauffeur Karim vous attendra à la sortie du salon Première avec une pancarte discrète.', interne: 'Vol EK 073 — vérifier le retard la veille' }, { dt: at(1, 20), type: 'restaurant', lieu: 'Paris 8e', partenaireId: 'p_table', client: 'Table pour six, salon privé, menu sans fruits à coque.', interne: 'Commission 10 % reçue' }, { dt: at(2, 11), type: 'shopping', lieu: 'Faubourg Saint-Honoré', partenaireId: 'p_maroq', client: 'Rendez-vous privé, salon réservé.', interne: '' }],
      taches: [{ t: 'Confirmer le vol EK 073 et l’heure d’atterrissage avec l’assistante de la famille', resp: 'amel', due: at(0, 9).slice(0, 10), fait: false }, { t: 'Préparer le Classe V : sièges enfant, eau, presse arabe', resp: 'youssouf', due: at(1, 9).slice(0, 10), fait: false }, { t: 'Caution 20 000 € à préautoriser', resp: 'aziz', due: at(0, 9).slice(0, 10), fait: true }],
      createdAt: now, updatedAt: now, updatedBy: 'amel' });
    sim.inbound(LONG_TEL, 'مرحباً، نحن عائلة آل مكتوم وسنصل إلى باريس يوم الخميس على متن طيران الإمارات. نرغب في سيارة كلاس في مع سائق يتحدث العربية طوال الإقامة، بالإضافة إلى سيارة جي ٦٣ لحفل الزفاف يوم السبت. هل يمكنكم تأكيد التوفر والسعر الإجمالي؟', { name: LONG_CLIENT });
    sim.inbound(LONG_TEL, 'Le lien de notre réservation d’hôtel : https://www.dorchestercollection.com/paris/hotel-plaza-athenee/reservations/confirmation/ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', { name: LONG_CLIENT });
    const cv = S.db.conversations.get(LONG_TEL); if (cv) { cv.clientId = 'c_long'; cv.missionId = 'm_long'; cv.lang = 'AR'; cv.aiSummary = 'La famille Al Maktoum arrive jeudi (Emirates) : Classe V avec chauffeur arabophone pour tout le séjour, G 63 pour le mariage samedi. Demande le prix total.'; cv.aiFields = { service: 'sejour', vehicule: 'Classe V', debut: at(1, 9), lieu: 'Aéroport CDG', passagers: 6, langue: 'AR' }; }
  }, { LONG_CLIENT, LONG_TEL });
  await page.reload(); await page.waitForFunction(() => document.querySelector('[data-testid="live"]')?.textContent?.includes('Synchronisé'), null, { timeout: 15000 });
}

const go = async (page, path) => { await page.goto(BASE + path); await page.waitForFunction(() => document.querySelector('[data-testid="live"]')?.textContent?.includes('Synchronisé'), null, { timeout: 15000 }); await page.waitForTimeout(150); };
const click = async (page, sel) => { await page.click(sel); await page.waitForTimeout(200); };
const seg = async (page, label) => { await page.locator('.seg button', { hasText: label }).first().click(); await page.waitForTimeout(200); };
const openMission = async (page, id) => { await go(page, '/demandes'); const li = page.locator(`[data-testid="lcard-${id}"]`); if (await li.count()) await li.first().click(); else await page.click(`[data-testid="card-${id}"]`); await page.waitForSelector('[data-testid="drawer"]'); await page.waitForTimeout(150); };
const tab = async (page, t) => { await click(page, `[data-testid="tab-${t}"]`); };

/* États visités : nom → mise en place (la page est connectée et les données ajoutées). */
export const STATES = {
  async home(p) { await go(p, '/'); },
  async messages(p) { await go(p, '/messages'); },
  async thread(p) { await go(p, '/messages/971501234567'); await p.waitForSelector('[data-testid="thread"]'); },
  async 'thread-long'(p) { await go(p, `/messages/${LONG_TEL}`); await p.waitForSelector('[data-testid="thread"]'); },
  async 'demandes-kanban'(p) { await go(p, '/demandes'); await seg(p, 'Colonnes'); await p.waitForSelector('[data-kanban]'); },
  async 'demandes-liste'(p) { await go(p, '/demandes'); await seg(p, 'Liste'); await p.waitForSelector('[data-testid^="lcard-"]'); },
  async 'mission-main'(p) { await openMission(p, 'm_long'); },
  async 'mission-devis'(p) { await openMission(p, 'm_long'); await tab(p, 'devis'); },
  async 'mission-prog'(p) { await openMission(p, 'm_long'); await tab(p, 'prog'); },
  async 'mission-taches'(p) { await openMission(p, 'm_long'); await tab(p, 'taches'); },
  async 'mission-contrat'(p) { await openMission(p, 'm_long'); await tab(p, 'contrat'); },
  async 'mission-ia'(p) { await openMission(p, 'm_long'); await tab(p, 'ia'); },
  async 'mission-act'(p) { await openMission(p, 'm_long'); await tab(p, 'act'); await p.waitForTimeout(300); },
  async 'mission-new'(p) { await go(p, '/'); const m = p.locator('button[aria-label="Nouvelle demande"]'); if (await m.isVisible()) await m.click(); else await p.click('text=Nouvelle demande'); await p.waitForSelector('[data-testid="drawer"]'); },
  async 'planning-liste'(p) { await go(p, '/planning'); await seg(p, 'Jour par jour'); },
  async 'planning-grille'(p) { await go(p, '/planning'); await seg(p, 'Grille'); await p.waitForSelector('[data-plan]'); },
  async clients(p) { await go(p, '/clients'); },
  async 'client-drawer'(p) { await go(p, '/clients'); await click(p, '[data-testid="client-c_long"]'); await p.waitForSelector('[data-testid="drawer"]'); },
  async 'client-plus'(p) { await go(p, '/clients'); await click(p, '[data-testid="client-c_long"]'); await p.waitForSelector('[data-testid="drawer"]'); await tab(p, 'plus'); },
  async 'client-hist'(p) { await go(p, '/clients'); await click(p, '[data-testid="client-c_long"]'); await p.waitForSelector('[data-testid="drawer"]'); await tab(p, 'hist'); await p.waitForTimeout(300); },
  async carnet(p) { await go(p, '/carnet'); },
  async 'partenaire-drawer'(p) { await go(p, '/carnet'); await click(p, '.row'); await p.waitForSelector('[data-testid="drawer"]'); },
  async flotte(p) { await go(p, '/flotte'); },
  async 'vehicule-drawer'(p) { await go(p, '/flotte'); await click(p, '[data-testid="veh-g63"]'); await p.waitForSelector('[data-testid="drawer"]'); },
  async 'vehicule-dispo'(p) { await go(p, '/flotte'); await click(p, '[data-testid="veh-classev"]'); await p.waitForSelector('[data-testid="drawer"]'); await tab(p, 'dispo'); },
  async 'vehicule-journal'(p) { await go(p, '/flotte'); await click(p, '[data-testid="veh-g63"]'); await p.waitForSelector('[data-testid="drawer"]'); await tab(p, 'journal'); },
  async rentabilite(p) { await go(p, '/flotte/rentabilite'); await p.waitForSelector('.row'); },
  async finances(p) { await go(p, '/finances'); },
  async relances(p) { await go(p, '/relances'); await p.waitForSelector('[data-testid^="relance-"]'); },
  async contrats(p) { await go(p, '/contrats'); },
  async services(p) { await go(p, '/services'); },
  async reglages(p) { await go(p, '/reglages'); },
  async 'reglages-rappels'(p) { await go(p, '/reglages'); await seg(p, 'Rappels'); },
  async aide(p) { await go(p, '/aide'); },
  async plus(p) { await go(p, '/'); const b = p.locator('button[aria-label="Plus"]'); if (!(await b.isVisible())) await p.click('button[aria-label="Mon compte"]'); else await b.click(); await p.waitForSelector('[role="dialog"][aria-label="Plus"]'); },
  async palette(p) { await go(p, '/'); await click(p, 'button[aria-label="Rechercher"]'); await p.waitForSelector('[role="dialog"][aria-label="Recherche"]'); },
  async majordome(p) { await go(p, '/'); await click(p, 'button:has(span:text("Majordome"))'); await p.waitForSelector('#mjTitle'); },
};

/* Vérifications dans la page. Renvoie une liste [catégorie, message]. */
function audit(opts) {
  const out = []; const push = (c, m) => { if (!out.some((x) => x[0] === c && x[1] === m)) out.push([c, m]); };
  const W = document.documentElement.clientWidth, H = window.innerHeight; const touch = opts.touch;
  const cs = (el) => getComputedStyle(el);
  const desc = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; const cl = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2) : []; if (cl.length) s += '.' + cl.join('.'); if (el.dataset && el.dataset.testid) s += '[' + el.dataset.testid + ']'; const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28); return s + (t ? ' «' + t + '»' : ''); };
  const vis = (el) => { if (!(el instanceof Element)) return false; const c = cs(el); if (c.display === 'none' || c.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const hidden = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const c = cs(e); if (c.display === 'none' || c.visibility === 'hidden' || e.getAttribute('aria-hidden') === 'true' || e.hidden) return true; } return false; };
  /* Couche active : tiroir, feuille ou fenêtre modale ouverte → le reste est sous le voile. */
  const layer = document.querySelector('[data-testid="drawer"]') || document.querySelector('[role="dialog"][aria-modal="true"]') || document.body;
  const inLayer = (el) => layer === document.body || layer.contains(el);
  const all = [...layer.querySelectorAll('*')].filter((el) => el instanceof HTMLElement && !hidden(el) && vis(el));
  const isHScroller = (el) => { const c = cs(el); return /(auto|scroll)/.test(c.overflowX) && el.scrollWidth > el.clientWidth + 1; };
  const inHScroller = (el) => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { if (isHScroller(e)) return e; } return null; };
  const OK_SCROLL = '[data-kanban],[data-plan],[data-hscroll],.seg,.pills';
  const clippedBy = (el) => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const c = cs(e); if (/(hidden|clip)/.test(c.overflowX) && e.getBoundingClientRect().right <= W + 1) return true; } return false; };
  const fixedIn = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { if (cs(e).position === 'fixed') return true; } return false; };

  // 1. Débordement horizontal de la page
  const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  if (sw > W + 1) push('overflow', `page : scrollWidth ${sw} > ${W}`);
  for (const el of all) { const r = el.getBoundingClientRect(); if (r.width < 2) continue; if (inHScroller(el)) continue; if (r.right > W + 1 || r.left < -1) { if (cs(el).position === 'fixed' && r.right <= W + 1) continue; if (clippedBy(el)) continue; push('overflow', `${desc(el)} dépasse (${Math.round(r.left)}→${Math.round(r.right)} / ${W})`); } }
  // 1b. Conteneurs qui défilent horizontalement sans y être destinés
  for (const el of all) { if (isHScroller(el) && !el.matches(OK_SCROLL)) push('overflow', `${desc(el)} défile horizontalement (${el.scrollWidth} > ${el.clientWidth})`); }

  // 2. Texte tronqué / contenu qui sort de sa boîte
  for (const el of all) {
    const c = cs(el); if (!/^(block|flex|grid|inline-block|inline-flex|list-item|table-cell)$/.test(c.display)) continue;
    const ox = c.overflowX, oy = c.overflowY;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (el.matches('input,textarea,select,[data-clip]')) continue;
    if ((ox === 'hidden' || ox === 'clip') && el.scrollWidth > el.clientWidth + 1 && c.textOverflow !== 'ellipsis' && !el.querySelector('[data-kanban],[data-plan]')) push('clipped', `${desc(el)} rogne horizontalement (${el.scrollWidth} > ${el.clientWidth})`);
    if ((oy === 'hidden' || oy === 'clip') && el.scrollHeight > el.clientHeight + 2 && c.webkitLineClamp === 'none' && !el.matches('[data-strip]')) push('clipped', `${desc(el)} rogne verticalement (${el.scrollHeight} > ${el.clientHeight})`);
    if (ox === 'visible' && hasText && c.whiteSpace.startsWith('nowrap') && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) push('clipped', `${desc(el)} texte sans retour déborde (${el.scrollWidth} > ${el.clientWidth})`);
  }

  // 3. Chevauchement de frères (flux normal)
  for (const el of all) {
    const kids = [...el.children].filter((k) => k instanceof HTMLElement && vis(k) && !hidden(k) && !/^(absolute|fixed)$/.test(cs(k).position) && cs(k).display !== 'contents' && !cs(k).transform.includes('matrix'));
    if (kids.length < 2 || cs(el).display === 'contents') continue;
    const rs = kids.map((k) => [k, k.getBoundingClientRect()]);
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const [a, ra] = rs[i], [b, rb] = rs[j]; const iw = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), ih = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (iw > 3 && ih > 3) { const ma = parseFloat(cs(a).marginLeft) < 0 || parseFloat(cs(b).marginLeft) < 0 || parseFloat(cs(a).marginTop) < 0 || parseFloat(cs(b).marginTop) < 0; if (!ma) push('overlap', `${desc(a)} ⟂ ${desc(b)} (${Math.round(iw)}×${Math.round(ih)})`); }
    }
  }

  // 4. Cibles tactiles
  if (touch) {
    const sel = 'a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[role="tab"],[role="option"],label.tog,label.ck,label:has(>input[type="checkbox"])';
    for (const el of [...layer.querySelectorAll(sel)]) {
      if (!(el instanceof HTMLElement) || hidden(el) || !vis(el) || !inLayer(el)) continue;
      if (el.tagName === 'INPUT' && el.closest('label')) continue; if (el.matches('.tog input')) continue;
      const c = cs(el); if (c.display === 'inline' && el.closest('p,.muted,.note,li,.msg,.pvbox,.stat,.td,.sub-t')) continue; // lien dans une phrase
      const r = el.getBoundingClientRect(); if (r.width < 43.5 || r.height < 43.5) push('tap', `${desc(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
  }

  // 5. Taille de texte (12 px ; 11 px pour les capitales espacées) et champs < 16 px sur tactile
  for (const el of all) {
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (!hasText) continue;
    const c = cs(el); const fs = parseFloat(c.fontSize); const caps = c.textTransform === 'uppercase' && parseFloat(c.letterSpacing) >= fs * .1; const min = caps ? 11 * opts.scale : 12 * opts.scale;
    if (fs < min - .05) push('font', `${desc(el)} ${fs.toFixed(1)}px`);
  }
  if (touch && W < 1020) for (const el of all) { if (!el.matches('input,select,textarea') || el.type === 'checkbox' || el.type === 'radio' || el.type === 'file') continue; const fs = parseFloat(cs(el).fontSize); if (fs < 16 * opts.scale - .05) push('input16', `${desc(el)} ${fs.toFixed(1)}px (zoom iOS)`); }

  // 6. Barres fixes et contenu (hors couche modale)
  if (layer === document.body) {
    const main = document.querySelector('main'); const tb = document.querySelector('nav[aria-label="Navigation principale"]'); const fab = document.querySelector('button[aria-label="Nouvelle demande"]');
    if (main) { window.scrollTo(0, 1e9); const last = [...main.querySelectorAll('*')].filter((e) => vis(e) && !fixedIn(e) && !hidden(e)).reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0);
      if (tb && vis(tb) && last > tb.getBoundingClientRect().top + 1) push('fixed', `la barre d'onglets couvre le bas du contenu (${Math.round(last)} > ${Math.round(tb.getBoundingClientRect().top)})`);
      if (fab && vis(fab) && cs(fab).position === 'fixed' && last > fab.getBoundingClientRect().top + 1) push('fixed', `le bouton + couvre le bas du contenu`);
      window.scrollTo(0, 0); }
  }

  // 7. Tiroir : en-tête, corps défilant, pied visible
  const dr = document.querySelector('[data-testid="drawer"]');
  if (dr) { const r = dr.getBoundingClientRect(); if (r.top < -1 || r.bottom > H + 1) push('drawer', `tiroir hors écran (${Math.round(r.top)}→${Math.round(r.bottom)} / ${H})`);
    const save = dr.querySelector('[data-testid="save"]'); if (!save || !vis(save)) push('drawer', 'bouton Enregistrer absent'); else { const s = save.getBoundingClientRect(); if (s.bottom > H + 1 || s.top < 0) push('drawer', `Enregistrer hors écran (${Math.round(s.top)}→${Math.round(s.bottom)} / ${H})`); if (touch && (s.height < 43.5)) push('tap', `Enregistrer ${Math.round(s.height)}px`); }
    const body = dr.querySelector('[data-drawer-body]'); if (!body || !/(auto|scroll)/.test(cs(body).overflowY)) push('drawer', 'corps du tiroir non défilant'); else if (body.clientHeight < 80) push('drawer', `corps du tiroir trop bas (${body.clientHeight}px)`);
    const h2 = dr.querySelector('h2'); if (h2 && h2.getBoundingClientRect().top < 0) push('drawer', 'en-tête du tiroir hors écran'); }

  // 8. Kanban : accrochage et défilement ; 9. Planning : colonne fixe
  const kb = document.querySelector('[data-kanban]'); if (kb && vis(kb)) { const c = cs(kb); if (!/(auto|scroll)/.test(c.overflowX)) push('kanban', 'kanban non défilant'); if (touch && !/x/.test(c.scrollSnapType)) push('kanban', 'kanban sans accrochage (scroll-snap)'); const col = kb.querySelector('[data-col]'); if (touch && col && cs(col).scrollSnapAlign === 'none') push('kanban', 'colonnes sans scroll-snap-align'); if (touch && col && col.getBoundingClientRect().width > W - 24) push('kanban', 'colonne plus large que l’écran'); }
  const pl = document.querySelector('[data-plan]'); if (pl && vis(pl)) { if (!/(auto|scroll)/.test(cs(pl).overflowX)) push('planning', 'grille non défilante'); const rl = pl.querySelector('[data-rowlabel]'); if (rl && cs(rl).position !== 'sticky') push('planning', 'première colonne non fixe'); }

  // 10. Arabe : direction et alignement
  for (const el of all) { const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(''); if (!/[؀-ۿ]{3,}/.test(t) || /^[A-Za-z]/.test(t.trim())) continue; if (el.matches('option,select')) continue; const c = cs(el); if (c.direction !== 'rtl') push('rtl', `${desc(el)} direction ${c.direction}`); else if (c.textAlign === 'left') push('rtl', `${desc(el)} aligné à gauche`); }

  // 11. Images déformées
  for (const img of layer.querySelectorAll('img')) { if (!vis(img) || !img.complete || !img.naturalWidth) continue; const c = cs(img); if (c.objectFit === 'cover' || c.objectFit === 'contain') continue; const r = img.getBoundingClientRect(); const k = (r.width / r.height) / (img.naturalWidth / img.naturalHeight); if (Math.abs(k - 1) > .03) push('image', `${desc(img)} déformée (${k.toFixed(2)})`); }

  // 12. Contraste (texte visible, fond composé des ancêtres)
  const toRGBA = (s) => { if (s.startsWith('color(')) { const m = s.replace(/^color\(srgb\s*/, '').replace(/\)$/, '').split(/[\s/]+/).filter(Boolean).map(Number); return [m[0] * 255, m[1] * 255, m[2] * 255, m.length > 3 ? m[3] : 1]; } const m = s.match(/[\d.]+/g) || []; return [+m[0] || 0, +m[1] || 0, +m[2] || 0, m.length > 3 ? +m[3] : 1]; };
  const over = (fg, bg) => { const a = fg[3]; return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const bgOf = (el) => { let acc = [0, 0, 0, 0]; const layers = []; for (let e = el; e; e = e.parentElement) { const c = cs(e); if (c.backgroundImage !== 'none') return null; const b = toRGBA(c.backgroundColor); if (b[3] > 0) layers.push(b); if (b[3] >= 1) break; } let bg = toRGBA(cs(document.body).backgroundColor); bg[3] = 1; for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg); void acc; return bg; };
  const opOf = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= +cs(e).opacity; return o; };
  for (const el of all) {
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (!hasText) continue; if (el.closest('[disabled],[aria-disabled="true"],[aria-hidden="true"],.sending,option,select')) continue;
    const c = cs(el); const bg = bgOf(el); if (!bg) continue; let fg = toRGBA(c.color); fg[3] *= opOf(el); fg = over(fg, bg);
    const l1 = lum(fg), l2 = lum(bg); const ratio = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); const fs = parseFloat(c.fontSize); const big = fs >= 24 || (fs >= 18.66 && parseInt(c.fontWeight) >= 700);
    if (ratio < (big ? 3 : 4.5)) push('contrast', `${desc(el)} ${ratio.toFixed(2)}:1`);
  }
  return out;
}

async function runState(page, name, vp, label, counts, failures) {
  const touch = !!vp.hasTouch; const scale = vp.bigText ? 1.25 : 1;
  let issues = [];
  try { await STATES[name](page); await page.waitForTimeout(450); issues = await page.evaluate(audit, { touch, scale }); }
  catch (e) { issues = [['error', e.message.split('\n')[0].slice(0, 160)]]; }
  if (!NO_SHOTS) { try { await page.screenshot({ path: `${OUT}/${name}-${label}.png` }); } catch { /* ignore */ } }
  for (const [c, m] of issues) { counts[c] = (counts[c] || 0) + 1; failures.push(`${label} · ${name} · ${c} : ${m}`); }
  if (!QUIET) console.log(issues.length ? `✗ ${label} ${name} — ${issues.length}` : `✓ ${label} ${name}`);
  if (!QUIET && issues.length) for (const [c, m] of issues.slice(0, 12)) console.log(`    ${c}: ${m}`);
}

/* Bascule rail ↔ barre d'onglets : à 1019 px l'un, à 1020 px l'autre, jamais les deux ni aucun. */
async function railCheck(page, failures, counts) {
  for (const w of [1019, 1020]) { await page.setViewportSize({ width: w, height: 800 }); await page.waitForTimeout(250);
    const r = await page.evaluate(() => { const v = (s) => { const e = document.querySelector(s); if (!e) return false; const c = getComputedStyle(e); return c.display !== 'none' && e.getBoundingClientRect().width > 0; }; return { rail: v('nav[aria-label="Navigation"]'), tabs: v('nav[aria-label="Navigation principale"]'), ml: parseFloat(getComputedStyle(document.querySelector('main')).marginLeft) }; });
    const ok = w < 1020 ? (!r.rail && r.tabs && r.ml === 0) : (r.rail && !r.tabs && r.ml > 0);
    if (!ok) { counts.rail = (counts.rail || 0) + 1; failures.push(`${w}px · bascule rail/onglets : rail=${r.rail} onglets=${r.tabs} marge=${r.ml}`); } }
}

async function run() {
  const counts = {}; const failures = []; let states = 0; const t0 = Date.now();
  for (const [label, vp] of VIEWPORTS) {
    if (ONLY_VP && label !== ONLY_VP && !label.startsWith(ONLY_VP + ',')) continue;
    const { ctx, page, errors } = await newPage(vp, vp.dark ? { colorScheme: 'dark' } : {});
    if (vp.bigText) await page.addInitScript(() => { const f = () => { if (document.documentElement) document.documentElement.style.fontSize = '20px'; }; f(); document.addEventListener('DOMContentLoaded', f); });
    try {
      // Connexion (écran de connexion audité avant la saisie du code)
      if (!ONLY_ST || 'login'.includes(ONLY_ST)) { await page.goto(BASE + '/'); await page.waitForSelector('[data-testid="tile-amel"]'); await page.waitForTimeout(400);
        const issues = await page.evaluate(audit, { touch: !!vp.hasTouch, scale: vp.bigText ? 1.25 : 1 }); if (!NO_SHOTS) await page.screenshot({ path: `${OUT}/login-${label}.png` });
        await page.click('[data-testid="tile-amel"]'); await page.waitForTimeout(400); const i2 = await page.evaluate(audit, { touch: !!vp.hasTouch, scale: vp.bigText ? 1.25 : 1 }); if (!NO_SHOTS) await page.screenshot({ path: `${OUT}/login-pin-${label}.png` });
        for (const [c, m] of [...issues, ...i2]) { counts[c] = (counts[c] || 0) + 1; failures.push(`${label} · login · ${c} : ${m}`); } states += 2; if (!QUIET) console.log(`${issues.length + i2.length ? '✗' : '✓'} ${label} login — ${issues.length + i2.length}`); }
      await page.evaluate(() => { try { localStorage.removeItem('amane.me'); } catch { /* ignore */ } });
      await login(page); await seed(page);
      for (const name of Object.keys(STATES)) { if (ONLY_ST && !name.includes(ONLY_ST)) continue; if (name === 'plus' && !vp.hasTouch && vp.width >= 1020) continue; states++; await runState(page, name, vp, label, counts, failures); }
      if (!vp.dark && !vp.bigText && vp.width >= 1024 && (!ONLY_ST || ONLY_ST === 'rail')) { await go(page, '/'); await railCheck(page, failures, counts); }
      const real = errors.filter((e) => !ignorable(e)); if (real.length) { counts.console = (counts.console || 0) + real.length; failures.push(`${label} · console : ${real.slice(0, 3).join(' | ')}`); }
    } catch (e) { counts.error = (counts.error || 0) + 1; failures.push(`${label} · ${e.message.split('\n')[0]}`); }
    finally { await ctx.close(); }
  }
  await closeBrowser();
  console.log(`\n${states} états audités en ${Math.round((Date.now() - t0) / 1000)} s — ${failures.length} problème(s)`);
  for (const [c, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${c}: ${n}`);
  if (failures.length && QUIET) for (const f of failures) console.log('  ' + f);
  process.exit(failures.length ? 1 : 0);
}
run().catch(async (e) => { console.error(e); await closeBrowser(); process.exit(1); });
