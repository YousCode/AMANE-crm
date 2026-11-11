// Prestataires (loueurs) : jeton du portail, données montrées au prestataire, jours déclarés, véhicules proposés,
// demandes de disponibilité et réponses (portail ou WhatsApp), inscription publique. Contrat : docs/prestataires.md.
// Le prestataire ne voit jamais un prix de vente, un montant, un téléphone, un e-mail ni un nom complet de client.
import { OPEN_STATUTS, BOOK_STATUTS, SERVICES, labelOf, firstName, normDispos, addDispo, dispoDemandeOf, parseDate, fmtDate, fillVars } from '@amane/shared';
import { HttpError } from './http.js';
import { now, nowIso } from './clock.js';
import { newId, withLock } from './db.js';
import { saveDoc, logActivity } from './docs.js';
import { emit } from './bus.js';
import { newToken, TOKEN_RE } from './share.js';
import { parisDay } from './paris.js';

export const MAX_PERIODES = 60;
export const MAX_VEHICULES = 20;
export const MAX_DEMANDES = 20;
const ALIVE = { $ne: true };

/** Texte libre venant d'un formulaire public : sans caractères de contrôle, rogné, borné. */
export const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '');
/** Même chose sur une seule ligne (espaces et retours réunis). */
export const line = (v, max) => str(v, max).replace(/\s+/g, ' ');

// ---------- textes ----------

const JM = { day: 'numeric', month: 'long' };
const JMA = { ...JM, year: 'numeric' };

/** « du 20 novembre au 22 novembre 2026 », « le 20 novembre 2026 », ou « dates à préciser ». */
export function periodeTexte(m) {
  const a = parseDate(m && m.debut);
  if (!a) return 'dates à préciser';
  const b = parseDate(m.fin) || a;
  if (a.toDateString() === b.toDateString() || b < a) return `le ${fmtDate(a, 'FR', JMA)}`;
  return `du ${fmtDate(a, 'FR', a.getFullYear() === b.getFullYear() ? JM : JMA)} au ${fmtDate(b, 'FR', JMA)}`;
}

/** Prénom du contact du prestataire (repli : rien, le message reste correct). */
export const prenomContact = (p) => firstName((p && (p.contact || p.nom)) || '');

/** Prénom du client montré au prestataire : jamais un e-mail, un numéro ni un nom complet. */
export function prenomClient(nom) {
  const first = String(nom || '').trim().split(/\s+/)[0] || '';
  return /[@\d]/.test(first) ? '' : firstName(first);
}

export const messagePortail = (p, url) => fillVars('Bonjour {prenom}, voici votre espace prestataire Amane : vous y déclarez vos jours disponibles et répondez à nos demandes. {lien}', { prenom: prenomContact(p), lien: url });
export const messageDispo = (p, v, m, url) => fillVars('Bonjour {prenom}, Amane a une demande pour votre {vehicule}, {periode}. Est-il disponible ? Répondez OUI ou NON, ou ouvrez votre espace : {lien}', { prenom: prenomContact(p), vehicule: line(v.nom, 80), periode: periodeTexte(m), lien: url });
/** Paramètres du modèle `amane_dispo` : prénom du contact, véhicule, « du … au … », lien du portail (jamais vides). */
export const paramsDispo = (p, v, m, url) => [prenomContact(p) || line(p.nom, 60) || 'partenaire', line(v.nom, 80) || 'véhicule', periodeTexte(m), url];
export const messageAccuse = (v, m, reponse) => `Merci, c’est noté : ${line(v.nom, 80)} ${reponse === 'oui' ? 'disponible' : 'pas disponible'} ${periodeTexte(m)}.`;

// ---------- jeton ----------

export const estPrestataire = (p) => Boolean(p && !p._deleted && p.type === 'loueur' && !p.aValider);

/** Partenaire non supprimé, ou 404. */
export async function partenaireOr404(db, id) {
  const p = await db.collection('partenaires').findOne({ _id: id, _deleted: ALIVE });
  if (!p) throw new HttpError(404, 'introuvable', 'Partenaire introuvable.');
  return p;
}

