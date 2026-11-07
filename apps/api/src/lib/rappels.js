// Rappels automatiques WhatsApp : veille de mission (J-1 18 h), remerciement (J+1 10 h), acompte (J-3 9 h).
// Idempotents (collection `rappels`, _id = type:missionId ; l'acompte n'est pas relancé s'il vient de l'être à la main), désactivables par type (reglages/rappels), langue du client.
import { t, fmtMoney, fmtDate, fmtTime, labelOf, SERVICES, paiementStatut, devisTotals, RAPPEL_TYPES } from '@amane/shared';
import { now, nowIso } from './clock.js';
import { wallToMs, parisToMs, addWallDays } from './paris.js';
import { waConfigured, sendToConversation, clientFirstName } from './whatsapp.js';
import { logActivity } from './docs.js';
import { emit } from './bus.js';
import { toApi } from './db.js';

const DAY = 86400000;
const BOOK = ['confirmee', 'encours'];

export async function getRappelReglages(db) {
  const d = (await db.collection('reglages').findOne({ _id: 'rappels', _deleted: { $ne: true } })) || {};
  const actifs = {};
  for (const r of RAPPEL_TYPES) actifs[r.id] = !(d.actifs && d.actifs[r.id] === false);
  return { actifs, textes: d.textes || {} };
}

function dayOf(s) { return String(s || '').slice(0, 10); }

/** Rappels dus maintenant (sans écrire) : [{type, mission, dueAt, until}]. */
export async function computeDue(db, nowMs = now()) {
  const reg = await getRappelReglages(db);
  const since = new Date(nowMs - 10 * DAY).toISOString();
  const missions = await db.collection('missions').find({ _deleted: { $ne: true }, statut: { $in: ['proposition', 'confirmee', 'encours', 'terminee'] }, updatedAt: { $gt: new Date(nowMs - 400 * DAY).toISOString() } }).toArray();
  const out = [];
  for (const m of missions) {
    if (!m.clientId || !/^\d{4}-\d{2}-\d{2}/.test(String(m.debut || ''))) continue;
    const debutMs = wallToMs(m.debut);
    const finMs = wallToMs(m.fin) || debutMs;
    const dDay = dayOf(m.debut); const fDay = dayOf(m.fin) || dDay;
    if (reg.actifs.veille && BOOK.includes(m.statut)) {
      const [y, mo, d] = addWallDays(dDay, -1).split('-').map(Number);
      const dueAt = parisToMs(y, mo, d, 18, 0);
      if (nowMs >= dueAt && nowMs < debutMs) out.push({ type: 'veille', mission: m, dueAt, until: debutMs });
    }
    if (reg.actifs.merci && ['confirmee', 'encours', 'terminee'].includes(m.statut) && finMs) {
      const [y, mo, d] = addWallDays(fDay, 1).split('-').map(Number);
      const dueAt = parisToMs(y, mo, d, 10, 0);
      if (nowMs >= dueAt && nowMs < dueAt + 3 * DAY) out.push({ type: 'merci', mission: m, dueAt, until: dueAt + 3 * DAY });
    }
    if (reg.actifs.acompte && ['proposition', 'confirmee'].includes(m.statut) && paiementStatut(m) === 'non') {
      const montant = m.devis && m.devis.lignes && m.devis.lignes.length ? devisTotals(m.devis).ttc : +m.montant || 0;
      if (montant > 0) {
        const [y, mo, d] = addWallDays(dDay, -3).split('-').map(Number);
        const dueAt = parisToMs(y, mo, d, 9, 0);
        if (nowMs >= dueAt && nowMs < debutMs) out.push({ type: 'acompte', mission: m, dueAt, until: debutMs, montant });
      }
    }
  }
  void since;
  return out;
}

/** Texte du rappel dans la langue du client (réglages, sinon @amane/shared). */
export function rappelText({ type, lang, textes, vars }) {
  const custom = textes && textes[lang] && typeof textes[lang][type] === 'string' && textes[lang][type].trim() ? textes[lang][type] : null;
  if (custom) return require_fill(custom, vars);
  return t(lang, 'rappel.' + type, vars);
}
function require_fill(text, vars) {
  let out = text;
  for (const [k, v] of Object.entries(vars || {})) out = out.split(`{${k}}`).join(v === undefined || v === null ? '' : String(v));
  return out.replace(/[ \t]*,?[ \t]*\{[a-zA-Z_]+\}/g, '').replace(/\s+([,،!.])/g, '$1').trim();
}

async function convFor(db, m, client) {
  if (m.convId) { const c = await db.collection('conversations').findOne({ _id: m.convId }); if (c) return c; }
  if (client && client.telNorm) return db.collection('conversations').findOne({ _id: client.telNorm });
  return null;
}

