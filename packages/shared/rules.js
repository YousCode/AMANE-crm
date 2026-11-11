// Règles métier pures (aucune dépendance, aucun accès réseau ni base).
// Les dates « AAAA-MM-JJTHH:MM » sont lues en heure locale, comme dans le CRM.
import { TASK_TPL, BOOK_STATUTS, OPT_STATUTS, OPEN_STATUTS, STATUTS, DOC_LANGS } from './constants.js';

// ---------- dates ----------

export const pad2 = (n) => String(n).padStart(2, '0');
/** Date → « AAAA-MM-JJTHH:MM » (heure locale). */
export const toLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
/** Chaîne ou Date → Date, ou null si vide ou invalide. */
export const parseDate = (s) => { if (!s) return null; const d = s instanceof Date ? new Date(s.getTime()) : new Date(s); return Number.isNaN(d.getTime()) ? null : d; };
/** Minuit (heure locale) du jour donné. */
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** Nombre de jours calendaires couverts par la mission (au moins 1 si `debut` est lisible, 0 sinon). */
export function durDays(m) {
  const a = parseDate(m && m.debut); const b = parseDate(m && m.fin) || a;
  if (!a) return 0;
  return Math.max(1, Math.round((startOfDay(b) - startOfDay(a)) / 864e5) + 1);
}

/** Jours de la mission compris dans [from, to] (bornes incluses, jour par jour). */
export function overlapDays(m, from, to) {
  const a = parseDate(m && m.debut); const b = parseDate(m && m.fin) || a;
  const f = parseDate(from); const t = parseDate(to) || f;
  if (!a || !f) return 0;
  const s = Math.max(startOfDay(a), startOfDay(f)); const e = Math.min(startOfDay(b), startOfDay(t));
  if (e < s) return 0;
  return Math.round((e - s) / 864e5) + 1;
}

// ---------- conflits ----------

const idOf = (m) => (m && (m.id ?? m._id)) ?? '';

function overlapping(m, all, key) {
  if (!m || !m[key] || !OPEN_STATUTS.includes(m.statut)) return [];
  const a = parseDate(m.debut); const b = parseDate(m.fin) || a;
  if (!a) return [];
  return (all || []).filter((o) => {
    if (!o || idOf(o) === idOf(m) || o[key] !== m[key] || !BOOK_STATUTS.includes(o.statut) || o._deleted) return false;
    const oa = parseDate(o.debut); if (!oa) return false;
    const ob = parseDate(o.fin) || oa;
    return oa < b && ob > a;
  });
}

/** Missions confirmées/en cours qui occupent déjà le véhicule de `m` sur son créneau. */
export const clashes = (m, all) => overlapping(m, all, 'vehiculeId');
/** Même chose pour le chauffeur (`chauffeurId`). */
export const chClashes = (m, all) => overlapping(m, all, 'chauffeurId');

/**
 * État d'un véhicule sur [a, b] : {k:'f'} libre, {k:'b', m} réservé, {k:'o', m} option, {k:'off', t} indisponible.
 * `excl` : id d'une mission à ignorer (celle qu'on édite).
 */
export function vehicleOn(v, missions, a, b, excl) {
  if (v.statut && v.statut !== 'disponible') return { k: 'off', t: v.statut === 'entretien' ? 'En entretien' : 'Indisponible' };
  if (v.aValider) return { k: 'off', t: 'À valider' };
  const from = parseDate(a);
  if (!from) return { k: 'f' };
  const to = parseDate(b) || from;
  const vid = idOf(v);
  const ov = (missions || []).filter((m) => m && !m._deleted && m.vehiculeId === vid && idOf(m) !== excl && [...BOOK_STATUTS, ...OPT_STATUTS].includes(m.statut) && parseDate(m.debut))
    .filter((m) => parseDate(m.debut) < to && (parseDate(m.fin) || parseDate(m.debut)) > from);
  const bk = ov.find((m) => BOOK_STATUTS.includes(m.statut));
  if (bk) return { k: 'b', m: bk };
  const op = ov.find((m) => OPT_STATUTS.includes(m.statut));
  if (op) return { k: 'o', m: op };
  // Véhicule d'un prestataire : libre seulement sur les jours qu'il a déclarés ; sinon il faut lui demander.
  if (v.partenaireId) {
    // Un « oui » du prestataire à une demande vaut jours déclarés sur la période de cette mission (la réponse est posée par le serveur ;
    // les `dispos` de la fiche, elles, peuvent avoir été réécrites depuis un écran en retard).
    const oui = (missions || []).filter((m) => m && !m._deleted && parseDate(m.debut) && (dispoDemandeOf(m, vid) || {}).statut === 'oui')
      .map((m) => ({ du: dayKey(parseDate(m.debut)), au: dayKey(parseDate(m.fin) || parseDate(m.debut)) }));
    if (!dispoCovers({ dispos: [...(Array.isArray(v.dispos) ? v.dispos : []), ...oui] }, from, to)) return { k: 'off', t: 'Dispo à demander', ask: true };
  }
  return { k: 'f' };
}

