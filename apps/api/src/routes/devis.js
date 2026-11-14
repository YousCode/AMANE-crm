// Devis partagé : GET/POST /api/devis/:id/share, GET /d/:token, POST /d/:token/accepter
import { Router, wrap, sendJson, HttpError, auth, getDb, requireOrigin, query } from './_common.js';
import { clientIp, ID_RE } from '../lib/http.js';
import { rateHit, tooMany } from '../lib/auth.js';
import { nowIso } from '../lib/clock.js';
import { ensureDevisShare, missionByShareToken, markDevisViewed, acceptDevis, publicUrl, TOKEN_RE } from '../lib/share.js';
import { devisPage, expiredPage } from '../pages/devis.js';
import { docLang, t, firstName } from '@amane/shared';
import { normPhone } from '../lib/phone.js';
import { getMaison } from '../lib/maison.js';

export const router = Router();

function checkId(id) { if (!ID_RE.test(String(id || ''))) throw new HttpError(400, 'id_invalide', 'Identifiant invalide.'); }

async function shareInfo(db, req, id, create, user) {
  const r = await ensureDevisShare(db, id, user.id, { create });
  const client = await db.collection('clients').findOne({ _id: r.mission.clientId });
  const lang = docLang(client);
  const url = publicUrl(req, `/d/${r.token}`);
  const dv = r.mission.devis || {};
  const message = t((client && client.langue) || lang, 'quick.devis_lien', { prenom: firstName(client && client.nom), numero: dv.numero || '', lien: url });
  return { token: r.token, url, created: r.created, lang, message, vuAt: dv.vuAt || null, acceptedAt: dv.acceptedAt || null, statut: dv.statut || 'envoye', waLink: client && client.tel ? `https://wa.me/${normPhone(client.tel)}?text=${encodeURIComponent(message)}` : '' };
}

router.get('/api/devis/:id/share', wrap(async (req, res) => {
  const { db, user } = await auth(req);
  checkId(req.params.id);
  sendJson(res, 200, await shareInfo(db, req, req.params.id, false, user));
}));

router.post('/api/devis/:id/share', wrap(async (req, res) => {
  requireOrigin(req);
  const { db, user } = await auth(req);
  checkId(req.params.id);
  sendJson(res, 200, await shareInfo(db, req, req.params.id, true, user));
}));

async function publicMission(req) {
  const db = await getDb();
  if (await rateHit(db, 'd:ip:' + clientIp(req), 60 * 60 * 1000) > 120) throw tooMany('Trop de requêtes.');
  const token = String(req.params.token || '');
  if (!TOKEN_RE.test(token)) return { db, m: null };
  const m = await missionByShareToken(db, token);
  return { db, m, token };
}

router.get('/d/:token', wrap(async (req, res) => {
  const { db, m, token } = await publicMission(req);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!m || !m.devis) { res.statusCode = 404; return res.end(expiredPage(String(query(req).lang || 'EN').toUpperCase())); }
  const client = (await db.collection('clients').findOne({ _id: m.clientId })) || {};
  await markDevisViewed(db, m);
  const waNumber = normPhone(process.env.WHATSAPP_PUBLIC_NUMBER || '') || '';
  if (query(req).format === 'json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ numero: m.devis.numero || '', statut: m.devis.statut || 'envoye', lang: docLang(client), titre: m.titre, lignes: m.devis.lignes || [], remise: m.devis.remise || 0, tva: m.devis.tva ?? 20, acceptedAt: m.devis.acceptedAt || null }));
  }
  res.end(devisPage({ mission: m, client, token, waNumber, nowIso: nowIso(), maison: await getMaison(db) }));
}));

router.post('/d/:token/accepter', wrap(async (req, res) => {
  const { db, m, token } = await publicMission(req);
  res.setHeader('Cache-Control', 'no-store');
  if (!m || !m.devis) throw new HttpError(404, 'introuvable', 'Ce lien n’est plus valable.');
  const r = await acceptDevis(db, m);
  const wantsJson = /application\/json/.test(String(req.headers.accept || '')) || query(req).format === 'json';
  if (wantsJson) return sendJson(res, 200, { ok: true, accepted: true, already: r.already, acceptedAt: r.acceptedAt });
  res.statusCode = 303;
  res.setHeader('Location', `/d/${token}`);
  res.end();
}));