/** Crée (ou renvoie, ou régénère si `reset`) le jeton du portail d'un prestataire validé. */
export async function ensurePortail(db, id, by, { reset = false } = {}) {
  return withLock(db, 'portail:' + id, async () => {
    const p = await partenaireOr404(db, id);
    if (p.type !== 'loueur') throw new HttpError(409, 'pas_loueur', 'Le portail est réservé aux loueurs (prestataires de véhicules).');
    if (p.aValider) throw new HttpError(409, 'a_valider', 'Validez d’abord cette inscription : le portail est créé à la validation.');
    if (!reset && typeof p.portailToken === 'string' && TOKEN_RE.test(p.portailToken)) return { token: p.portailToken, created: false, partenaire: p };
    const token = newToken();
    const portailAt = nowIso();
    await saveDoc(db, 'partenaires', id, { portailToken: token, portailAt }, by, { action: 'portail', resume: `Lien du portail prestataire ${p.portailToken ? 'régénéré' : 'créé'} : ${line(p.nom, 80)}` });
    return { token, created: true, partenaire: { ...p, portailToken: token, portailAt } };
  });
}

/** Valide une inscription (retire `aValider`) ; sans effet si elle l'est déjà. */
export async function validerPartenaire(db, id, by) {
  const p = await partenaireOr404(db, id);
  if (p.type !== 'loueur') throw new HttpError(409, 'pas_loueur', 'Seul un loueur (prestataire de véhicules) se valide ainsi.');
  if (!p.aValider) return p;
  await saveDoc(db, 'partenaires', id, {}, by, { unset: ['aValider'], action: 'portail', resume: `Prestataire validé : ${line(p.nom, 80)}` });
  return { ...p, aValider: undefined };
}

/** Prestataire validé porteur de ce jeton, ou null (jeton mal formé, inconnu, révoqué, partenaire à valider ou supprimé). */
export async function partenaireByToken(db, token) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  const p = await db.collection('partenaires').findOne({ portailToken: token, _deleted: ALIVE });
  return estPrestataire(p) && p.portailToken === token ? p : null;
}

// ---------- ce que voit le prestataire ----------

const debutFin = (m) => ({ du: String(m.debut || ''), au: String(m.fin || m.debut || '') });

/** Données du portail (GET /api/portail/:token). */
export async function portailData(db, p) {
  const today = parisDay(now());
  const vehicules = await db.collection('vehicules').find({ partenaireId: p._id, _deleted: ALIVE }, { sort: { ordre: 1, nom: 1 } }).toArray();
  const byId = new Map(vehicules.map((v) => [v._id, v]));
  const missions = vehicules.length ? await db.collection('missions').find({ _deleted: ALIVE, statut: { $in: [...OPEN_STATUTS] } }).toArray() : [];
  const resa = missions.filter((m) => BOOK_STATUTS.includes(m.statut) && byId.has(m.vehiculeId) && m.debut && String(m.fin || m.debut).slice(0, 10) >= today);
  const dem = [];
  for (const m of missions) {
    for (const d of Array.isArray(m.dispoDemandes) ? m.dispoDemandes : []) {
      if (d && d.partenaireId === p._id && byId.has(d.vehiculeId) && ['envoyee', 'oui', 'non'].includes(d.statut)) dem.push({ m, d });
    }
  }
  const clientIds = [...new Set([...resa, ...dem.map((x) => x.m)].map((m) => m.clientId).filter((x) => typeof x === 'string' && x))];
  const clients = clientIds.length ? await db.collection('clients').find({ _id: { $in: clientIds } }, { projection: { nom: 1 } }).toArray() : [];
  const prenom = (m) => prenomClient((clients.find((c) => c._id === m.clientId) || {}).nom);
  const lieu = (m) => line(m.lieu, 300);
  return {
    partenaire: { nom: String(p.nom || '') },
    vehicules: vehicules.map((v) => ({
      id: v._id, nom: String(v.nom || ''), categorie: String(v.categorie || ''), plaque: String(v.plaque || ''), aValider: Boolean(v.aValider), dispos: normDispos(v.dispos),
      // `titre` : le service, jamais le titre libre de la mission (il porte souvent le nom complet ou le numéro du client).
      reservations: resa.filter((m) => m.vehiculeId === v._id).sort((a, b) => String(a.debut).localeCompare(String(b.debut)))
        .map((m) => ({ ...debutFin(m), lieu: lieu(m), prenom: prenom(m), titre: labelOf(SERVICES, m.service, '') })),
    })),
    demandes: dem.sort((a, b) => (a.d.statut === 'envoyee' ? 0 : 1) - (b.d.statut === 'envoyee' ? 0 : 1) || String(a.m.debut || '').localeCompare(String(b.m.debut || '')))
      .map(({ m, d }) => ({ missionId: m._id, vehiculeId: d.vehiculeId, vehicule: String(byId.get(d.vehiculeId).nom || ''), ...debutFin(m), lieu: lieu(m), prenom: prenom(m), statut: d.statut })),
  };
}

