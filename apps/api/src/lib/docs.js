// Écritures de fiches : champs serveur (updatedAt, updatedBy, createdAt, telNorm),
// suppression douce, journal d'activité avec résumé en français.
import { HttpError, ID_RE, isPlainObject } from './http.js';
import { nowIso } from './clock.js';
import { newId, toApi } from './db.js';
import { emit } from './bus.js';
import { normPhone } from './phone.js';

export const WRITABLE = ['clients', 'missions', 'vehicules', 'services', 'partenaires', 'reglages'];
export const SYNCED = [...WRITABLE, 'conversations', 'messages'];
/** Collections annoncées sur le WebSocket (`{type:'change', col, doc}`). */
export const BROADCAST = [...WRITABLE, 'rappels'];

const SERVER_FIELDS = new Set(['_id', 'id', 'updatedAt', 'updatedBy', 'createdAt', '_deleted', 'telNorm']);
const IGNORED_IN_SUMMARY = new Set([...SERVER_FIELDS]);
/** Champs posés par le serveur uniquement : un PUT du CRM ne peut ni les créer, ni les changer, ni les retirer. */
export const PROTECTED = { partenaires: ['portailToken', 'portailAt'] };

export const STATUT_MISSION = {
  nouvelle: 'Nouvelle', proposition: 'Proposition', confirmee: 'Confirmée', encours: 'En cours', terminee: 'Terminée', perdue: 'Perdue',
};
const STATUT_CLIENT = { prospect: 'Prospect', client: 'Client', habitue: 'Habitué', vip: 'VIP' };
const FIELD_LABEL = { debut: 'dates', fin: 'dates' };

export function checkCol(col) {
  if (!WRITABLE.includes(col)) throw new HttpError(400, 'collection_invalide', 'Collection non permise.');
}

export function checkId(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new HttpError(400, 'id_invalide', 'Identifiant invalide.');
}

/** Champs envoyés par le CRM → champs stockables (sans champs serveur, sans clés dangereuses). */
export function cleanFields(body) {
  if (!isPlainObject(body)) throw new HttpError(400, 'corps_invalide', 'La fiche doit être un objet.');
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (SERVER_FIELDS.has(k)) continue;
    if (!k || k.length > 64 || k.startsWith('$') || k.includes('.') || k.includes('\0')) {
      throw new HttpError(400, 'champ_invalide', `Nom de champ invalide : ${k.slice(0, 40)}`);
    }
    if (v === undefined) continue;
    checkKeys(v, 0);
    out[k] = v;
  }
  return out;
}

function checkKeys(v, depth) {
  if (depth > 12) throw new HttpError(400, 'champ_invalide', 'Fiche trop imbriquée.');
  if (Array.isArray(v)) { for (const x of v) checkKeys(x, depth + 1); return; }
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (k.startsWith('$') || k.includes('\0')) throw new HttpError(400, 'champ_invalide', 'Nom de champ invalide.');
      checkKeys(x, depth + 1);
    }
  }
}