// ---------- véhicules des prestataires (loueurs) ----------

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Périodes de disponibilité propres : [{du, au}] en « AAAA-MM-JJ », du ≤ au, triées, fusionnées quand elles se touchent, 60 au plus. */
export function normDispos(list) {
  const ok = (Array.isArray(list) ? list : [])
    .filter((p) => p && DAY_RE.test(String(p.du)) && DAY_RE.test(String(p.au)) && parseDate(p.du) && parseDate(p.au))
    .map((p) => (p.du <= p.au ? { du: p.du, au: p.au } : { du: p.au, au: p.du }))
    .sort((x, y) => x.du.localeCompare(y.du));
  const out = [];
  for (const p of ok) {
    const last = out[out.length - 1];
    const [y, m, d] = last ? last.au.split('-').map(Number) : [];
    const next = last ? dayKey(new Date(y, m - 1, d + 1)) : '';
    if (last && p.du <= next) { if (p.au > last.au) last.au = p.au; } else out.push(p);
  }
  return out.slice(0, 60);
}

/** Vrai si chaque jour de [a, b] est dans une période déclarée du véhicule (`v.dispos`). */
export function dispoCovers(v, a, b) {
  const from = parseDate(a); if (!from) return false;
  const to = parseDate(b) || from;
  const periods = normDispos(v && v.dispos);
  if (!periods.length) return false;
  const end = dayKey(to);
  let cur = startOfDay(from);
  for (let i = 0; i < 400; i++) {
    const k = dayKey(cur);
    if (!periods.some((p) => p.du <= k && k <= p.au)) return false;
    if (k >= end) return true;
    cur = addDays(cur, 1);
  }
  return false;
}

/** Ajoute la période [a, b] (dates de mission) aux disponibilités d'un véhicule. */
export function addDispo(dispos, a, b) {
  const from = parseDate(a); if (!from) return normDispos(dispos);
  const to = parseDate(b) || from;
  return normDispos([...(Array.isArray(dispos) ? dispos : []), { du: dayKey(from), au: dayKey(to) }]);
}

/** Demande de disponibilité d'une mission pour un véhicule (ou null). */
export const dispoDemandeOf = (m, vehiculeId) => ((m && Array.isArray(m.dispoDemandes) ? m.dispoDemandes : []).find((d) => d && d.vehiculeId === vehiculeId)) || null;

/** Coût d'achat d'une mission auprès du prestataire (prix d'achat / jour × jours) et marge sur le montant TTC. */
export function margePrestataire(m, v) {
  const pa = +((v && v.prixAchatJour) || 0);
  if (!v || !v.partenaireId || !pa) return null;
  const cout = round2(pa * durDays(m));
  const vente = +((m && m.montant) || 0);
  return { cout, vente, marge: round2(vente - cout), taux: vente > 0 ? Math.round(((vente - cout) / vente) * 100) : 0 };
}

/** « Qui est libre ? » : véhicules disponibles et sans réservation ferme sur [from, to], triés par `ordre`. Les options sont tolérées (voir `vehicleOn`). */
export function freeVehicles(vehicules, missions, from, to, { excl, strict = false } = {}) {
  return (vehicules || [])
    .filter((v) => v && !v._deleted)
    .filter((v) => { const s = vehicleOn(v, missions, from, to, excl); return s.k === 'f' || (!strict && s.k === 'o'); })
    .sort((x, y) => (+x.ordre || 99) - (+y.ordre || 99));
}

// ---------- tâches, devis, numéros ----------

