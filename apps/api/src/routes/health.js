// GET /api/health — public : ce qui est actif sur ce déploiement.
import { Router, wrap, sendJson, getDb } from './_common.js';
import { dbConfigured } from '../lib/db.js';
import { waConfigured } from '../lib/whatsapp.js';
import { aiConfigured } from '../lib/ai.js';
import { transcribeConfigured } from '../lib/transcribe.js';
import { VERSION } from '../lib/version.js';

export const router = Router();

router.get('/api/health', wrap(async (req, res) => {
  let db = false;
  if (dbConfigured()) {
    try {
      const d = await getDb();
      await d.collection('meta').findOne({ _id: 'schema' }, { projection: { _id: 1 } });
      db = true;
    } catch (e) {
      console.error('[amane] base injoignable', e && e.message);
    }
  }
  const auth = (process.env.AUTH_SECRET || '').length >= 32;
  const out = {
    ok: db && auth,
    db,
    auth,
    whatsapp: waConfigured() && Boolean(process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN),
    ia: aiConfigured(),
    version: VERSION,
  };
  // Forme exacte du contrat (6 clés) ; `?detail=1` ajoute ce que la v2 sait faire.
  if (req.query.detail === '1') Object.assign(out, { transcription: transcribeConfigured(), push: true, ws: true, cron: process.env.CRON_ENABLED === '1', fake: process.env.FAKE_DB === '1' });
  sendJson(res, 200, out);
}));
