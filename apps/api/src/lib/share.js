// Liens publics : devis partagé (/d/:token) et espace client (/api/espace/:token). Jetons de 24 caractères.
import { randomBytes } from 'node:crypto';
import { nowIso } from './clock.js';
import { HttpError } from './http.js';
import { saveDoc, logActivity } from './docs.js';
import { emit } from './bus.js';

export const TOKEN_RE = /^[A-Za-z0-9_-]{24}$/;
export const newToken = () => randomBytes(18).toString('base64url').slice(0, 24);

export function publicUrl(req, path) {
  const base = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
  if (base) return base + path;
  const proto = (req && req.headers['x-forwarded-proto'] && String(req.headers['x-forwarded-proto']).split(',')[0].trim()) || (req && req.protocol) || 'https';
  const host = (req && (req.headers['x-forwarded-host'] || req.headers.host)) || 'localhost';
  return `${proto}://${String(host).split(',')[0].trim()}${path}`;
}

async function missionOr404(db, id) {
  const m = await db.collection('missions').findOne({ _id: id, _deleted: { $ne: true } });
  if (!m) throw new HttpError(404, 'introuvable', 'Demande introuvable.');
  return m;
}

/** Crée (ou renvoie) le jeton public du devis de la mission `id`. */
export async function ensureDevisShare(db, id, by, { create = true } = {}) {
  const m = await missionOr404(db, id);
  const dv = m.devis || {};
  if (!Array.isArray(dv.lignes) || !dv.lignes.length) throw new HttpError(409, 'devis_vide', 'Ajoutez au moins une ligne au devis avant de le partager.');
  if (dv.shareToken && TOKEN_RE.test(dv.shareToken)) return { token: dv.shareToken, created: false, mission: m };
  if (!create) throw new HttpError(404, 'introuvable', 'Aucun lien pour ce devis.');
  const token = newToken();
  const at = nowIso();
  const devis = { ...dv, shareToken: token, shareAt: at, statut: dv.statut === 'brouillon' || !dv.statut ? 'envoye' : dv.statut, sentAt: dv.sentAt || at };
  await saveDoc(db, 'missions', id, { devis }, by, { action: 'devis', resume: `Lien du devis ${dv.numero || ''} créé`.replace(/\s+/g, ' ').trim() });
  return { token, created: true, mission: { ...m, devis } };
}

export async function missionByShareToken(db, token) {
  if (!TOKEN_RE.test(String(token || ''))) return null;
  return db.collection('missions').findOne({ 'devis.shareToken': token, _deleted: { $ne: true } });
}

export async function markDevisViewed(db, m) {
  if (m.devis && m.devis.vuAt) return false;
  const at = nowIso();
  await db.collection('missions').updateOne({ _id: m._id }, { $set: { 'devis.vuAt': at, updatedAt: at, updatedBy: 'client' } });
  const fresh = await db.collection('missions').findOne({ _id: m._id });
  if (fresh) emit('change', { col: 'missions', doc: { id: fresh._id, ...Object.fromEntries(Object.entries(fresh).filter(([k]) => k !== '_id' && k !== '_deleted')) }, by: 'client' });
  return true;
}

export async function acceptDevis(db, m) {
  if (m.devis && m.devis.statut === 'accepte') return { already: true, acceptedAt: m.devis.acceptedAt };
  const at = nowIso();
  const devis = { ...(m.devis || {}), statut: 'accepte', acceptedAt: at, vuAt: (m.devis && m.devis.vuAt) || at };
  const fields = { devis };
  if (m.statut === 'nouvelle' || m.statut === 'proposition') fields.statut = 'confirmee';
  await saveDoc(db, 'missions', m._id, fields, 'client', { action: 'devis', resume: `Devis ${devis.numero || ''} accepté par le client via le lien`.replace(/\s+/g, ' ').trim() });
  emit('devis_accepte', { missionId: m._id, clientId: m.clientId, numero: devis.numero || '', titre: m.titre || '', responsable: m.responsable || 'amel', montant: 0 });
  return { already: false, acceptedAt: at };
}

/** Crée (ou renvoie) le jeton de l'espace client d'une mission. */
export async function ensureEspace(db, id, by) {
  const m = await missionOr404(db, id);
  if (m.espaceToken && TOKEN_RE.test(m.espaceToken)) return { token: m.espaceToken, created: false, mission: m };
  const token = newToken();
  await saveDoc(db, 'missions', id, { espaceToken: token, espaceAt: nowIso() }, by, { resume: 'Espace client créé' });
  await logActivity(db, { user: by, col: 'missions', docId: id, action: 'update', resume: 'Lien de l’espace client créé' }).catch(() => {});
  return { token, created: true, mission: { ...m, espaceToken: token } };
}

export async function missionByEspaceToken(db, token) {
  if (!TOKEN_RE.test(String(token || ''))) return null;
  return db.collection('missions').findOne({ espaceToken: token, _deleted: { $ne: true } });
}
