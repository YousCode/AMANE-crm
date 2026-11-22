// Documents client au gabarit A4 de la maison (devis, facture, carnet de séjour) : une seule source pour
// l'API (pages publiques /d/:token et /api/espace/:token/devis|facture), le back-office React et, à terme, l'appli.
// Thème bordeaux : bandeau aux arcades à serrure, A bordeaux sur cartouche crème, filets champagne,
// totaux sur pierre, TTC sur bordeaux ; Bodoni Moda + Jost + IBM Plex Mono ; prêt à imprimer ou enregistrer en PDF.
// Fonctions pures : aucune dépendance au navigateur ni à Node.
import { devisTotals, addDays, round2, docLang } from './rules.js';
import { t, fmtMoney, fmtDate, fmtTime } from './i18n.js';
import { MOYENS, TEAM } from './constants.js';
import { tokens } from './tokens.js';

export const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const esc = escHtml;

/** Couleurs des documents (identité de la maison, README « Identité visuelle »). */
export const DOC_COLORS = Object.freeze({
  bordeaux: '#5B1622', bordeauxDeep: '#3B0C15', bordeauxSoft: '#7A2232', arch: '#8E3043',
  champagne: '#B8955C', champagneLight: '#D9B98A', cream: '#F6F1E8', stone: '#EFE7DA', ink: '#15110F',
  text2: '#4A3A3C', text3: '#6E675F', line: '#E5DACB', line2: '#E0D4C4',
});
const K = DOC_COLORS;

/** Champs de l'identité de la maison (document `reglages/maison`), dans l'ordre du formulaire. */
export const MAISON_FIELDS = Object.freeze([
  { k: 'raison', label: 'Raison sociale', placeholder: 'Amane SAS' },
  { k: 'adresse', label: 'Adresse du siège', placeholder: '12 avenue Montaigne, 75008 Paris' },
  { k: 'siren', label: 'SIREN', placeholder: '123 456 789' },
  { k: 'tva', label: 'N° de TVA intracommunautaire', placeholder: 'FR12 123456789' },
  { k: 'iban', label: 'IBAN', placeholder: 'FR76 …' },
  { k: 'bic', label: 'BIC', placeholder: 'BNPAFRPP' },
  { k: 'tel', label: 'Téléphone', placeholder: '+33 1 00 00 00 00' },
  { k: 'email', label: 'E-mail', placeholder: 'bonjour@amane.paris' },
  { k: 'site', label: 'Site', placeholder: 'amane.paris' },
]);
const MAISON_KEYS = MAISON_FIELDS.map((f) => f.k);

/**
 * Identité de la maison effective : `reglages/maison` complété par des valeurs par défaut (par ex. les variables
 * d'environnement BANK_IBAN / BANK_BIC côté serveur). Chaînes nettoyées ; champs absents = ''.
 */
export function maisonInfo(raw, defaults) {
  const out = {};
  for (const k of MAISON_KEYS) {
    const v = raw && raw[k] != null && String(raw[k]).trim() ? raw[k] : defaults && defaults[k];
    out[k] = v == null ? '' : String(v).trim().slice(0, 300);
  }
  return out;
}

/** Champs légaux manquants pour une facture conforme (raison, adresse, SIREN, TVA). */
export const maisonMissing = (m) => ['raison', 'adresse', 'siren', 'tva'].filter((k) => !(m && String(m[k] || '').trim()));

