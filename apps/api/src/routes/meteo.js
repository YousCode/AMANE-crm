// GET /api/meteo — session requise : la météo de Paris pour le salon (cache 15 min). 503 meteo_off si indisponible.
import { Router, wrap, sendJson, auth } from './_common.js';
import { sendError } from '../lib/http.js';
import { getMeteo } from '../lib/meteo.js';

export const router = Router();

router.get('/api/meteo', wrap(async (req, res) => {
  await auth(req);
  const m = await getMeteo();
  if (!m) return sendError(res, 503, 'meteo_off', 'Météo indisponible pour l’instant.');
  sendJson(res, 200, m, { 'Cache-Control': 'private, max-age=300' });
}));