/** Véhicule du prestataire, ou 404 (même réponse pour un véhicule inconnu et pour celui d'un autre). */
async function vehiculeDe(db, p, id) {
  const v = typeof id === 'string' ? await db.collection('vehicules').findOne({ _id: id, partenaireId: p._id, _deleted: ALIVE }) : null;
  if (!v) throw new HttpError(404, 'introuvable', 'Véhicule introuvable.');
  return v;
}

// ---------- ce qu'écrit le prestataire ----------

function jourValide(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d));
  return y >= 2000 && x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
}

/** Remplace les jours déclarés d'un véhicule du prestataire. */
export async function declarerDispos(db, p, vehiculeId, list) {
  if (!Array.isArray(list)) throw new HttpError(400, 'dispos_invalides', 'Liste de périodes attendue.');
  if (list.length > MAX_PERIODES) throw new HttpError(400, 'trop_de_periodes', `${MAX_PERIODES} périodes au plus par véhicule.`);
  const today = parisDay(now());
  const max = `${Number(today.slice(0, 4)) + 2}${today.slice(4)}`;
  const clean = [];
  for (const x of list) {
    if (!x || typeof x !== 'object' || !jourValide(x.du) || !jourValide(x.au)) throw new HttpError(400, 'periode_invalide', 'Période invalide : deux dates sont attendues (du, au).');
    if (x.du > max || x.au > max) throw new HttpError(400, 'date_trop_lointaine', 'Pas de date à plus de deux ans.');
    clean.push({ du: x.du, au: x.au });
  }
  const v = await vehiculeDe(db, p, vehiculeId);
  const dispos = normDispos(clean);
  await saveDoc(db, 'vehicules', v._id, { dispos }, 'prestataire', { action: 'portail', resume: `Jours disponibles déclarés par ${line(p.nom, 80)} : ${line(v.nom, 80)} (${dispos.length} période${dispos.length > 1 ? 's' : ''})` });
  return dispos;
}

/** Proposition d'un véhicule par le prestataire : toujours `aValider`, rattaché à lui. */
export async function proposerVehicule(db, p, body) {
  const nom = line(body.nom, 80);
  if (!nom) throw new HttpError(400, 'nom_requis', 'Indiquez le modèle du véhicule.');
  const fields = { nom, categorie: line(body.categorie, 60), plaque: line(body.plaque, 20).toUpperCase(), partenaireId: p._id, aValider: true, statut: 'disponible', ordre: 99, dispos: [] };
  const brut = typeof body.prixJour === 'string' ? body.prixJour.trim().replace(',', '.') : body.prixJour;
  if (brut !== undefined && brut !== null && brut !== '') {
    const n = typeof brut === 'number' || (typeof brut === 'string' && /^\d{1,7}(\.\d{1,2})?$/.test(brut)) ? Number(brut) : NaN;
    if (!Number.isFinite(n) || n < 0 || n > 100000) throw new HttpError(400, 'prix_invalide', 'Prix par jour invalide.');
    fields.prixAchatJour = Math.round(n * 100) / 100;
  }
  const notes = str(body.notes, 1000);
  if (notes) fields.notes = notes;
  return withLock(db, 'vehp:' + p._id, async () => {
    const n = await db.collection('vehicules').countDocuments({ partenaireId: p._id, _deleted: ALIVE });
    if (n >= MAX_VEHICULES) throw new HttpError(409, 'trop_de_vehicules', `Vous avez déjà ${MAX_VEHICULES} véhicules : écrivez-nous pour en ajouter.`);
    const id = newId('v');
    await saveDoc(db, 'vehicules', id, fields, 'prestataire', { action: 'portail', resume: `Véhicule proposé par ${line(p.nom, 80)} : ${nom} (à valider)` });
    emit('vehicule_propose', { vehiculeId: id, nom, partenaireId: p._id, partenaire: line(p.nom, 80) });
    return { id, nom, categorie: fields.categorie, plaque: fields.plaque, aValider: true, dispos: [], reservations: [] };
  });
}

// ---------- demandes de disponibilité ----------