/** Date « AAAA-MM-JJ » lue à midi local (pas de décalage de jour selon le fuseau), sinon Date usuelle. */
function parseDay(s) {
  if (!s) return null;
  if (s instanceof Date) return Number.isNaN(s.getTime()) ? null : s;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const LOGO = (cls = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${tokens.logoViewBox}" aria-hidden="true"${cls ? ` class="${cls}"` : ''}><path fill="currentColor" d="${tokens.logoPath}"/></svg>`;

/** Motif « Arcades » du bandeau : arches à double filet, une serrure sur deux rangs. */
function archPattern() {
  const arch = (x, y, key) => `<g transform="translate(${x} ${y})"><g fill="none" stroke="${K.arch}" stroke-width="2.2" opacity="0.9"><path d="M14 190 V64 A46 46 0 0 1 106 64 V190"/><path d="M22 190 V64 A38 38 0 0 1 98 64 V190" stroke-width=".8"/></g>${key ? `<g fill="${K.arch}" opacity="0.9" transform="translate(60 112)"><circle r="8"/><path d="M-3.4 5 H3.4 L7 26 H-7Z"/></g>` : ''}</g>`;
  const tiles = [[0, 0], [120, 0, 1], [240, 0], [60, 190], [180, 190], [300, 190, 1], [-60, 190]].map(([x, y, k]) => arch(x, y, k)).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 380" width="360" height="380"><rect width="360" height="380" fill="${K.bordeaux}"/>${tiles}</svg>`;
  return `url("data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}")`;
}

const FONTS_LTR = 'Bodoni+Moda:ital,opsz,wght@0,6..96,400;1,6..96,400&family=Jost:wght@300;400;500&family=IBM+Plex+Mono:wght@400';
const FONTS_RTL = FONTS_LTR + '&family=Amiri:ital,wght@0,400;1,400&family=IBM+Plex+Sans+Arabic:wght@300;400;500';

/**
 * Feuille A4 complète (document HTML autonome).
 * @param {object} o
 * @param {string} o.lang      FR | EN | ES | AR
 * @param {string} o.title     titre de l'onglet
 * @param {string} o.body      HTML du corps de la feuille
 * @param {boolean} [o.legal]  pied légal complet (raison, adresse, SIREN, TVA) — devis et factures
 * @param {string} [o.kind]    grand titre du bandeau (« Facture »)
 * @param {string} [o.num]     numéro sous le titre
 * @param {string} [o.meta]    ligne de dates (HTML déjà échappé)
 * @param {object} [o.maison]  identité de la maison (maisonInfo)
 * @param {boolean} [o.placeholders] champs manquants affichés « [SIREN] » (usage interne) ; sinon omis (pages client)
 * @param {string} [o.after]   HTML sous la feuille (actions de la page publique)
 * @param {string} [o.extraHead]
 */
export function docShell({ lang = 'FR', title = '', body = '', legal = false, kind, num, meta, maison, placeholders = false, after = '', extraHead = '' }) {
  const L = String(lang || 'FR').toUpperCase();
  const rtl = L === 'AR';
  const M = maisonInfo(maison);
  const ph = (v, label) => (v ? esc(v) : placeholders ? `<span class="ph">[${esc(label)}]</span>` : '');
  const display = rtl ? "'Amiri','Bodoni Moda',Georgia,serif" : "'Bodoni Moda',Didot,Georgia,serif";
  const ui = rtl ? "'IBM Plex Sans Arabic','Jost',Tahoma,sans-serif" : "'Jost','Futura',system-ui,sans-serif";
  const mono = "'IBM Plex Mono',ui-monospace,monospace";
  const start = rtl ? 'right' : 'left', end = rtl ? 'left' : 'right';
  const css = `@page{size:A4;margin:0}*{box-sizing:border-box}html{background:${K.stone}}body{margin:0;background:${K.stone};color:${K.ink};font-family:${ui};font-weight:300;font-size:10.5pt;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{position:relative;width:210mm;min-height:297mm;margin:12mm auto 24mm;background:${K.cream};box-shadow:0 30px 60px -30px rgba(59,12,21,.45);display:flex;flex-direction:column}
.top{background:${K.bordeaux} ${archPattern()} repeat;background-size:48mm auto;color:${K.cream};padding:14mm 18mm 11mm;display:flex;justify-content:space-between;align-items:flex-end;gap:12mm;position:relative}
.brand{display:flex;align-items:center;gap:5mm}.brand .lg{background:${K.cream};padding:3mm 3.5mm 2.5mm;display:grid;place-items:center}.brand svg{height:14mm;width:auto;color:${K.bordeaux};display:block}.brand b{display:block;font-family:${display};font-weight:400;font-size:16pt;letter-spacing:.44em;margin-inline-end:-.44em;color:${K.cream}}.brand small{display:block;font-size:7.5pt;letter-spacing:.3em;text-transform:uppercase;color:${K.champagneLight};margin-top:1.5mm}
.doc{text-align:${end}}.doc h1{margin:0;font-family:${display};font-weight:400;font-style:italic;font-size:32pt;line-height:1;letter-spacing:-.01em;color:${K.cream}}.doc .num{font-family:${mono};font-size:10.5pt;margin-top:2.5mm;letter-spacing:.06em;color:${K.champagneLight}}.doc .meta{font-size:7.5pt;letter-spacing:.22em;text-transform:uppercase;color:rgba(246,241,232,.75);margin-top:2mm;white-space:nowrap}
.rule{height:1px;background:${K.champagne}}
.inner{padding:10mm 18mm 8mm;flex:1}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:10mm;margin:0 0 9mm}.k{font-size:7.5pt;letter-spacing:.28em;text-transform:uppercase;color:${K.bordeauxSoft};margin-bottom:2.2mm;display:flex;align-items:center;gap:3mm}.k::after{content:"";flex:1;height:1px;background:${K.line2}}.who{font-size:10.5pt;line-height:1.5;color:${K.text2}}.who b{font-family:${display};font-weight:400;font-size:14pt;display:block;margin-bottom:1mm;color:${K.bordeauxDeep}}.who .mut{color:${K.text3}}
table{width:100%;border-collapse:collapse}th{font-size:7.5pt;letter-spacing:.22em;text-transform:uppercase;color:${K.bordeauxSoft};font-weight:400;text-align:${start};padding:0 2mm 2.5mm;border-bottom:1px solid ${K.bordeaux}}td{padding:3.4mm 2mm;border-bottom:1px solid ${K.line};vertical-align:top;font-size:10.5pt;color:${K.ink}}td.n,th.n{text-align:${end};white-space:nowrap}td.n{font-family:${mono};font-size:10pt}tbody tr:last-child td{border-bottom:1px solid ${K.bordeaux}}
.sum{display:flex;justify-content:flex-end;margin-top:6mm}.tot{width:84mm;max-width:100%;background:${K.stone};padding:4mm 5mm 0}.tot div{display:flex;justify-content:space-between;gap:6mm;padding:1.8mm 0;font-size:10pt;color:${K.text2}}.tot div span:last-child{font-family:${mono};color:${K.ink}}.tot .g{margin:2mm -5mm 0;padding:3.5mm 5mm;background:${K.bordeaux};color:${K.cream};align-items:baseline}.tot .g span:first-child{font-size:7.5pt;letter-spacing:.26em;text-transform:uppercase;color:${K.champagneLight}}.tot .g span:last-child{font-family:${display};font-size:20pt;letter-spacing:-.01em;color:${K.cream}}.tot .g+div{padding-top:3mm}.tot div:last-child{padding-bottom:3.5mm}
.stamp{display:inline-block;padding:1.5mm 4mm;border:1px solid ${K.champagne};color:${K.bordeauxSoft};font-size:8pt;letter-spacing:.3em;text-transform:uppercase;background:${K.cream}}
h2{font-family:${ui};font-weight:400;font-size:7.5pt;letter-spacing:.28em;text-transform:uppercase;color:${K.bordeauxSoft};margin:9mm 0 2.5mm;display:flex;align-items:center;gap:3mm}h2::after{content:"";flex:1;height:1px;background:${K.line2}}p{margin:0 0 2mm;color:${K.text2}}.two{display:grid;grid-template-columns:1fr 1fr;gap:10mm}.note{color:${K.text3};font-size:9pt}.it{font-family:${display};font-style:italic;font-size:11.5pt;color:${K.bordeauxDeep}}
.ph{color:${K.bordeauxSoft};border-bottom:1px dotted ${K.champagne};font-weight:400}
.day{font-family:${display};font-size:14.5pt;margin:7mm 0 2mm;padding-bottom:1.8mm;border-bottom:1px solid ${K.bordeaux};color:${K.bordeauxDeep}}.st{display:grid;grid-template-columns:18mm 1fr;gap:4mm;padding:3mm 0;border-bottom:1px solid ${K.line}}.st b{font-family:${mono};font-weight:400;color:${K.bordeauxSoft};font-size:10pt}.st .t{font-weight:400;color:${K.ink}}.st .muted{color:${K.text3};font-size:9.5pt}.st .cl{margin-top:.8mm;color:${K.text2}}
.foot{margin:0 18mm;padding:4mm 0 9mm;display:flex;justify-content:space-between;align-items:flex-end;gap:8mm;border-top:1px solid ${K.bordeaux};font-size:7.5pt;color:${K.text3};line-height:1.5}.foot .slogan{font-family:'Bodoni Moda',Georgia,serif;font-style:italic;font-size:10pt;color:${K.bordeauxDeep};white-space:nowrap;direction:ltr}.foot .slogan em{font-style:italic;color:${K.bordeauxSoft}}
.bar{position:fixed;right:16px;bottom:16px;direction:ltr;display:flex;gap:8px;z-index:9}.bar button{min-height:44px;padding:0 18px;border:1px solid ${K.bordeaux};background:${K.bordeaux};color:${K.cream};font:400 10.5pt ${ui};letter-spacing:.14em;text-transform:uppercase;cursor:pointer}
.after{width:210mm;max-width:100%;margin:0 auto 24mm;padding:0 0 8mm}
.after .panel{background:${K.cream};border:1px solid ${K.line2};padding:6mm 7mm;margin:0 0 5mm}.after .chip{display:inline-block;padding:1.2mm 4mm;border:1px solid ${K.champagne};color:${K.bordeauxSoft};font-size:8pt;letter-spacing:.24em;text-transform:uppercase}.after .ok{color:#3E7A4E;margin:3mm 0 0}.after .muted{color:${K.text3};font-size:10pt}
.btns{display:flex;flex-wrap:wrap;gap:4mm;margin:0 0 5mm}.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:12px 22px;border:1px solid ${K.bordeaux};background:${K.bordeaux};color:${K.cream};font:500 11pt ${ui};letter-spacing:.06em;text-decoration:none;cursor:pointer;flex:1 1 220px}.btn.ghost{background:transparent;color:${K.bordeaux}}
@media print{html,body{background:#fff}.sheet{margin:0;box-shadow:none;width:auto;min-height:297mm}.bar,.after{display:none}}
@media (max-width:760px){.sheet{width:auto;margin:0;min-height:0}.top{padding:10mm 6mm 8mm;flex-direction:column;align-items:flex-start}.doc{text-align:${start}}.doc .meta{white-space:normal}.inner{padding:8mm 6mm}.foot{margin:0 6mm;padding-bottom:26mm;flex-direction:column;align-items:flex-start}.cols,.two{grid-template-columns:1fr}th{letter-spacing:.12em}td,th{padding-left:1mm;padding-right:1mm}td.n{font-size:9pt}.u{display:none}.after{padding:6mm 16px 0}.tot{width:100%}}`;
  const contact = [M.tel, M.email, M.site].filter(Boolean).map(esc).join(' · ');
  const legalLine = legal
    ? [['Amane', ph(M.raison, 'Raison sociale'), ph(M.adresse, 'Adresse')].filter(Boolean).join(' · '), [M.siren || placeholders ? `SIREN ${ph(M.siren, 'SIREN')}` : '', M.tva || placeholders ? `TVA ${ph(M.tva, 'TVA intracom.')}` : ''].filter(Boolean).join(' · '), contact].filter(Boolean).join('<br>')
    : `Amane · ${esc(t(L, 'doc.house'))}${contact ? ' · ' + contact : ''}`;
  const footer = `<div class="foot"><div>${legalLine}</div><div class="slogan">Arrive as a <em>Guest</em>. Leave with a <em>Story</em>.</div></div>`;
  return `<!doctype html><html lang="${L.toLowerCase()}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light"><title>${esc(title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${rtl ? FONTS_RTL : FONTS_LTR}&display=swap">${extraHead}<style>${css}</style></head><body>
<div class="sheet">
<header class="top"><div class="brand"><span class="lg">${LOGO()}</span><div><b>AMANE</b><small>${esc(t(L, 'doc.house'))}</small></div></div><div class="doc"><h1>${esc(kind || title)}</h1>${num ? `<div class="num">${esc(num)}</div>` : ''}${meta ? `<div class="meta">${meta}</div>` : ''}</div></header><div class="rule"></div>
<div class="inner">${body}</div>
${footer}</div>
${after ? `<div class="after">${after}</div>` : ''}<div class="bar"><button type="button" onclick="window.print()">${esc(t(L, 'doc.print'))}</button></div>
</body></html>`;
}

const teamName = (id) => (TEAM.find((p) => p.id === id) || {}).nom || '';
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const D_LONG = { day: 'numeric', month: 'long', year: 'numeric' };
const D_SHORT = { day: '2-digit', month: '2-digit', year: 'numeric' };

/**
 * Devis ou facture complet.
 * @param {object} o  { mission, client, kind:'devis'|'facture', maison, placeholders?, after?, lang? }
 */
export function devisDoc({ mission, client, kind = 'devis', maison, placeholders = false, after = '', lang }) {
  const m = mission || {}, c = client || {};
  const L = lang || docLang(c);
  const T = (k, v) => esc(t(L, 'doc.' + k, v));
  const M = maisonInfo(maison);
  const ph = (v, label) => (v ? esc(v) : placeholders ? `<span class="ph">[${esc(label)}]</span>` : '');
  const dv = m.devis || {}, tot = devisTotals(dv), fac = kind === 'facture';
  const num = fac ? dv.factureNumero || '' : dv.numero || '';
  const dt = parseDay(fac ? dv.factureDate : dv.date) || parseDay(m.updatedAt) || new Date();
  const due = addDays(dt, fac ? 30 : 15);
  const meta = `${T('date')} ${esc(fmtDate(dt, L, D_SHORT))} &nbsp;·&nbsp; ${fac ? T('dueDate', { date: fmtDate(due, L, D_SHORT) }) : T('validUntil', { date: fmtDate(due, L, D_SHORT) })}`;
  const money = (n) => esc(fmtMoney(n, L));
  const rows = (dv.lignes || []).map((l) => `<tr><td>${esc(l.d)}</td><td class="n">${esc(l.q)}</td><td class="u">${esc(t(L, 'doc.unit.' + (l.u || 'forfait')))}</td><td class="n">${money(l.pu)}</td><td class="n">${money((+l.q || 0) * (+l.pu || 0))}</td></tr>`).join('');
  const paid = fac && tot.solde <= 0.005 && tot.ttc > 0;
  const pays = fac && (dv.paiements || []).length ? `<h2>${T('payments')}</h2><table><tbody>${dv.paiements.map((q) => { const d = parseDay(q.date); return `<tr><td>${d ? esc(fmtDate(d, L, D_LONG)) : ''}</td><td>${esc((MOYENS.find((x) => x.id === q.moyen) || {}).label || '')}</td><td class="n">${money(q.montant)}</td></tr>`; }).join('')}</tbody></table>` : '';
  const resp = teamName(m.responsable);
  const issuer = [ph(M.raison, 'Raison sociale'), ph(M.adresse, 'Adresse'), [M.siren || placeholders ? `SIREN ${ph(M.siren, 'SIREN')}` : '', M.tva || placeholders ? `TVA ${ph(M.tva, 'TVA intracom.')}` : ''].filter(Boolean).join(' · ')].filter(Boolean).join('<br>');
  const body = `<div class="cols"><div><div class="k">${T('issuer')}</div><div class="who"><b>Amane</b>${issuer}${resp ? `${issuer ? '<br>' : ''}<span class="mut">${T('yourContact')} : ${esc(resp)}</span>` : ''}</div></div>
<div><div class="k">${T('client')}</div><div class="who"><b>${esc(c.nom || '')}</b>${esc([c.hotel, c.pays].filter(Boolean).join(', '))}${c.hotel || c.pays ? '<br>' : ''}${esc([c.tel, c.email].filter(Boolean).join(' · '))}</div></div></div>
<div class="k" style="margin-bottom:3mm">${T('ref')} · ${esc(m.titre || '')}${fac && dv.numero ? ` · ${T('quote')} ${esc(dv.numero)}` : ''}</div>
<table><thead><tr><th>${T('desc')}</th><th class="n">${T('qty')}</th><th class="u">${T('unit')}</th><th class="n">${T('pu')}</th><th class="n">${T('total')}</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sum"><div class="tot"><div><span>${T('total')}</span><span>${money(tot.ht)}</span></div>${tot.rem ? `<div><span>${T('discount')} ${esc(dv.remise)} %</span><span>−${money(tot.rem)}</span></div>` : ''}<div><span>${T('vat')} ${esc(tot.rate)} %</span><span>${money(tot.tva)}</span></div><div class="g"><span>${T('ttc')}</span><span>${money(tot.ttc)}</span></div>${fac ? `<div><span>${T('paid')}</span><span>${money(tot.paid)}</span></div><div class="g"><span>${T('due')}</span><span>${money(Math.max(0, round2(tot.solde)))}</span></div>` : ''}${paid ? `<div><span></span><span class="stamp">${T('paidStamp')}</span></div>` : ''}</div></div>
${pays}
<div class="two"><div><h2>${T('terms')}</h2><p>${T('termsTxt')}</p><p class="note">${T('ttcNote')}</p></div><div><h2>${T('bank')}</h2><p>IBAN ${ph(M.iban, 'IBAN') || '—'}<br>BIC ${ph(M.bic, 'BIC') || '—'}</p><p class="it" style="margin-top:4mm">${T('thanks')}</p></div></div>`;
  const title = `${t(L, fac ? 'doc.invoice' : 'doc.quote')} ${num}`.trim();
  return docShell({ lang: L, title, body, legal: true, kind: t(L, fac ? 'doc.invoice' : 'doc.quote'), num, meta, maison: M, placeholders, after });
}

/** Étapes du programme triées par date (les étapes « interne » restent dans le CRM, pas sur le carnet). */
export function programmeSteps(mission) {
  return (Array.isArray(mission && mission.programme) ? mission.programme : []).filter((x) => x && x.dt && parseDay(x.dt)).sort((a, b) => +parseDay(a.dt) - +parseDay(b.dt));
}

/**
 * Carnet de séjour (programme) au gabarit A4.
 * @param {object} o  { mission, client, partenaires, maison, lang? }
 */
export function carnetDoc({ mission, client, partenaires = [], maison, lang }) {
  const m = mission || {}, c = client || {};
  const L = lang || docLang(c);
  const T = (k, v) => esc(t(L, 'doc.' + k, v));
  const M = maisonInfo(maison);
  const pById = (id) => (id ? partenaires.find((p) => p && (p.id === id || p._id === id)) : null);
  let day = '', h = '';
  for (const x of programmeSteps(m)) {
    const d = parseDay(x.dt);
    const dl = fmtDate(d, L, { weekday: 'long', day: 'numeric', month: 'long' });
    if (dl !== day) { day = dl; h += `<div class="day">${esc(cap(dl))}</div>`; }
    const p = pById(x.partenaireId);
    const where = [x.lieu, p && p.adresse].filter(Boolean).join(' · ');
    h += `<div class="st"><b>${esc(fmtTime(d, L))}</b><div><div class="t">${esc(t(L, 'doc.type.' + (x.type || 'autre')))}${p ? ' — ' + esc(p.nom) : ''}</div>${where ? `<div class="muted">${esc(where)}</div>` : ''}${x.client ? `<div class="cl">${esc(x.client)}</div>` : ''}</div></div>`;
  }
  const a = parseDay(m.debut), b = parseDay(m.fin);
  const period = a ? fmtDate(a, L, { day: 'numeric', month: 'long' }) + (b ? ' — ' + fmtDate(b, L, D_LONG) : '') : '';
  const resp = teamName(m.responsable);
  const reach = [M.tel, M.email].filter(Boolean).map(esc).join(' · ');
  const nom = String(c.nom || '').trim();
  const body = `<div class="cols"><div><div class="k">${T('client')}</div><div class="who"><b>${esc(nom)}</b>${esc([c.hotel, c.pays].filter(Boolean).join(', '))}</div></div><div><div class="k">${T('yourContact')}</div><div class="who"><b>${esc(resp || 'Amane')}</b>${reach}</div></div></div>
<p class="it" style="font-size:12.5pt;margin:0 0 4mm">${nom ? T('hello', { nom }) : T('helloAnon')}</p><p>${T('progIntro')}</p>${h || '<p>—</p>'}<p class="it" style="margin-top:8mm;white-space:pre-line">${T('sign')}</p>`;
  return docShell({ lang: L, title: t(L, 'doc.prog'), body, legal: false, kind: t(L, 'doc.prog'), meta: period ? esc(period) : '', maison: M });
}

