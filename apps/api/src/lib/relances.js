// « À relancer » : vue unique calculée (devis sans réponse, acomptes, soldes, factures, confirmations de prestataires,
// habitués, dates importantes) et envoi en un geste par WhatsApp : texte libre dans la fenêtre de 24 h, sinon modèle
// approuvé `amane_relance`. Chaque relance a une clé stable (« proposition:m1 », « prestataire:m1:p2 ») et laisse une
// trace dans la collection `relances` (_id = clé#n). Tant que le délai du type court, la clé est bloquée : jamais deux fois.
import { t, fmtMoney, fmtDate, fmtTime, labelOf, SERVICES, PROG_TYPES, RELANCE_TYPES, paiementStatut, devisTotals, ACTIVE_STATUTS, firstName, windowOpen } from '@amane/shared';
import { now, nowIso } from './clock.js';
import { wallToMs, parisDay } from './paris.js';
import { HttpError } from './http.js';
import { isDuplicate, toApi } from './db.js';
import { normPhone } from './phone.js';
import { logActivity } from './docs.js';
import { emit } from './bus.js';
import { waConfigured, sendToConversation } from './whatsapp.js';
import { CONFIEES, isConfirmed } from './prestataire.js';

const DAY = 86400000;
/** Une relance « en cours » plus vieille que ça est considérée comme interrompue (serveur redémarré pendant l'envoi). */
const STALE_MS = 5 * 60000;
const WA = ['FR', 'EN', 'ES', 'AR', 'RU'];
const docL = (c) => { const l = String((c && c.langue) || '').toUpperCase(); return WA.includes(l) ? l : 'EN'; };
const partL = (p) => { const l = String((p && p.langues) || '').toUpperCase().match(/[A-Z]{2}/); return l && WA.includes(l[0]) ? l[0] : 'FR'; };
export const DELAI = Object.fromEntries(RELANCE_TYPES.map((r) => [r.id, r.delai]));
const COURT = Object.fromEntries(RELANCE_TYPES.map((r) => [r.id, r.court]));
const COMPTE = ['envoye', 'manuel', 'en_cours'];

/** Dernière relance comptée par clé (relances envoyées ou notées, et rappels automatiques d'acompte déjà partis). */
async function lastByKey(db, nowMs) {
  const [rs, rappels] = await Promise.all([
    db.collection('relances').find({ at: { $gt: new Date(nowMs - 400 * DAY).toISOString() } }).toArray(),
    db.collection('rappels').find({ type: 'acompte', statut: 'envoye' }).toArray(),
  ]);
  const out = new Map();
  const keep = (key, r) => { const o = out.get(key); if (!o || String(r.at) > String(o.at)) out.set(key, r); };
  for (const r of rs) {
    if (!COMPTE.includes(r.statut)) continue;
    if (r.statut === 'en_cours' && nowMs - Date.parse(r.at) > STALE_MS) continue;
    keep(r.key, toApi(r));
  }
  for (const r of rappels) keep(`acompte:${r.missionId}`, { id: r._id, key: `acompte:${r.missionId}`, type: 'rappel', cible: 'client', missionId: r.missionId, clientId: r.clientId, statut: 'envoye', canal: 'rappel', by: 'rappel', at: r.sentAt || r.updatedAt });
  return out;
}

/**
 * Relances à faire. opts.base : origine publique (« https://amane.paris ») pour joindre le lien de l'espace prestataire.
 * Chaque élément porte `derniere` (dernière relance) et `bloqueeJusqua` quand le délai n'est pas écoulé.
 */
