// « Tableau du lundi » : CA de la semaine passée, missions à venir (7 j), véhicules en révision, factures en retard,
// 3 clients à relancer. Rédigé par Claude en français quand l'IA est active, sinon texte déterministe.
import { labelOf, SERVICES, devisTotals, ACTIVE_STATUTS, fmtMoney } from '@amane/shared';
import { now } from './clock.js';
import { parisDay, addWallDays, wallToMs, parisToMs } from './paris.js';
import { computeRelances } from './relances.js';
import { aiConfigured, digestText } from './ai.js';
import { waConfigured, teamNumbers, graphSend, textPayload, templatePayload, ALERT_TEMPLATE } from './whatsapp.js';
import { nowIso } from './clock.js';

const DAY = 86400000;

/** Lundi (AAAA-MM-JJ, Paris) de la semaine contenant `day`. */
export function mondayOf(day) {
  const [y, m, d] = day.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = dimanche
  return addWallDays(day, dow === 0 ? -6 : 1 - dow);
}

/** `semaine` : « AAAA-MM-JJ » (un jour de la semaine voulue) ou « AAAA-Www » ; défaut : semaine courante. */
export function weekBounds(semaine, nowMs = now()) {
  let day = parisDay(nowMs);
  const w = /^(\d{4})-W(\d{2})$/.exec(String(semaine || ''));
  if (w) {
    const jan4 = `${w[1]}-01-04`;
    day = addWallDays(mondayOf(jan4), (Number(w[2]) - 1) * 7);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(String(semaine || ''))) day = semaine;
  const monday = mondayOf(day);
  return { monday, sunday: addWallDays(monday, 6), prevMonday: addWallDays(monday, -7), prevSunday: addWallDays(monday, -1) };
}

export async function computeDigest(db, semaine, nowMs = now()) {
  const b = weekBounds(semaine, nowMs);
  const [missions, vehicules, clients] = await Promise.all([
    db.collection('missions').find({ _deleted: { $ne: true } }).toArray(),
    db.collection('vehicules').find({ _deleted: { $ne: true } }).toArray(),
    db.collection('clients').find({ _deleted: { $ne: true } }).toArray(),
  ]);
  const cname = (id) => { const c = clients.find((x) => x._id === id); return c ? c.nom : ''; };
  const vname = (id) => { const v = vehicules.find((x) => x._id === id); return v ? v.nom : ''; };
  const inRange = (day, a, z) => day && day >= a && day <= z;
  const montantOf = (m) => (m.devis && m.devis.lignes && m.devis.lignes.length ? devisTotals(m.devis).ttc : +m.montant || 0);
  const prev = missions.filter((m) => ACTIVE_STATUTS.includes(m.statut) && inRange(String(m.debut || '').slice(0, 10), b.prevMonday, b.prevSunday));
  const ca = Math.round(prev.reduce((x, m) => x + montantOf(m), 0));
  const aVenir = missions
    .filter((m) => ['confirmee', 'encours'].includes(m.statut) && inRange(String(m.debut || '').slice(0, 10), b.monday, b.sunday))
    .sort((x, y) => String(x.debut).localeCompare(String(y.debut)))
    .map((m) => ({ id: m._id, jour: String(m.debut).slice(0, 10), heure: String(m.debut).slice(11, 16), client: cname(m.clientId), service: labelOf(SERVICES, m.service, m.service || ''), vehicule: vname(m.vehiculeId), lieu: m.lieu || '', responsable: m.responsable || '', montant: montantOf(m) }));
  const revisions = vehicules
    .filter((v) => v.statut === 'entretien' || (v.revision && String(v.revision).slice(0, 10) <= addWallDays(b.sunday, 14)))
    .map((v) => ({ id: v._id, nom: v.nom, statut: v.statut || 'disponible', revision: v.revision || '' }));
  const facturesRetard = missions
    .filter((m) => m.devis && m.devis.factureNumero && devisTotals(m.devis).solde > 0.005 && (wallToMs(m.devis.factureDate) || 0) < nowMs - 30 * DAY)
    .map((m) => ({ id: m._id, numero: m.devis.factureNumero, client: cname(m.clientId), reste: devisTotals(m.devis).solde, date: m.devis.factureDate || '' }));
  const relances = (await computeRelances(db, nowMs)).filter((r) => !r.bloqueeJusqua).slice(0, 3).map((r) => ({ clientId: r.clientId, nom: r.nom, type: r.type, raison: r.raison }));
  return { semaine: b.monday, du: b.monday, au: b.sunday, caSemainePassee: ca, nbMissionsSemainePassee: prev.length, missionsAVenir: aVenir, vehiculesRevision: revisions, facturesRetard, relances };
}