/** Tâches types d'une mission d'après son service et ses dates : [{t, resp, due:'AAAA-MM-JJ', fait:false}]. */
export function tplTasks(d) {
  const a = startOfDay(parseDate(d && d.debut) || new Date());
  const b = startOfDay(parseDate(d && d.fin) || parseDate(d && d.debut) || new Date());
  return (TASK_TPL[d && d.service] || []).map(([t, resp, off]) => {
    let base = a; let o = off;
    if (typeof off === 'string') { base = b; o = +(off.split('+')[1] || 0); }
    return { t, resp, due: toLocal(addDays(base, o)).slice(0, 10), fait: false };
  });
}

export const round2 = (n) => Math.round((+n || 0) * 100) / 100;

/** Totaux d'un devis : HT, remise, base, TVA (20 % par défaut), TTC, réglé, solde. */
export function devisTotals(dv) {
  dv = dv || {};
  const ht = (dv.lignes || []).reduce((x, l) => x + (+l.q || 0) * (+l.pu || 0), 0);
  const rem = ht * (+dv.remise || 0) / 100;
  const base = ht - rem;
  const rate = dv.tva === '' || dv.tva == null ? 20 : +dv.tva;
  const tva = base * rate / 100;
  const ttc = base + tva;
  const paid = (dv.paiements || []).reduce((x, q) => x + (+q.montant || 0), 0);
  return { ht: round2(ht), rem: round2(rem), base: round2(base), tva: round2(tva), rate, ttc: round2(ttc), paid: round2(paid), solde: round2(round2(ttc) - round2(paid)) };
}

/** Numéro de document : numeroFormat('devis', 2026, 1) → « D-2026-0001 », 'facture' → « F-2026-0001 ». */
export function numeroFormat(kind, year, n) {
  const pre = kind === 'facture' ? 'F' : 'D';
  return `${pre}-${year}-${String(n).padStart(4, '0')}`;
}
/** Clé de compteur serveur pour `POST /api/counter` : « devis-2026 ». */
export const numeroKey = (kind, year) => `${kind === 'facture' ? 'facture' : 'devis'}-${year}`;

/** Statut de paiement calculé : 'non' | 'acompte' | 'solde', d'après le devis (règlements) sinon montant/acompte. */
export function paiementStatut(m) {
  if (!m) return 'non';
  if (m.devis && Array.isArray(m.devis.lignes) && m.devis.lignes.length) {
    const t = devisTotals(m.devis);
    if (t.ttc > 0 && t.solde <= 0.005) return 'solde';
    if (t.paid > 0) return 'acompte';
    return 'non';
  }
  const montant = +m.montant || 0; const acompte = +m.acompte || 0;
  if (montant > 0 && acompte >= montant) return 'solde';
  if (acompte > 0) return 'acompte';
  return ['non', 'acompte', 'solde'].includes(m.paiement) ? m.paiement : 'non';
}

const FLOW = ['nouvelle', 'proposition', 'confirmee', 'encours', 'terminee'];
/** Statut suivant dans le parcours (null au bout ou pour « perdue »). */
export const nextStatut = (s) => { const i = FLOW.indexOf(s); return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null; };
/** Statut précédent (null au début ; « perdue » revient à « proposition »). */
export const prevStatut = (s) => { if (s === 'perdue') return 'proposition'; const i = FLOW.indexOf(s); return i > 0 ? FLOW[i - 1] : null; };
export const statutLabel = (s) => (STATUTS.find((x) => x.id === s) || {}).label || (s ? String(s) : '—');

// ---------- téléphone, liens ----------

/**
 * Numéro → chiffres avec indicatif, sans « + » (format WhatsApp, identique à `telNorm` du serveur).
 *   « 06 12 34 56 78 » → 33612345678 · « +33 (0)6 12 34 56 78 » → 33612345678 · « 0033… » → 33… · « +971 50 123 4567 » → 971501234567
 */
export function telNorm(input) {
  if (input === null || input === undefined) return '';
  let s = String(input).trim();
  if (!s) return '';
  s = s.replace(/\(0\)/g, '');
  const plus = s.startsWith('+');
  let d = s.replace(/\D/g, '');
  if (!d) return '';
  if (plus) { /* déjà international */ } else if (d.startsWith('00')) d = d.slice(2);
  else if (d.length === 10 && d.startsWith('0')) d = '33' + d.slice(1);
  if (d.startsWith('330') && d.length === 12) d = '33' + d.slice(3);
  if (d.length < 6 || d.length > 15) return '';
  return d;
}
/** « +33612345678 » (vide si inexploitable). */
export const telPlus = (tel) => { const d = telNorm(tel); return d ? '+' + d : ''; };
/** Affichage lisible : « +33 6 12 34 56 78 ». */
export function telFmt(tel) {
  const d = telNorm(tel);
  if (!d) return '';
  if (/^33\d{9}$/.test(d)) return '+33 ' + d.slice(2, 3) + ' ' + d.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ');
  const m = d.match(/^(1|7|2\d|3\d|4\d|5\d|6\d|8\d|9\d{2}|9\d)(\d+)$/);
  return m ? '+' + m[1] + ' ' + m[2].replace(/(\d{3})(?=\d{2})/g, '$1 ') : '+' + d;
}
export const telHref = (tel) => { const p = telPlus(tel); return p ? 'tel:' + p : ''; };

