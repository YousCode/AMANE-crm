// Espace prestataire : lien personnel à jeton (collection `acces_prestataires`, _id = partenaireId),
// missions confiées (chauffeur ou étape du programme), disponibilités de la flotte, confirmations (`confirmations`).
// Rien de sensible : ni montants, ni téléphones de clients, ni notes internes ; le client est réduit à son prénom.
import { labelOf, SERVICES, PROG_TYPES, PART_TYPES, vehicleOn, mapsLink, telPlus, firstName } from '@amane/shared';
import { now, nowIso } from './clock.js';
import { parisDay, addWallDays, wallToMs } from './paris.js';
import { HttpError } from './http.js';
import { newToken, TOKEN_RE } from './share.js';
import { logActivity } from './docs.js';
import { emit } from './bus.js';

/** Missions « confiées » : réservation ferme. Une option n'est pas encore confiée au prestataire. */
export const CONFIEES = ['confirmee', 'encours'];
const DAY = 86400000;

async function partenaireOr404(db, id) {
  const p = await db.collection('partenaires').findOne({ _id: id, _deleted: { $ne: true } });
  if (!p) throw new HttpError(404, 'introuvable', 'Partenaire introuvable.');
  return p;
}

export const accesOf = (db, partenaireId) => db.collection('acces_prestataires').findOne({ _id: partenaireId });

/** Crée (ou renvoie) le lien du partenaire ; `renew` remplace l'ancien jeton (l'ancien lien cesse de fonctionner). */
export async function ensureAcces(db, partenaireId, by, { renew = false } = {}) {
  const p = await partenaireOr404(db, partenaireId);
  const col = db.collection('acces_prestataires');
  const old = await col.findOne({ _id: partenaireId });
  if (old && TOKEN_RE.test(old.token) && !renew) return { acces: old, created: false, partenaire: p };
  const at = nowIso();
  const acces = { token: newToken(), createdAt: at, createdBy: by, vues: 0 };
  await col.updateOne({ _id: partenaireId }, { $set: acces, $unset: { vuAt: '', lastVuAt: '' } }, { upsert: true });
  await logActivity(db, { user: by, col: 'partenaires', docId: partenaireId, action: 'update', resume: old ? 'Nouveau lien de l’espace prestataire (l’ancien ne fonctionne plus)' : 'Lien de l’espace prestataire créé' });
  return { acces: { _id: partenaireId, ...acces }, created: true, partenaire: p };
}

/** Révoque le lien. Renvoie false s'il n'y en avait pas. */
export async function revokeAcces(db, partenaireId, by) {
  await partenaireOr404(db, partenaireId);
  const old = await db.collection('acces_prestataires').findOne({ _id: partenaireId });
  if (!old) return false;
  await db.collection('acces_prestataires').deleteOne({ _id: partenaireId });
  await logActivity(db, { user: by, col: 'partenaires', docId: partenaireId, action: 'update', resume: 'Lien de l’espace prestataire révoqué' });
  return true;
}

/** Jeton → {acces, partenaire} ; null si inconnu, révoqué, partenaire supprimé ou inactif. */
export async function byToken(db, token) {
  if (!TOKEN_RE.test(String(token || ''))) return null;
  const acces = await db.collection('acces_prestataires').findOne({ token });
  if (!acces) return null;
  const partenaire = await db.collection('partenaires').findOne({ _id: acces._id, _deleted: { $ne: true } });
  if (!partenaire || partenaire.actif === false) return null;
  return { acces, partenaire };
}

export async function markVu(db, acces) {
  const at = nowIso();
  await db.collection('acces_prestataires').updateOne({ _id: acces._id, token: acces.token }, { $set: { lastVuAt: at, ...(acces.vuAt ? {} : { vuAt: at }) }, $inc: { vues: 1 } });
}

/** La mission est-elle confiée à ce partenaire (chauffeur, ou étape du programme) ? */
export function confiee(m, pid) {
  return Boolean(m && !m._deleted && (m.chauffeurId === pid || (Array.isArray(m.programme) && m.programme.some((x) => x && x.partenaireId === pid))));
}

/** Missions fermes confiées au partenaire, qui ne sont pas encore terminées (fin ≥ aujourd'hui, heure de Paris). */
export function missionsConfiees(missions, pid, nowMs = now()) {
  const today = parisDay(nowMs);
  return (missions || [])
    .filter((m) => CONFIEES.includes(m.statut) && confiee(m, pid) && /^\d{4}-\d{2}-\d{2}/.test(String(m.debut || '')))
    .filter((m) => String(m.fin || m.debut).slice(0, 10) >= today)
    .sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
}

const confId = (missionId, pid) => `${missionId}:${pid}`;

/** Confirmation valable : même mission, même partenaire, mêmes dates qu'au moment de la confirmation. */
export function isConfirmed(conf, m) {
  return Boolean(conf && m && conf.debut === (m.debut || ''));
}

export async function confirmationsFor(db, pid) {
  const list = await db.collection('confirmations').find({ partenaireId: pid }).toArray();
  return new Map(list.map((c) => [c.missionId, c]));
}