/** Texte français sans IA. */
export function digestFallback(d) {
  const L = [];
  L.push(`Tableau du lundi — semaine du ${d.du}. Chiffre d'affaires de la semaine passée : ${fmtMoney(d.caSemainePassee, 'FR', { decimals: 0 })} (${d.nbMissionsSemainePassee} mission${d.nbMissionsSemainePassee > 1 ? 's' : ''}).`);
  L.push('', 'Cette semaine :');
  if (!d.missionsAVenir.length) L.push('— aucune mission confirmée.');
  for (const m of d.missionsAVenir) L.push(`— ${m.jour} ${m.heure} · ${m.client} · ${m.service}${m.vehicule ? ' · ' + m.vehicule : ''}${m.lieu ? ' · ' + m.lieu : ''}`);
  L.push('', 'Flotte :');
  if (!d.vehiculesRevision.length) L.push('— rien à signaler.');
  for (const v of d.vehiculesRevision) L.push(`— ${v.nom} : ${v.statut === 'entretien' ? 'en entretien' : 'révision ' + v.revision}`);
  L.push('', 'Finances :');
  if (!d.facturesRetard.length) L.push('— aucune facture en retard.');
  for (const f of d.facturesRetard) L.push(`— ${f.numero} · ${f.client} · ${fmtMoney(f.reste, 'FR')} restants`);
  L.push('', 'À relancer :');
  if (!d.relances.length) L.push('— personne pour l’instant.');
  for (const r of d.relances) L.push(`— ${r.nom} : ${r.raison}`);
  L.push('', 'Belle semaine à tous.');
  return L.join('\n');
}

export async function buildDigest(db, semaine, nowMs = now()) {
  const data = await computeDigest(db, semaine, nowMs);
  let texte = null; let ia = false;
  if (aiConfigured()) {
    try { texte = await digestText(data); ia = true; } catch (e) { console.error('[amane] digest IA', e && (e.code || e.message)); }
  }
  if (!texte) texte = digestFallback(data);
  return { ...data, texte, ia };
}

/** Envoi WhatsApp du tableau à toute l'équipe (TEAM_ALERT_NUMBERS). Jamais d'exception. */
export async function sendDigest(db, nowMs = now()) {
  const out = { sent: [], skipped: [] };
  if (!waConfigured()) return { ...out, skipped: ['whatsapp_off'] };
  const numbers = teamNumbers();
  if (!Object.keys(numbers).length) return { ...out, skipped: ['aucun_numero'] };
  const key = 'digest:' + parisDay(nowMs);
  try {
    await db.collection('meta').insertOne({ _id: key, at: nowIso() });
  } catch (e) { if (e && e.code === 11000) return { ...out, skipped: ['deja_envoye'] }; throw e; }
  const d = await buildDigest(db, undefined, nowMs);
  for (const [who, to] of Object.entries(numbers)) {
    try {
      const conv = await db.collection('conversations').findOne({ _id: to }, { projection: { windowUntil: 1 } });
      const open = Boolean(conv && conv.windowUntil && Date.parse(conv.windowUntil) > nowMs);
      const payload = open ? textPayload(to, d.texte.slice(0, 4000)) : templatePayload(to, ALERT_TEMPLATE, 'fr', ['Tableau du lundi', `CA ${fmtMoney(d.caSemainePassee, 'FR', { decimals: 0 })}, ${d.missionsAVenir.length} mission(s) cette semaine`.slice(0, 60)]);
      await graphSend(payload, { timeoutMs: 6000 });
      out.sent.push(who);
    } catch (e) {
      out.skipped.push(who + ':' + (e && e.message));
    }
  }
  return out;
}
