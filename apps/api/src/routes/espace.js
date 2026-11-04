// Espace client : POST /api/missions/:id/espace, GET /api/espace/:token (+ /devis, /facture, /photo/:id)
import { Router, wrap, sendJson, HttpError, auth, getDb, requireOrigin, query } from './_common.js';
import { clientIp, ID_RE } from '../lib/http.js';
import { rateHit, tooMany } from '../lib/auth.js';
import { ensureEspace, missionByEspaceToken, publicUrl, TOKEN_RE } from '../lib/share.js';
import { espaceData, espacePage } from '../pages/espace.js';
import { devisBody, expiredPage } from '../pages/devis.js';
import { shell } from '../pages/shell.js';
import { docLang, t, firstName } from '@amane/shared';
import { normPhone } from '../lib/phone.js';
import { toBuffer, IMAGE_TYPES } from '../lib/media.js';

export const router = Router();

router.post('/api/missions/:id/espace', wrap(async (req, res) => {
  requireOrigin(req);
  const { db, user } = await auth(req);
  if (!ID_RE.test(req.params.id)) throw new HttpError(400, 'id_invalide', 'Identifiant invalide.');
  const r = await ensureEspace(db, req.params.id, user.id);
  const client = await db.collection('clients').findOne({ _id: r.mission.clientId });
  const url = publicUrl(req, `/api/espace/${r.token}`);
  const message = t((client && client.langue) || docLang(client), 'quick.espace_lien', { prenom: firstName(client && client.nom), lien: url });
  sendJson(res, 200, { token: r.token, url, created: r.created, message, waLink: client && client.tel ? `https://wa.me/${normPhone(client.tel)}?text=${encodeURIComponent(message)}` : '' });
}));

async function load(req) {
  const db = await getDb();
  if (await rateHit(db, 'e:ip:' + clientIp(req), 60 * 60 * 1000) > 240) throw tooMany('Trop de requêtes.');
  const token = String(req.params.token || '');
  const m = TOKEN_RE.test(token) ? await missionByEspaceToken(db, token) : null;
  if (!m) return { db, m: null, token };
  const [client, vehicule, chauffeur, partenaires] = await Promise.all([
    db.collection('clients').findOne({ _id: m.clientId }),
    m.vehiculeId ? db.collection('vehicules').findOne({ _id: m.vehiculeId, _deleted: { $ne: true } }) : null,
    m.chauffeurId ? db.collection('partenaires').findOne({ _id: m.chauffeurId, _deleted: { $ne: true } }) : null,
    db.collection('partenaires').find({ _deleted: { $ne: true } }, { projection: { nom: 1, adresse: 1 } }).toArray(),
  ]);
  return { db, m, token, client: client || {}, vehicule, chauffeur: chauffeur || (m.chauffeur ? { nom: m.chauffeur } : null), partenaires };
}

function html(res, status, body) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(body);
}

router.get(['/api/espace/:token', '/espace/:token'], wrap(async (req, res) => {
  const x = await load(req);
  const wantsJson = query(req).format === 'json' || (/application\/json/.test(String(req.headers.accept || '')) && !/text\/html/.test(String(req.headers.accept || '')));
  if (!x.m) {
    if (wantsJson) throw new HttpError(404, 'introuvable', 'Ce lien n’est plus valable.');
    return html(res, 404, expiredPage('EN'));
  }
  const data = espaceData({ mission: x.m, client: x.client, vehicule: x.vehicule, chauffeur: x.chauffeur, token: x.token, partenaires: x.partenaires });
  if (wantsJson) { res.setHeader('Cache-Control', 'no-store'); return sendJson(res, 200, data); }
  html(res, 200, espacePage(data));
}));

for (const kind of ['devis', 'facture']) {
  router.get(`/api/espace/:token/${kind}`, wrap(async (req, res) => {
    const x = await load(req);
    if (!x.m || !x.m.devis || !Array.isArray(x.m.devis.lignes) || !x.m.devis.lignes.length || (kind === 'facture' && !x.m.devis.factureNumero)) return html(res, 404, expiredPage('EN'));
    const L = docLang(x.client);
    html(res, 200, shell({ lang: L, title: `${t(L, kind === 'facture' ? 'doc.invoice' : 'doc.quote')} ${kind === 'facture' ? x.m.devis.factureNumero : x.m.devis.numero || ''}`.trim(), body: devisBody({ mission: x.m, client: x.client, kind, L }) }));
  }));
}

router.get('/api/espace/:token/photo/:id', wrap(async (req, res) => {
  const x = await load(req);
  if (!x.m || !x.chauffeur || x.chauffeur.photoId !== req.params.id || !ID_RE.test(req.params.id)) throw new HttpError(404, 'introuvable', 'Photo introuvable.');
  const p = await x.db.collection('photos').findOne({ _id: req.params.id });
  const buf = p && toBuffer(p.data);
  if (!buf || !IMAGE_TYPES.includes(p.type)) throw new HttpError(404, 'introuvable', 'Photo introuvable.');
  res.statusCode = 200;
  res.setHeader('Content-Type', p.type);
  res.setHeader('Content-Length', String(buf.length));
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(buf);
}));