export async function computeRelances(db, nowMs = now(), { base = '' } = {}) {
  const [clients, missions, partenaires, convs, confs, acces, last] = await Promise.all([
    db.collection('clients').find({ _deleted: { $ne: true } }).toArray(),
    db.collection('missions').find({ _deleted: { $ne: true } }).toArray(),
    db.collection('partenaires').find({ _deleted: { $ne: true } }).toArray(),
    db.collection('conversations').find({}, { projection: { windowUntil: 1, lastInAt: 1 } }).toArray(),
    db.collection('confirmations').find({}).toArray(),
    db.collection('acces_prestataires').find({}).toArray(),
    lastByKey(db, nowMs),
  ]);
  const byClient = new Map(clients.map((c) => [c._id, c]));
  const byPart = new Map(partenaires.map((p) => [p._id, p]));
  const byConv = new Map(convs.map((c) => [c._id, c]));
  const confOf = new Map(confs.map((c) => [`${c.missionId}:${c.partenaireId}`, c]));
  const accesOf = new Map(acces.map((a) => [a._id, a]));
  const vehicules = new Map((await db.collection('vehicules').find({}, { projection: { nom: 1 } }).toArray()).map((v) => [v._id, v]));
  const out = [];
  const add = (type, key, { c, m, p, raison, msg, objet, depuis }) => {
    const target = p || c;
    if (!target) return;
    const tel = target.tel || '';
    const convId = normPhone(tel) || undefined;
    const conv = convId ? byConv.get(convId) : null;
    const derniere = last.get(key) || null;
    let bloqueeJusqua;
    if (derniere) {
      const until = derniere.statut === 'en_cours' ? Date.parse(derniere.at) + STALE_MS : Date.parse(derniere.at) + DELAI[type] * DAY;
      if (until > nowMs) bloqueeJusqua = new Date(until).toISOString();
    }
    out.push({
      key, type, cible: p ? 'prestataire' : 'client', clientId: c ? c._id : m ? m.clientId : undefined, missionId: m ? m._id : undefined, partenaireId: p ? p._id : undefined,
      nom: target.nom || '', tel, convId, lang: msg.lang, raison, messageSuggere: msg.text, objet, prenom: msg.prenom, depuis,
      fenetre: windowOpen(conv, nowMs), derniere, ...(bloqueeJusqua ? { bloqueeJusqua } : {}),
    });
  };
  const forClient = (c, key, vars) => { const L = docL(c); const prenom = firstName(c && c.nom); return { lang: L, prenom, text: t(L, key, { prenom, ...vars }) }; };
  const today = parisDay(nowMs);
  const facturees = new Set();

  // 1. Devis sans réponse > 48 h (proposition, ou devis envoyé par lien) — sauf si le client a écrit depuis.
  for (const m of missions) {
    const dv = m.devis || {};
    const envoye = dv.statut === 'envoye' && Array.isArray(dv.lignes) && dv.lignes.length;
    if (!(m.statut === 'proposition' || (m.statut === 'nouvelle' && envoye)) || ['accepte', 'refuse'].includes(dv.statut)) continue;
    const ref = (envoye && Date.parse(dv.sentAt || '')) || Date.parse(m.updatedAt || m.createdAt || '') || 0;
    if (!ref || nowMs - ref < 48 * 3600000) continue;
    const c = byClient.get(m.clientId);
    if (!c) continue;
    const conv = byConv.get(normPhone(c.tel));
    if (conv && conv.lastInAt && Date.parse(conv.lastInAt) > ref) continue;
    const jours = Math.floor((nowMs - ref) / DAY);
    const objet = m.titre || labelOf(SERVICES, m.service, '');
    add('proposition', `proposition:${m._id}`, { c, m, objet, raison: `${envoye && dv.numero ? `Devis ${dv.numero}` : 'Proposition'} « ${m.titre || ''} » sans réponse depuis ${jours} j`, msg: forClient(c, 'relance.proposition', { objet }), depuis: new Date(ref).toISOString() });
  }
  // 2. Factures en retard (> 30 j, solde > 0).
  for (const m of missions) {
    const dv = m.devis;
    if (!dv || !dv.factureNumero) continue;
    const tot = devisTotals(dv);
    if (tot.solde <= 0.005) continue;
    const fd = wallToMs(dv.factureDate) || Date.parse(m.updatedAt || '') || 0;
    if (!fd || nowMs - fd < 30 * DAY) continue;
    const c = byClient.get(m.clientId);
    if (!c) continue;
    facturees.add(m._id);
    add('facture', `facture:${m._id}`, { c, m, objet: `facture ${dv.factureNumero}`, raison: `Facture ${dv.factureNumero} en retard de ${Math.floor((nowMs - fd) / DAY) - 30} j (${fmtMoney(tot.solde, 'FR')} restants)`, msg: forClient(c, 'relance.facture', { numero: dv.factureNumero, montant: fmtMoney(tot.solde, docL(c)) }), depuis: new Date(fd).toISOString() });
  }
  // 3. Acomptes non reçus à J-3.
  for (const m of missions) {
    if (!['proposition', 'confirmee'].includes(m.statut) || paiementStatut(m) !== 'non') continue;
    const d = wallToMs(m.debut);
    if (!d || d < nowMs || d - nowMs > 3 * DAY) continue;
    const c = byClient.get(m.clientId);
    const total = m.devis && m.devis.lignes && m.devis.lignes.length ? devisTotals(m.devis).ttc : +m.montant || 0;
    if (!c || !total) continue;
    const L = docL(c);
    add('acompte', `acompte:${m._id}`, { c, m, objet: m.titre || labelOf(SERVICES, m.service, ''), raison: `Acompte non reçu, mission dans ${Math.ceil((d - nowMs) / DAY)} j`, msg: forClient(c, 'relance.acompte', { date: fmtDate(d, L, { day: 'numeric', month: 'long' }, 'Europe/Paris'), montant: fmtMoney(Math.round(total * 0.3), L) }), depuis: new Date(d).toISOString() });
  }
  // 4. Soldes : mission terminée depuis plus d'un jour (et moins de 90), reste à payer, pas déjà en « facture en retard ».
  for (const m of missions) {
    if (!ACTIVE_STATUTS.includes(m.statut) || facturees.has(m._id) || m.paiement === 'solde') continue;
    const fin = wallToMs(m.fin) || wallToMs(m.debut);
    if (!fin || nowMs - fin < DAY || nowMs - fin > 90 * DAY) continue;
    const hasDevis = m.devis && Array.isArray(m.devis.lignes) && m.devis.lignes.length;
    const reste = hasDevis ? devisTotals(m.devis).solde : paiementStatut(m) === 'solde' ? 0 : Math.round(((+m.montant || 0) - (+m.acompte || 0)) * 100) / 100;
    if (reste <= 0.005) continue;
    const c = byClient.get(m.clientId);
    if (!c) continue;
    const objet = m.titre || labelOf(SERVICES, m.service, '');
    add('solde', `solde:${m._id}`, { c, m, objet, raison: `Solde de ${fmtMoney(reste, 'FR')} à régler, mission terminée depuis ${Math.floor((nowMs - fin) / DAY)} j`, msg: forClient(c, 'relance.solde', { objet, montant: fmtMoney(reste, docL(c)) }), depuis: new Date(fin).toISOString() });
  }
  // 5. Prestataires : mission ferme confiée (chauffeur, ou étape du programme), pas encore confirmée, dont le créneau
  //    du prestataire (début de mission, ou sa première étape à venir) tombe dans les 7 jours.
  for (const m of missions) {
    if (!CONFIEES.includes(m.statut)) continue;
    const pids = [m.chauffeurId, ...(Array.isArray(m.programme) ? m.programme.map((x) => x && x.partenaireId) : [])].filter((x, i, a) => x && a.indexOf(x) === i);
    for (const pid of pids) {
      const step = m.chauffeurId === pid ? null : (m.programme || []).filter((x) => x && x.partenaireId === pid && (wallToMs(x.dt) || 0) >= nowMs).sort((a, b) => String(a.dt).localeCompare(String(b.dt)))[0];
      const d = wallToMs(step ? step.dt : m.debut);
      if (!d || d < nowMs || d - nowMs > 7 * DAY) continue;
      const p = byPart.get(pid);
      if (!p || p.actif === false || isConfirmed(confOf.get(`${m._id}:${pid}`), m)) continue;
      const L = partL(p);
      const v = m.vehiculeId ? vehicules.get(m.vehiculeId) : null;
      const service = step ? labelOf(PROG_TYPES, step.type, 'Prestation') + (step.lieu ? ` — ${step.lieu}` : '') : labelOf(SERVICES, m.service, m.service || 'Mission');
      const objet = !step && v ? `${service} — ${v.nom}` : service;
      const date = `${fmtDate(d, L, { weekday: 'long', day: 'numeric', month: 'long' }, 'Europe/Paris')}, ${fmtTime(d, L, 'Europe/Paris')}`;
      const prenom = firstName(p.contact || p.nom);
      const a = accesOf.get(pid);
      const text = t(L, 'relance.prestataire', { prenom, date, objet }) + (a && base ? '\n' + t(L, 'relance.prestataire_espace', { lien: `${base}/api/prestataire/${a.token}` }) : '');
      const jours = Math.ceil((d - nowMs) / DAY);
      add('prestataire', `prestataire:${m._id}:${pid}`, { c: byClient.get(m.clientId), m, p, objet: `${objet}, ${date}`, raison: `${m.chauffeurId === pid ? 'Chauffeur non confirmé' : 'Prestation non confirmée'} — ${m.titre || service}, dans ${jours} j`, msg: { lang: L, prenom, text }, depuis: new Date(d).toISOString() });
    }
  }
  // 6. Habitués / VIP sans mission depuis 90 j.
  for (const c of clients) {
    if (!['habitue', 'vip'].includes(c.statut)) continue;
    const lastMs = missions.filter((m) => m.clientId === c._id && ACTIVE_STATUTS.includes(m.statut) && m.debut).map((m) => wallToMs(m.debut) || 0).sort((a, b) => b - a)[0] || 0;
    if (lastMs && nowMs - lastMs < 90 * DAY) continue;
    if (missions.some((m) => m.clientId === c._id && ['nouvelle', 'proposition', 'confirmee', 'encours'].includes(m.statut) && (wallToMs(m.debut) || 0) > nowMs)) continue;
    const jours = lastMs ? Math.floor((nowMs - lastMs) / DAY) : null;
    add('habitue', `habitue:${c._id}`, { c, objet: 'vos prochaines dates à Paris', raison: jours ? `Habitué sans mission depuis ${jours} j` : 'Habitué sans mission enregistrée', msg: forClient(c, 'relance.habitue', {}), depuis: lastMs ? new Date(lastMs).toISOString() : c.createdAt || '' });
  }
  // 7. Dates importantes sous 21 j.
  for (const c of clients) {
    for (const d of Array.isArray(c.datesImportantes) ? c.datesImportantes : []) {
      const md = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(String(d && d.date || ''));
      if (!md) continue;
      const y = +today.slice(0, 4);
      let next = Date.UTC(y, +md[1] - 1, +md[2]);
      const todayMs = Date.UTC(y, +today.slice(5, 7) - 1, +today.slice(8, 10));
      if (next < todayMs) next = Date.UTC(y + 1, +md[1] - 1, +md[2]);
      const dans = Math.round((next - todayMs) / DAY);
      if (dans > 21) continue;
      const nextDay = new Date(next).toISOString().slice(0, 10);
      add('anniversaire', `anniversaire:${c._id}:${nextDay}`, { c, objet: d.label || 'une date importante', raison: `${d.label || 'Date importante'} dans ${dans} j (${md[2]}/${md[1]})`, msg: forClient(c, 'relance.anniversaire', { objet: d.label || '' }), depuis: new Date(next).toISOString() });
    }
  }
  return out.sort((a, b) => (a.bloqueeJusqua ? 1 : 0) - (b.bloqueeJusqua ? 1 : 0) || String(a.depuis).localeCompare(String(b.depuis)));
}

