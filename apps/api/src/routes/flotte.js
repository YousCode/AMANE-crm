// GET /api/flotte/rentabilite?mois=AAAA-MM
import { Router, wrap, sendJson, HttpError, auth, query } from './_common.js';
import { rentabilite } from '../lib/flotte.js';

export const router = Router();
router.get('/api/flotte/rentabilite', wrap(async (req, res) => {
  const { db } = await auth(req);
  const mois = query(req).mois || '';
  if (mois && !/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) throw new HttpError(400, 'mois_invalide', 'Paramètre « mois » invalide (AAAA-MM).');
  sendJson(res, 200, await rentabilite(db, mois));
}));