/** Lien WhatsApp « cliquer pour discuter » (sans numéro : simple partage du texte). */
export function waLink(tel, text) {
  const n = telNorm(tel);
  const q = text ? '?text=' + encodeURIComponent(text) : '';
  return n.length >= 8 ? `https://wa.me/${n}${q}` : `https://wa.me/${q}`;
}

/** Itinéraire vers un lieu (Paris ajouté si rien ne précise la ville). `apple:true` → Plans. */
export function mapsLink(lieu, { apple = false } = {}) {
  let q = String(lieu || '').trim();
  if (!q) return '';
  if (!/paris|→|\d{5}/i.test(q)) q += ', Paris';
  return apple ? 'https://maps.apple.com/?daddr=' + encodeURIComponent(q) : 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(q);
}

// ---------- langue ----------

const WORDS = {
  FR: ['bonjour', 'bonsoir', 'merci', 'je', 'vous', 'nous', 'est', 'une', 'pour', 'avec', 'voiture', 'demain', 'besoin', 'souhaite', 'voudrais', 'aimerais', 'svp', 'stp', 'combien', 'disponible', 'semaine', 'chez', 'mon', 'mes', 'ma', 'le', 'la', 'les', 'des', 'du', 'et', 'aujourd', 'soir', 'matin', 'oui', 'non', 'possible', 'location', 'louer', 'prix', 'tarif'],
  EN: ['hello', 'hi', 'hey', 'thanks', 'thank', 'please', 'the', 'and', 'is', 'are', 'you', 'we', 'need', 'would', 'like', 'want', 'car', 'tomorrow', 'available', 'how', 'much', 'price', 'rent', 'rental', 'for', 'with', 'my', 'this', 'next', 'week', 'tonight', 'morning', 'yes', 'can', 'could', 'airport', 'pick', 'driver'],
  ES: ['hola', 'gracias', 'por', 'favor', 'quiero', 'quisiera', 'necesito', 'coche', 'mañana', 'para', 'con', 'buenos', 'buenas', 'días', 'cuánto', 'cuanto', 'precio', 'alquilar', 'alquiler', 'disponible', 'semana', 'noche', 'el', 'los', 'las', 'una', 'un', 'es', 'está', 'sí', 'nosotros', 'conductor', 'aeropuerto', 'mi'],
};

