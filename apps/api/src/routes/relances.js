// GET /api/relances, POST /api/relances/envoyer, POST /api/relances/marquer, GET /api/relances/historique, GET /api/rappels, POST /api/rappels/run, POST /api/alertes/run, POST /api/digest/send
import { Router, wrap, sendJson, HttpError, auth, authOrInternal, requireOrigin, query } from './_common.js';
import { computeRelances, sendRelance, markRelance, historique } from '../lib/relances.js';
import { readJson, ID_RE } from '../lib/http.js';
import { publicUrl } from '../lib/share.js';
import { runRappels, computeDue } from '../lib/rappels.js';
import { runAlerts } from '../lib/alerts.js';
import { sendDigest } from '../lib/digest.js';
import { toApi } from '../lib/db.js';

export const router = Router();

router.get('/api/relances', wrap(async (req, res) => {
  const { db } = await auth(req);
  const items = await computeRelances(db, undefined, { base: publicUrl(req, '') });
  const type = query(req).type;
  sendJson(res, 200, { items: type ? items.filter((r) => r.type === type) : items });
}));

router.post('/api/relances/envoyer', wrap(async (req, res) => {
  requireOrigin(req);
  const { db, user } = await auth(req);
  const body = await readJson(req, 8 * 1024);
  sendJson(res, 200, { ok: true, ...(await sendRelance(db, { key: body.key, by: user.id, texte: body.texte, base: publicUrl(req, '') })) });
}));

router.post('/api/relances/marquer', wrap(async (req, res) => {
  requireOrigin(req);
  const { db, user } = await auth(req);
  const body = await readJson(req, 4 * 1024);
  sendJson(res, 200, { ok: true, ...(await markRelance(db, { key: body.key, by: user.id, note: typeof body.note === 'string' ? body.note : '' })) });
}));

router.get('/api/relances/historique', wrap(async (req, res) => {
  const { db } = await auth(req);
  const q = query(req);
  const [k, v] = [['clientId', q.clientId], ['missionId', q.missionId], ['partenaireId', q.partenaireId]].find(([, x]) => x) || [];
  if (!k || !ID_RE.test(v)) throw new HttpError(400, 'fiche_invalide', 'Indiquez clientId, missionId ou partenaireId.');
  sendJson(res, 200, { items: await historique(db, { [k]: v }) });
}));

router.get('/api/rappels', wrap(async (req, res) => {
  const { db } = await auth(req);
  const q = query(req);
  const filter = {};
  if (q.missionId) filter.missionId = q.missionId;
  const items = await db.collection('rappels').find(filter, { sort: { updatedAt: -1 }, limit: 200 }).toArray();
  const dus = q.dus === '1' ? (await computeDue(db)).map((d) => ({ type: d.type, missionId: d.mission._id, dueAt: new Date(d.dueAt).toISOString() })) : undefined;
  sendJson(res, 200, { items: items.map(toApi), ...(dus ? { dus } : {}) });
}));

router.post('/api/rappels/run', wrap(async (req, res) => {
  requireOrigin(req);
  const { db } = await authOrInternal(req);
  sendJson(res, 200, await runRappels(db));
}));

router.post('/api/alertes/run', wrap(async (req, res) => {
  requireOrigin(req);
  const { db } = await authOrInternal(req);
  sendJson(res, 200, await runAlerts(db));
}));

router.post('/api/digest/send', wrap(async (req, res) => {
  requireOrigin(req);
  const { db } = await authOrInternal(req);
  sendJson(res, 200, await sendDigest(db));
}));
