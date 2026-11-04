// GET /api/sync?since=ISO
import { Router, wrap, sendJson, auth, query } from './_common.js';
import { buildSync } from '../lib/sync.js';

export const router = Router();
router.get('/api/sync', wrap(async (req, res) => {
  const { db } = await auth(req);
  sendJson(res, 200, await buildSync(db, query(req).since || ''));
}));