const QUI = { amel: 'Amel', youssouf: 'Youssouf', aziz: 'Aziz', rappel: 'le rappel automatique' };
function dejaRelance(d) {
  const quand = fmtDate(new Date(d.at), 'FR', { weekday: 'long', day: 'numeric', month: 'long' }, 'Europe/Paris');
  if (d.statut === 'en_cours') return new HttpError(409, 'relance_en_cours', 'Cette relance est en cours d’envoi.');
  return new HttpError(409, 'deja_relance', `Déjà relancé ${quand} par ${QUI[d.by] || d.by}. Attendez la réponse avant de relancer.`);
}

/** Relance encore due et libre (sinon 404 ou 409). */
async function relanceDue(db, key, nowMs, base) {
  if (typeof key !== 'string' || !/^[a-z]+:[A-Za-z0-9_:.-]{1,200}$/.test(key)) throw new HttpError(400, 'cle_invalide', 'Relance invalide.');
  const it = (await computeRelances(db, nowMs, { base })).find((x) => x.key === key);
  if (!it) throw new HttpError(404, 'introuvable', 'Plus rien à relancer ici : la situation a changé entre-temps.');
  if (it.bloqueeJusqua) throw dejaRelance(it.derniere);
  return it;
}

/** Réserve la relance (clé#n) : un seul envoi possible, même si deux personnes appuient en même temps. */
async function claim(db, it, by, nowMs) {
  const col = db.collection('relances');
  const [prev] = await col.find({ key: it.key }, { sort: { n: -1 }, limit: 1 }).toArray();
  const at = new Date(nowMs).toISOString();
  const base = { key: it.key, type: it.type, cible: it.cible, statut: 'en_cours', by, at, updatedAt: at };
  for (const k of ['clientId', 'missionId', 'partenaireId']) if (it[k]) base[k] = it[k];
  if (prev && (prev.statut === 'echec' || (prev.statut === 'en_cours' && nowMs - Date.parse(prev.at) > STALE_MS))) {
    const got = await col.findOneAndUpdate({ _id: prev._id, statut: prev.statut, at: prev.at }, { $set: base, $unset: { erreur: '' } });
    if (!got) throw new HttpError(409, 'relance_en_cours', 'Cette relance est en cours d’envoi.');
    return prev._id;
  }
  const n = (prev ? prev.n || 0 : 0) + 1;
  const id = `${it.key}#${n}`;
  try {
    await col.insertOne({ _id: id, n, ...base, createdAt: at });
  } catch (e) {
    if (isDuplicate(e)) throw new HttpError(409, 'relance_en_cours', 'Cette relance vient d’être envoyée par quelqu’un d’autre.');
    throw e;
  }
  return id;
}