function label(doc, id) {
  return String((doc && (doc.titre || doc.nom)) || id).slice(0, 80);
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Résumé français d'une modification. null si rien n'a changé. */
export function summarize(col, old, fields) {
  const changed = Object.keys(fields).filter((k) => !IGNORED_IN_SUMMARY.has(k) && !same(old[k], fields[k]));
  if (!changed.length) return null;
  const parts = [];
  let rest = changed;
  if (changed.includes('statut') && (col === 'missions' || col === 'clients')) {
    const L = col === 'missions' ? STATUT_MISSION : STATUT_CLIENT;
    const lab = (s) => L[s] || (s ? String(s) : '—');
    parts.push(`statut : ${lab(old.statut)} → ${lab(fields.statut)}`);
    rest = changed.filter((k) => k !== 'statut');
  }
  if (rest.length) parts.push(`modifié : ${[...new Set(rest.map((k) => FIELD_LABEL[k] || k))].join(', ')}`);
  return parts.join(' ; ');
}

let seq = 0;
/** Identifiant croissant (tri secondaire stable quand deux entrées ont la même heure). */
function activityId() {
  seq = (seq + 1) % 1679616;
  return 'a' + Date.now().toString(36).padStart(9, '0') + seq.toString(36).padStart(4, '0') + newId().slice(0, 4);
}

export async function logActivity(db, { user, col, docId, action, resume }) {
  await db.collection('activity').insertOne({
    _id: activityId(), at: nowIso(), user, col, docId, action, resume: String(resume || '').slice(0, 300),
  });
}

/**
 * Écrit une fiche.
 * - opts.replace (PUT du CRM) : la fiche envoyée remplace l'ancienne ; les champs absents sont retirés
 *   (sauf champs serveur : createdAt conservé, telNorm recalculé).
 * - sinon (écritures serveur : WhatsApp, site, IA) : fusion, les champs absents sont conservés.
 * opts.activity : false pour ne rien journaliser ; opts.action / opts.resume pour forcer l'entrée.
 * opts.keep : champs que cette écriture ne touche pas (ni posés, ni retirés : la valeur stockée reste).
 * opts.unset : champs à retirer (écritures serveur en mode fusion).
 */
export async function saveDoc(db, col, id, fields, by, opts = {}) {
  const c = db.collection(col);
  const keep = Array.isArray(opts.keep) ? opts.keep : [];
  if (keep.length) fields = Object.fromEntries(Object.entries(fields).filter(([k]) => !keep.includes(k)));
  const old = await c.findOne({ _id: id });
  const at = nowIso();
  const set = { ...fields };
  if (col === 'clients' || col === 'partenaires') {
    const tel = 'tel' in fields || opts.replace ? fields.tel : old && old.tel;
    set.telNorm = normPhone(tel);
  }
  set.updatedAt = at;
  set.updatedBy = by;
  const update = { $set: set, $setOnInsert: { createdAt: at } };
  const wasDeleted = Boolean(old && old._deleted);
  const unset = {};
  if (wasDeleted) unset._deleted = '';
  const removed = [];
  if (opts.replace && old) {
    for (const k of Object.keys(old)) {
      if (!(k in fields) && !SERVER_FIELDS.has(k) && !keep.includes(k)) { unset[k] = ''; removed.push(k); }
    }
  }
  for (const k of Array.isArray(opts.unset) ? opts.unset : []) {
    if (!(k in set) && !SERVER_FIELDS.has(k) && old && k in old && !(k in unset)) { unset[k] = ''; removed.push(k); }
  }
  if (Object.keys(unset).length) update.$unset = unset;
  await c.updateOne({ _id: id }, update, { upsert: true });
  const created = !old || wasDeleted;
  if (opts.activity !== false) {
    let resume = opts.resume;
    let action = opts.action;
    if (!resume) {
      if (created) resume = `Création : ${label({ ...(old || {}), ...fields }, id)}`;
      else {
        const after = { ...fields };
        for (const k of removed) after[k] = undefined;
        resume = summarize(col, old, after);
      }
    }
    if (!action) action = created ? 'create' : 'update';
    if (resume) await logActivity(db, { user: by, col, docId: id, action, resume });
  }
  if (opts.broadcast !== false && BROADCAST.includes(col)) {
    const stored = await c.findOne({ _id: id });
    if (stored) emit('change', { col, doc: toApi(stored), by, created, old: old && !old._deleted ? toApi(old) : null, fields });
  }
  return { id, updatedAt: at, created };
}

export async function softDelete(db, col, id, by) {
  const c = db.collection(col);
  const old = await c.findOne({ _id: id });
  if (!old || old._deleted) return false;
  const at = nowIso();
  const update = { $set: { _deleted: true, updatedAt: at, updatedBy: by } };
  // Un partenaire supprimé perd son lien de portail pour de bon : le recréer ne ranime pas l'ancien jeton.
  if (PROTECTED[col]) update.$unset = Object.fromEntries(PROTECTED[col].map((k) => [k, '']));
  await c.updateOne({ _id: id }, update);
  await logActivity(db, { user: by, col, docId: id, action: 'delete', resume: `Suppression : ${label(old, id)}` });
  if (BROADCAST.includes(col)) emit('deleted', { col, id, by });
  return true;
}