/** Enregistre (ou retire) la confirmation d'une mission par le partenaire. `via` : 'espace' (le prestataire) ou 'equipe'. */
export async function setConfirmation(db, { mission, partenaire, by, via, confirme = true }) {
  if (!confiee(mission, partenaire._id)) throw new HttpError(409, 'non_confiee', 'Cette mission n’est pas confiée à ce prestataire.');
  const col = db.collection('confirmations');
  const id = confId(mission._id, partenaire._id);
  const at = nowIso();
  if (!confirme) {
    await col.deleteOne({ _id: id });
    await logActivity(db, { user: by, col: 'missions', docId: mission._id, action: 'update', resume: `Confirmation de ${partenaire.nom} retirée` });
    emit('confirmation', { missionId: mission._id, partenaireId: partenaire._id, confirme: false });
    return { confirme: false };
  }
  const prev = await col.findOne({ _id: id });
  if (isConfirmed(prev, mission)) return { confirme: true, at: prev.at, already: true };
  await col.updateOne({ _id: id }, { $set: { missionId: mission._id, partenaireId: partenaire._id, debut: mission.debut || '', at, by, via } }, { upsert: true });
  const resume = via === 'espace' ? `Mission confirmée par ${partenaire.nom} depuis son espace prestataire` : `Mission confirmée pour ${partenaire.nom} (noté par l’équipe)`;
  await logActivity(db, { user: by, col: 'missions', docId: mission._id, action: 'confirmation', resume });
  await logActivity(db, { user: by, col: 'partenaires', docId: partenaire._id, action: 'confirmation', resume: `${mission.titre || 'Mission'} : confirmée${via === 'espace' ? ' depuis l’espace prestataire' : ''}` });
  emit('confirmation', { missionId: mission._id, partenaireId: partenaire._id, confirme: true, via, nom: partenaire.nom, titre: mission.titre || '', responsable: mission.responsable || 'youssouf' });
  return { confirme: true, at, already: false };
}

const CIVILITE = /^(m|mr|mrs|ms|mme|mlle|miss|dr|sir|sheikh|cheikh|cheikha|prince|princesse|lady|lord)\.?$/i;

/** Client réduit au prénom : « John Smith » → « John » ; « Mme Ivanova » → « Mme I. ». */
export function prenomClient(nom) {
  const parts = String(nom || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (CIVILITE.test(parts[0])) return parts[1] ? `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.` : parts[0];
  return firstName(parts[0]) || parts[0].charAt(0).toUpperCase() + '.';
}

/** Jours [aujourd'hui, +n[ (heure de Paris) × véhicules : 'libre' | 'reserve' | 'option' | 'indisponible'. */
export function disponibilites(vehicules, missions, { nowMs = now(), jours = 14 } = {}) {
  const start = parisDay(nowMs);
  const days = Array.from({ length: jours }, (_, i) => addWallDays(start, i));
  const K = { f: 'libre', b: 'reserve', o: 'option', off: 'indisponible' };
  const vs = (vehicules || []).filter((v) => v && !v._deleted).sort((a, b) => (+a.ordre || 99) - (+b.ordre || 99));
  return {
    jours: days,
    vehicules: vs.map((v) => ({
      id: v._id, nom: v.nom || v._id, categorie: v.categorie || '',
      jours: days.map((d) => K[vehicleOn(v, missions, `${d}T00:00`, `${d}T23:59`).k] || 'libre'),
    })),
  };
}

/** Données de l'espace (JSON pour l'appli, et base de la page HTML). */
export function prestataireData({ token, partenaire, missions, clients, vehicules, confirmations, nowMs = now(), jours = 14 }) {
  const pid = partenaire._id;
  const byClient = new Map((clients || []).map((c) => [c._id, c]));
  const byVeh = new Map((vehicules || []).map((v) => [v._id, v]));
  const list = missionsConfiees(missions, pid, nowMs).map((m) => {
    const v = m.vehiculeId ? byVeh.get(m.vehiculeId) : null;
    const etapes = (Array.isArray(m.programme) ? m.programme : []).filter((x) => x && x.partenaireId === pid && x.dt).sort((a, b) => String(a.dt).localeCompare(String(b.dt)))
      .map((x) => ({ dt: x.dt, type: x.type || 'autre', typeLabel: labelOf(PROG_TYPES, x.type, 'Étape'), lieu: x.lieu || '', itineraire: x.lieu ? mapsLink(x.lieu) : '' }));
    const conf = confirmations && confirmations.get(m._id);
    const ok = isConfirmed(conf, m);
    return {
      id: m._id,
      debut: m.debut || '', fin: m.fin || '',
      service: labelOf(SERVICES, m.service, m.service || 'Mission'),
      role: m.chauffeurId === pid ? 'Chauffeur' : etapes.map((e) => e.typeLabel).filter((x, i, a) => a.indexOf(x) === i).join(', ') || 'Prestation',
      lieu: m.lieu || '', itineraire: m.lieu ? mapsLink(m.lieu) : '',
      client: prenomClient((byClient.get(m.clientId) || {}).nom),
      vehicule: v ? v.nom : '',
      etapes: m.chauffeurId === pid ? [] : etapes,
      confirmee: ok, confirmeeAt: ok ? conf.at : '',
      bientot: (wallToMs(m.debut) || 0) - nowMs < 7 * DAY,
    };
  });
  return {
    token,
    partenaire: { nom: partenaire.nom || '', prenom: firstName(partenaire.contact || partenaire.nom) || partenaire.nom || '', type: partenaire.type || '', typeLabel: labelOf(PART_TYPES, partenaire.type, 'Partenaire') },
    missions: list,
    disponibilites: disponibilites(vehicules, missions.filter((m) => !m._deleted), { nowMs, jours }),
    contact: { whatsapp: process.env.WHATSAPP_PUBLIC_NUMBER ? `https://wa.me/${String(process.env.WHATSAPP_PUBLIC_NUMBER).replace(/\D/g, '')}` : '', tel: process.env.PUBLIC_PHONE ? telPlus(process.env.PUBLIC_PHONE) : '' },
    majAt: new Date(nowMs).toISOString(),
  };
}