/** Langue d'un texte : 'AR', 'RU', 'FR', 'EN', 'ES', ou null si incertain. */
export function detectLang(text) {
  const s = String(text || '');
  if (!s.trim()) return null;
  const arabic = (s.match(/[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g) || []).length;
  const cyr = (s.match(/[Ѐ-ӿ]/g) || []).length;
  const latin = (s.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  if (arabic && arabic >= latin / 2) return 'AR';
  if (cyr && cyr >= latin / 2) return 'RU';
  const words = s.toLowerCase().normalize('NFC').match(/[a-zà-ÿñ']+/g) || [];
  const score = { FR: 0, EN: 0, ES: 0 };
  for (const w0 of words) {
    const w = w0.replace(/^[a-z]'/, '');
    for (const L of Object.keys(score)) if (WORDS[L].includes(w)) score[L]++;
  }
  if (/[ñ¿¡]/i.test(s)) score.ES += 2;
  if (/[çœ]|[éèêàù]/i.test(s)) score.FR += 1;
  if (/\b(j|l|d|qu|n|c|s)'/i.test(s)) score.FR += 1;
  const best = Object.entries(score).sort((a, b) => b[1] - a[1]);
  if (best[0][1] === 0 || best[0][1] === best[1][1]) return null;
  return best[0][0];
}

/** Langue probable d'après l'indicatif téléphonique (dernier recours), ou null. */
export function langFromPhone(digits) {
  const d = telNorm(digits) || String(digits || '').replace(/\D/g, '');
  if (/^(33|32|41|352|377|212|213|216)/.test(d)) return 'FR';
  if (/^(971|966|974|965|973|968|962|961|20|964)/.test(d)) return 'AR';
  if (/^(7|375|380)/.test(d)) return 'RU';
  if (/^(34|52|54|57|56|51|58)/.test(d)) return 'ES';
  if (/^(44|1|61|64|353|27|91|65|852)/.test(d)) return 'EN';
  return null;
}

/** Langue des documents d'un client : FR, EN, ES ou AR (EN par défaut). */
export function docLang(client) {
  const l = String((client && client.langue) || '').toUpperCase();
  return DOC_LANGS.includes(l) ? l : 'EN';
}
export const isRtl = (lang) => String(lang || '').toUpperCase() === 'AR';

// ---------- service deviné, prénom ----------

const SERVICE_KEYS = [
  ['transfert', ['aéroport', 'aeroport', 'airport', 'cdg', 'orly', 'bourget', 'roissy', 'transfert', 'transfer', 'navette', 'beauvais', 'gare du nord', 'gare de lyon', 'مطار', 'аэропорт', 'aeropuerto']],
  ['van', ['van', 'classe v', 'class v', 'v-class', 'minivan', 'vito', 'sprinter', '7 places', '8 places', '7 seats', '8 seats', 'فان', 'минивэн']],
  ['chauffeur', ['chauffeur', 'driver', 'avec conducteur', 'mise à disposition', 'mise a disposition', 'conductor', 'سائق', 'водитель']],
  ['shopping', ['shopping', 'shopper', 'boutique', 'boutiques', 'achats', 'avenue montaigne', 'تسوق', 'шопинг']],
  ['sejour', ['séjour', 'sejour', 'hôtel', 'hotel', 'villa', 'appartement', 'apartment', 'stay', 'palace', 'suite', 'إقامة', 'فندق', 'отель']],
  ['location', ['voiture', 'car', 'cars', 'urus', 'ferrari', 'g63', 'g 63', 'classe g', 'lamborghini', 'rolls', 'bentley', 'porsche', 'mclaren', 'm5', 'location', 'louer', 'rent', 'rental', 'coche', 'alquiler', 'سيارة', 'машина', 'аренда']],
];
function hasKey(s, k) {
  if (/^[a-z0-9 -]+$/.test(k)) return new RegExp(`(^|[^a-z0-9à-ÿ])${k.replace(/[-]/g, '\\-')}($|[^a-z0-9à-ÿ])`).test(s);
  return s.includes(k);
}
/** Service deviné d'après le texte (id de `SERVICES`), ou null. */
export function guessServiceOrNull(text) {
  const s = String(text || '').toLowerCase();
  for (const [svc, keys] of SERVICE_KEYS) if (keys.some((k) => hasKey(s, k))) return svc;
  return null;
}
/** Service deviné ; `location` par défaut. */
export const guessService = (text) => guessServiceOrNull(text) || 'location';

/** Prénom tiré d'un nom (profil WhatsApp ou fiche), ou '' s'il n'est pas exploitable. */
export function firstName(name) {
  const s = String(name || '').normalize('NFC').trim();
  if (!s) return '';
  const first = s.split(/\s+/)[0].replace(/[^\p{L}\p{M}'’-]/gu, '');
  if ([...first].filter((c) => /\p{L}/u.test(c)).length < 2) return '';
  if (/^\p{Ll}/u.test(first) || first === first.toUpperCase()) return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  return first;
}

/** Remplace `{var}` ; une variable absente est retirée proprement (virgule et espaces compris). */
export function fillVars(text, vars = {}) {
  let out = String(text || '');
  for (const [k, v] of Object.entries(vars)) if (v !== undefined && v !== null && String(v) !== '') out = out.split(`{${k}}`).join(String(v));
  return out.replace(/[ \t]*,?[ \t]*\{[a-zA-Z_]+\}/g, '').replace(/\s+([,،!.])/g, '$1').replace(/[ \t]{2,}/g, ' ').trim();
}

/** Fenêtre WhatsApp de 24 h ouverte ? (conversation.windowUntil) */
export const windowOpen = (conv, nowMs = Date.now()) => Boolean(conv && conv.windowUntil && Date.parse(conv.windowUntil) > nowMs);