/** Vérifie qu'on peut interroger le prestataire du véhicule pour cette mission. */
export async function contexteDemande(db, missionId, vehiculeId) {
  const mission = await db.collection('missions').findOne({ _id: missionId, _deleted: ALIVE });
  if (!mission) throw new HttpError(404, 'introuvable', 'Demande introuvable.');
  const vehicule = await db.collection('vehicules').findOne({ _id: vehiculeId, _deleted: ALIVE });
  if (!vehicule) throw new HttpError(404, 'introuvable', 'Véhicule introuvable.');
  const partenaire = vehicule.partenaireId ? await db.collection('partenaires').findOne({ _id: vehicule.partenaireId, _deleted: ALIVE }) : null;
  if (!estPrestataire(partenaire)) throw new HttpError(409, 'pas_prestataire', 'Ce véhicule n’appartient pas à un prestataire validé.');
  if (!OPEN_STATUTS.includes(mission.statut)) throw new HttpError(409, 'mission_fermee', 'Cette demande est close : rouvrez-la avant d’interroger le prestataire.');
  return { mission, vehicule, partenaire };
}

/** Pose (ou remet à `envoyee`) l'entrée de `dispoDemandes` du véhicule : une entrée par véhicule. */
export async function poserDemande(db, { missionId, vehicule, partenaire, canal, by }) {
  return withLock(db, 'dispo:' + missionId, async () => {
    const m = await db.collection('missions').findOne({ _id: missionId, _deleted: ALIVE });
    if (!m) throw new HttpError(404, 'introuvable', 'Demande introuvable.');
    const entry = { vehiculeId: vehicule._id, partenaireId: partenaire._id, statut: 'envoyee', envoyeAt: nowIso(), canal, par: by };
    const autres = (Array.isArray(m.dispoDemandes) ? m.dispoDemandes : []).filter((d) => d && d.vehiculeId !== vehicule._id).slice(-(MAX_DEMANDES - 1));
    await saveDoc(db, 'missions', m._id, { dispoDemandes: [...autres, entry] }, by, { action: 'dispo', resume: `Disponibilité demandée à ${line(partenaire.nom, 80)} : ${line(vehicule.nom, 80)} ${periodeTexte(m)}` });
    return entry;
  });
}

/** Demande `envoyee` la plus récente de ce prestataire, sur une mission ouverte et un véhicule toujours à lui. */
export async function demandeEnAttente(db, p) {
  const missions = await db.collection('missions').find({ _deleted: ALIVE, statut: { $in: [...OPEN_STATUTS] }, dispoDemandes: { $exists: true } }).toArray();
  let best = null;
  for (const m of missions) {
    for (const d of Array.isArray(m.dispoDemandes) ? m.dispoDemandes : []) {
      if (d && d.partenaireId === p._id && d.statut === 'envoyee' && (!best || String(d.envoyeAt || '') > String(best.demande.envoyeAt || ''))) best = { mission: m, demande: d };
    }
  }
  if (!best) return null;
  const v = await db.collection('vehicules').findOne({ _id: best.demande.vehiculeId, partenaireId: p._id, _deleted: ALIVE }, { projection: { _id: 1 } });
  return v ? best : null;
}

/**
 * Réponse du prestataire à UNE demande qui le concerne (portail ou WhatsApp). Idempotent : la même réponse deux fois
 * ne change rien ; une réponse déjà donnée ne se retourne pas ici (l'équipe redemande la dispo).
 */