async function finish(db, id, set) {
  await db.collection('relances').updateOne({ _id: id }, { $set: { ...set, updatedAt: nowIso() } });
  const doc = toApi(await db.collection('relances').findOne({ _id: id }));
  emit('relance', { relance: doc });
  return doc;
}

async function journal(db, it, by, resume) {
  const entries = [];
  if (it.missionId) entries.push(['missions', it.missionId]);
  else if (it.clientId) entries.push(['clients', it.clientId]);
  if (it.partenaireId) entries.push(['partenaires', it.partenaireId]);
  for (const [col, docId] of entries) await logActivity(db, { user: by, col, docId, action: 'relance', resume });
}

/** Conversation WhatsApp du destinataire ; créée (vide) s'il n'a jamais écrit, pour garder le fil de la relance. */
async function convFor(db, it) {
  const phone = normPhone(it.tel);
  if (!phone) throw new HttpError(409, 'sans_telephone', `Aucun numéro de téléphone sur la fiche de ${it.nom || 'ce contact'}.`);
  const col = db.collection('conversations');
  const conv = await col.findOne({ _id: phone });
  if (conv) return conv;
  const at = nowIso();
  const set = { phone, nom: it.nom || '+' + phone, lang: it.lang, updatedAt: at, updatedBy: 'relance' };
  if (it.cible === 'client' && it.clientId) set.clientId = it.clientId;
  if (it.partenaireId) set.partenaireId = it.partenaireId;
  await col.updateOne({ _id: phone }, { $set: set, $setOnInsert: { createdAt: at, lastOutAt: '', unread: 0 } }, { upsert: true });
  return col.findOne({ _id: phone });
}