/** Envoie les rappels dus. Renvoie {envoyes, ignores, echecs, details}. Jamais deux fois le même. */
export async function runRappels(db, { nowMs = now(), maxAttempts = 3 } = {}) {
  const res = { envoyes: 0, ignores: 0, echecs: 0, details: [] };
  if (!waConfigured()) return { ...res, skipped: 'whatsapp_off' };
  const reg = await getRappelReglages(db);
  const due = await computeDue(db, nowMs);
  const col = db.collection('rappels');
  for (const d of due) {
    const id = `${d.type}:${d.mission._id}`;
    const at = nowIso();
    const existing = await col.findOne({ _id: id });
    if (existing && (existing.statut === 'envoye' || existing.statut === 'ignore' || (existing.essais || 0) >= maxAttempts)) { res.ignores++; continue; }
    if (!existing) {
      try {
        await col.insertOne({ _id: id, type: d.type, missionId: d.mission._id, clientId: d.mission.clientId, dueAt: new Date(d.dueAt).toISOString(), statut: 'en_cours', essais: 0, createdAt: at, updatedAt: at, updatedBy: 'rappel' });
      } catch (e) { if (e && e.code === 11000) { res.ignores++; continue; } throw e; }
    } else {
      const claimed = await col.findOneAndUpdate({ _id: id, statut: 'echec' }, { $set: { statut: 'en_cours', updatedAt: at } });
      if (!claimed) { res.ignores++; continue; }
    }
    const client = await db.collection('clients').findOne({ _id: d.mission.clientId, _deleted: { $ne: true } });
    const conv = await convFor(db, d.mission, client);
    const finish = async (set) => {
      await col.updateOne({ _id: id }, { $set: { ...set, updatedAt: nowIso(), updatedBy: 'rappel' }, $inc: { essais: 1 } });
      const r = await col.findOne({ _id: id });
      if (r) emit('rappel', { rappel: toApi(r) });
      res.details.push({ id, ...set });
    };
    if (!conv) { await finish({ statut: 'ignore', erreur: 'Pas de conversation WhatsApp pour ce client.' }); res.ignores++; continue; }
    if (d.type === 'acompte' && await db.collection('relances').findOne({ key: `acompte:${d.mission._id}`, statut: { $in: ['envoye', 'manuel', 'en_cours'] }, at: { $gt: new Date(nowMs - 3 * DAY).toISOString() } })) {
      await finish({ statut: 'ignore', erreur: 'Acompte déjà relancé par l’équipe.' }); res.ignores++; continue;
    }
    const lang = (client && client.langue) || conv.lang || 'FR';
    const L = ['FR', 'EN', 'ES', 'AR', 'RU'].includes(String(lang).toUpperCase()) ? String(lang).toUpperCase() : 'EN';
    const m = d.mission;
    const vehicule = m.vehiculeId ? await db.collection('vehicules').findOne({ _id: m.vehiculeId }, { projection: { nom: 1 } }) : null;
    const service = labelOf(SERVICES, m.service, m.service || '');
    const debutMs = wallToMs(m.debut);
    const vars = {
      prenom: clientFirstName(client, conv),
      service: vehicule ? `${service} — ${vehicule.nom}` : service,
      voiture: vehicule ? vehicule.nom : '',
      date: fmtDate(debutMs, L, { weekday: 'long', day: 'numeric', month: 'long' }, 'Europe/Paris'),
      heure: fmtTime(debutMs, L, 'Europe/Paris'),
      lieu: m.lieu || 'Paris',
      montant: fmtMoney(d.montant ? Math.round(d.montant * 0.3) : +m.acompte || 0, L),
    };
    const text = rappelText({ type: d.type, lang: L, textes: reg.textes, vars });
    const tplLang = L.toLowerCase();
    const fallbackTemplate = d.type === 'veille'
      ? { name: 'amane_rappel', lang: tplLang, params: [vars.prenom || '', vars.service, vars.date, vars.heure, vars.lieu] }
      : { name: 'amane_relance', lang: tplLang, params: [vars.prenom || '', d.type === 'merci' ? service : `${service} — ${vars.date}`] };
    try {
      const r = await sendToConversation(db, { conv, by: 'rappel', text, fallbackTemplate, timeoutMs: 6000, extra: { rappel: d.type, missionId: m._id } });
      await finish({ statut: 'envoye', sentAt: nowIso(), messageId: r.id, lang: L, template: r.type === 'template' });
      await logActivity(db, { user: 'rappel', col: 'missions', docId: m._id, action: 'rappel', resume: `Rappel ${labelOf(RAPPEL_TYPES, d.type)} envoyé (${L})` });
      emit('rappel_envoye', { type: d.type, missionId: m._id, clientId: m.clientId, convId: conv._id, nom: client && client.nom, responsable: m.responsable || 'amel' });
      res.envoyes++;
    } catch (e) {
      await finish({ statut: 'echec', erreur: String(e && e.message || e).slice(0, 200) });
      res.echecs++;
    }
  }
  return res;
}