export async function repondreDemande(db, { partenaire: p, missionId, vehiculeId, reponse, canal }) {
  if (reponse !== 'oui' && reponse !== 'non') throw new HttpError(400, 'reponse_invalide', 'Réponse attendue : oui ou non.');
  return withLock(db, 'dispo:' + missionId, async () => {
    const m = await db.collection('missions').findOne({ _id: missionId, _deleted: ALIVE });
    const d = m && OPEN_STATUTS.includes(m.statut) ? dispoDemandeOf(m, vehiculeId) : null;
    const v = d && d.partenaireId === p._id ? await db.collection('vehicules').findOne({ _id: vehiculeId, partenaireId: p._id, _deleted: ALIVE }) : null;
    if (!v) throw new HttpError(404, 'introuvable', 'Demande introuvable.');
    if (d.statut === reponse) return { ok: true, statut: reponse, deja: true, mission: m, vehicule: v };
    if (d.statut !== 'envoyee') throw new HttpError(409, 'deja_repondu', 'Vous avez déjà répondu à cette demande. Pour changer votre réponse, écrivez-nous.');
    const dispoDemandes = m.dispoDemandes.map((x) => (x === d ? { ...x, statut: reponse, reponduAt: nowIso(), canal } : x));
    const libelle = reponse === 'oui' ? 'disponible' : 'pas disponible';
    await saveDoc(db, 'missions', m._id, { dispoDemandes }, 'prestataire', { action: 'dispo', resume: `${line(p.nom, 80)} : ${line(v.nom, 80)} ${libelle} ${periodeTexte(m)} (réponse ${canal === 'whatsapp' ? 'par WhatsApp' : 'sur le portail'})` });
    if (reponse === 'oui') {
      const dispos = addDispo(v.dispos, m.debut, m.fin);
      if (JSON.stringify(dispos) !== JSON.stringify(v.dispos || [])) await saveDoc(db, 'vehicules', v._id, { dispos }, 'prestataire', { activity: false });
    }
    emit('dispo_reponse', { missionId: m._id, vehiculeId: v._id, partenaireId: p._id, partenaire: line(p.nom, 80), vehicule: line(v.nom, 80), reponse, periode: periodeTexte(m), titre: line(m.titre, 80), responsable: m.responsable || 'amel', canal });
    return { ok: true, statut: reponse, deja: false, mission: m, vehicule: v };
  });
}

// ---------- WhatsApp entrant ----------

const OUI = new Set(['oui', 'ok', 'dispo', 'disponible', 'oui disponible', 'oui dispo', 'oui ok', 'ok dispo', 'ok disponible', 'yes']);
const NON = new Set(['non', 'pas dispo', 'pas disponible', 'indisponible', 'indispo', 'non pas dispo', 'non pas disponible', 'non indisponible', 'no']);

/** Texte seul « oui » / « non » (ou bouton du modèle) → 'oui' | 'non' ; tout autre texte → null. */
export function lireReponse(text) {
  const s = String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!s || s.length > 30) return null;
  return OUI.has(s) ? 'oui' : NON.has(s) ? 'non' : null;
}

/**
 * Partenaire (non supprimé) qui écrit depuis ce numéro, ou null.
 * Une inscription pas encore validée ne détourne pas le numéro d'un client déjà connu : lui reste un client.
 */
export async function partenaireParTel(db, phone) {
  if (!phone) return null;
  const list = await db.collection('partenaires').find({ telNorm: phone, _deleted: ALIVE }).toArray();
  if (!list.length) return null;
  const valide = list.find(estPrestataire) || list.find((p) => !p.aValider);
  if (valide) return valide;
  const client = await db.collection('clients').findOne({ telNorm: phone, _deleted: ALIVE }, { projection: { _id: 1 } });
  return client ? null : list[0];
}

// ---------- inscription publique ----------

/**
 * Crée le partenaire `loueur` à valider. Si un partenaire porte déjà ce numéro : rien de nouveau (et l'appelant répond pareil).
 * `f` : champs déjà validés {nom, societe, contact, telNorm, email, siren, vehicules, message}.
 */
export async function inscrirePrestataire(db, f) {
  return withLock(db, 'presta:' + f.telNorm, async () => {
    const deja = await db.collection('partenaires').findOne({ telNorm: f.telNorm, _deleted: ALIVE }, { projection: { nom: 1 } });
    if (deja) {
      await logActivity(db, { user: 'site', col: 'partenaires', docId: deja._id, action: 'inscription', resume: `Inscription prestataire reçue d’un numéro déjà au carnet : ${line(deja.nom, 80)}` });
      return { created: false, id: deja._id };
    }
    const id = newId('p');
    const fields = { nom: f.nom, type: 'loueur', contact: f.contact, tel: '+' + f.telNorm, email: f.email, aValider: true, inscription: { at: nowIso(), vehicules: f.vehicules, message: f.message } };
    if (f.societe) fields.societe = f.societe;
    if (f.siren) fields.siren = f.siren;
    await saveDoc(db, 'partenaires', id, fields, 'site', { action: 'inscription', resume: `Inscription prestataire à valider : ${f.nom}` });
    emit('prestataire_inscrit', { partenaireId: id, nom: f.nom, tel: '+' + f.telNorm, vehicules: f.vehicules });
    return { created: true, id };
  });
}