/**
 * Envoie la relance `key` par WhatsApp : `texte` (ou le message suggéré) dans la fenêtre de 24 h,
 * sinon le modèle approuvé `amane_relance` [prénom, objet]. Renvoie la trace enregistrée.
 */
export async function sendRelance(db, { key, by, texte, base = '', nowMs = now() }) {
  if (!waConfigured()) throw new HttpError(503, 'whatsapp_off', 'WhatsApp n’est pas configuré sur ce serveur.');
  const it = await relanceDue(db, key, nowMs, base);
  const conv = await convFor(db, it);
  const text = typeof texte === 'string' && texte.trim() ? texte.trim().slice(0, 4096) : it.messageSuggere;
  const id = await claim(db, it, by, nowMs);
  try {
    const r = await sendToConversation(db, {
      conv, by, text, timeoutMs: 8000,
      fallbackTemplate: { name: 'amane_relance', lang: String(it.lang || 'FR').toLowerCase(), params: [it.prenom || '', String(it.objet || COURT[it.type] || '').slice(0, 200)] },
      extra: { relance: it.type, relanceKey: it.key, ...(it.missionId ? { missionId: it.missionId } : {}) },
    });
    const canal = r.type === 'template' ? 'modele' : 'texte';
    const doc = await finish(db, id, { statut: 'envoye', canal, texte: r.text, messageId: r.id, convId: conv._id, lang: it.lang });
    await journal(db, it, by, `Relance envoyée par WhatsApp — ${COURT[it.type]}${it.cible === 'prestataire' ? ` (${it.nom})` : ''}${canal === 'modele' ? ' : modèle approuvé, hors fenêtre de 24 h' : ''}`);
    return { relance: doc, canal };
  } catch (e) {
    await finish(db, id, { statut: 'echec', erreur: String((e && e.message) || e).slice(0, 200) });
    throw e;
  }
}

