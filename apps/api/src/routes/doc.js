// Fiches : PUT|DELETE /api/doc/:col/:id, POST /api/counter, GET /api/activity (+ formes réécrites /api/doc?col=&id= et ?op=)
import { Router, wrap, sendJson, HttpError, auth, requireOrigin, query, methodNotAllowed } from './_common.js';
import { readJson, ID_RE } from '../lib/http.js';
import { isDuplicate } from '../lib/db.js';
import { checkCol, checkId, cleanFields, saveDoc, softDelete } from '../lib/docs.js';
import { nowIso } from '../lib/clock.js';
import { alertPv } from '../lib/alerts.js';
import { track } from '../lib/background.js';

const DOC_LIMIT = 512 * 1024;
const RESERVED = new Set(['_id', 'updatedAt', 'createdAt', 'updatedBy']);

export const router = Router();

router.all('/api/doc', wrap(async (req, res) => {
  const q = query(req);
  if (q.op === 'counter') return counter(req, res);
  if (q.op === 'activity') return activity(req, res, q);
  if (q.col || q.id) return doc(req, res, q.col || '', q.id || '');
  throw new HttpError(404, 'introuvable', 'Route inconnue.');
}));
router.all('/api/doc/:col/:id', wrap((req, res) => doc(req, res, req.params.col, req.params.id)));
router.all('/api/counter', wrap((req, res) => counter(req, res)));
router.all('/api/activity', wrap((req, res) => activity(req, res, query(req))));

async function doc(req, res, col, id) {
  if (req.method !== 'PUT' && req.method !== 'DELETE') throw methodNotAllowed(['PUT', 'DELETE']);
  requireOrigin(req);
  const { db, user } = await auth(req);
  checkCol(col);
  checkId(id);
  if (req.method === 'DELETE') {
    await softDelete(db, col, id, user.id);
    return sendJson(res, 200, { ok: true });
  }
  const fields = cleanFields(await readJson(req, DOC_LIMIT));
  let before = null;
  if (col === 'vehicules' && Array.isArray(fields.journal)) before = await db.collection(col).findOne({ _id: id }, { projection: { journal: 1, nom: 1, responsable: 1 } });
  const r = await saveDoc(db, col, id, fields, user.id, { replace: true });
  if (before !== null || (col === 'vehicules' && Array.isArray(fields.journal))) {
    const seen = new Set(((before && before.journal) || []).map((j) => JSON.stringify(j)));
    const fresh = fields.journal.filter((j) => j && j.type === 'pv' && !seen.has(JSON.stringify(j)));
    if (fresh.length) track(alertPv(db, { _id: id, nom: fields.nom || (before && before.nom) || id, responsable: fields.responsable }, fresh), 'alerte PV');
  }
  sendJson(res, 200, { id: r.id, updatedAt: r.updatedAt });
}

async function counter(req, res) {
  if (req.method !== 'POST') throw methodNotAllowed(['POST']);
  requireOrigin(req);
  const { db } = await auth(req);
  const { key } = await readJson(req, 2 * 1024);
  if (typeof key !== 'string' || !ID_RE.test(key) || RESERVED.has(key)) {
    throw new HttpError(400, 'cle_invalide', 'Clé de compteur invalide (ex. devis-2026).');
  }
  const meta = db.collection('meta');
  const inc = () => meta.findOneAndUpdate(
    { _id: 'compteurs' },
    { $inc: { [key]: 1 }, $set: { updatedAt: nowIso() } },
    { upsert: true, returnDocument: 'after' },
  );
  let d;
  try {
    d = await inc();
  } catch (e) {
    if (!isDuplicate(e)) throw e;
    d = await inc();
  }
  sendJson(res, 200, { n: d[key] });
}

async function activity(req, res, q) {
  if (req.method !== 'GET') throw methodNotAllowed(['GET']);
  const { db } = await auth(req);
  const filter = {};
  if (q.docId) {
    if (!ID_RE.test(q.docId)) throw new HttpError(400, 'id_invalide', 'Identifiant invalide.');
    filter.docId = q.docId;
  }
  let limit = parseInt(q.limit || '50', 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  limit = Math.min(limit, 200);
  const items = await db.collection('activity').find(filter, { sort: { at: -1, _id: -1 }, limit }).toArray();
  sendJson(res, 200, { items: items.map(({ _id, ...rest }) => ({ id: _id, ...rest })) });
}
