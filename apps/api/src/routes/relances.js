// GET /api/relances, GET /api/rappels, POST /api/rappels/run, POST /api/alertes/run, POST /api/digest/send
import { Router, wrap, sendJson, auth, authOrInternal, requireOrigin, query } from './_common.js';
import { computeRelances } from '../lib/relances.js';
import { runRappels, computeDue } from '../lib/rappels.js';
import { runAlerts } from '../lib/alerts.js';
import { sendDigest } from '../lib/digest.js';
import { toApi } from '../lib/db.js';

export const router = Router();

router.get('/api/relances', wrap(async (req, res) => {
  const { db } = await auth(req);
  const items = await computeRelances(db);
  const type = query(req).type;
  sendJson(res, 200, { items: type ? items.filter((r) => r.type === type) : items });
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