/** Relance faite hors CRM (appel, WhatsApp personnel) : notée pour l'historique et pour ne pas relancer deux fois. */
export async function markRelance(db, { key, by, note = '', nowMs = now() }) {
  const it = await relanceDue(db, key, nowMs, '');
  const id = await claim(db, it, by, nowMs);
  const doc = await finish(db, id, { statut: 'manuel', canal: 'manuel', ...(note ? { texte: String(note).slice(0, 500) } : {}) });
  await journal(db, it, by, `Relance notée (faite hors CRM) — ${COURT[it.type]}${note ? ` : ${String(note).slice(0, 120)}` : ''}`);
  return { relance: doc };
}

/** Historique d'une fiche : relances (envoyées, notées, échecs) et rappels automatiques de ses missions. */
export async function historique(db, { clientId, missionId, partenaireId }) {
  const filter = clientId ? { clientId } : missionId ? { missionId } : { partenaireId };
  const rs = (await db.collection('relances').find(filter, { sort: { at: -1 }, limit: 100 }).toArray()).filter((r) => r.statut !== 'en_cours').map(toApi);
  if (partenaireId) return rs;
  const rp = (await db.collection('rappels').find(filter, { sort: { updatedAt: -1 }, limit: 100 }).toArray()).filter((r) => r.statut === 'envoye')
    .map((r) => ({ id: r._id, key: `rappel:${r._id}`, type: 'rappel', rappel: r.type, cible: 'client', clientId: r.clientId, missionId: r.missionId, statut: 'envoye', canal: 'rappel', by: 'rappel', at: r.sentAt || r.updatedAt }));
  return [...rs, ...rp].sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
