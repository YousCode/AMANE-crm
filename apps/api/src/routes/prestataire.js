// Espace prestataire : GET|POST|DELETE /api/partenaires/:id/espace (équipe), GET /api/prestataire/:token (public, HTML ou JSON),
// POST /api/prestataire/:token/missions/:id/confirmer (public), POST /api/missions/:id/confirmation (équipe).
import { Router, wrap, sendJson, HttpError, auth, getDb, requireOrigin, query } from './_common.js';
import { clientIp, ID_RE, readJson } from '../lib/http.js';
import { rateHit, tooMany } from '../lib/auth.js';
import { publicUrl } from '../lib/share.js';
import { normPhone } from '../lib/phone.js';
import { firstName } from '@amane/shared';
import { now } from '../lib/clock.js';
import { accesOf, ensureAcces, revokeAcces, byToken, markVu, missionsConfiees, confirmationsFor, isConfirmed, setConfirmation, prestataireData } from '../lib/prestataire.js';
import { prestatairePage } from '../pages/prestataire.js';
import { expiredPage } from '../pages/devis.js';

export const router = Router();

const checkId = (id) => { if (!ID_RE.test(String(id || ''))) throw new HttpError(400, 'id_invalide', 'Identifiant invalide.'); };
const espaceUrl = (req, token) => publicUrl(req, `/api/prestataire/${token}`);

/** Message prérempli pour envoyer le lien au prestataire. */
function lienMessage(p, url) {
  const prenom = firstName(p.contact || p.nom);
  return `Bonjour${prenom ? ' ' + prenom : ''}, voici votre espace prestataire Amane : vos missions et les disponibilités de notre flotte, à jour en temps réel. ${url}`;
}

router.get('/api/partenaires/:id/espace', wrap(async (req, res) => {
  const { db } = await auth(req);
  checkId(req.params.id);
  const p = await db.collection('partenaires').findOne({ _id: req.params.id, _deleted: { $ne: true } });
  if (!p) throw new HttpError(404, 'introuvable', 'Partenaire introuvable.');
  const [a, missions, confs] = await Promise.all([accesOf(db, p._id), db.collection('missions').find({ _deleted: { $ne: true } }).toArray(), confirmationsFor(db, p._id)]);
  const ms = missionsConfiees(missions, p._id).map((m) => { const c = confs.get(m._id); return { id: m._id, debut: m.debut || '', titre: m.titre || '', ...(isConfirmed(c, m) ? { confirmeeAt: c.at } : {}) }; });
  sendJson(res, 200, a
    ? { actif: true, url: espaceUrl(req, a.token), createdAt: a.createdAt, createdBy: a.createdBy, vuAt: a.vuAt || '', vues: a.vues || 0, missions: ms }
    : { actif: false, missions: ms });
}));

router.post('/api/partenaires/:id/espace', wrap(async (req, res) => {
  requireOrigin(req);
  const { db, user } = await auth(req);
  checkId(req.params.id);
  const body = await readJson(req, 2048);
  const r = await ensureAcces(db, req.params.id, user.id, { renew: body && body.renouveler === true });
  const url = espaceUrl(req, r.acces.token);
  const message = lienMessage(r.partenaire, url);
  const tel = normPhone(r.partenaire.tel);
  sendJson(res, 200, { token: r.acces.token, url, created: r.created, createdAt: r.acces.createdAt, message, waLink: tel ? `https://wa.me/${tel}?text=${encodeURIComponent(message)}` : '' });
}));

router.delete('/api/partenaires/:id/espace', wrap(async (req, res) => {
  requireOrigin(req);
  const { db, user } = await auth(req);
  checkId(req.params.id);
  sendJson(res, 200, { ok: true, revoked: await revokeAcces(db, req.params.id, user.id) });
}));

async function load(req) {
  const db = await getDb();
  if (await rateHit(db, 'p:ip:' + clientIp(req), 60 * 60 * 1000) > 240) throw tooMany('Trop de requêtes.');
  const x = await byToken(db, req.params.token);
  return { db, x };
}

function html(res, status, body) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(body);
}

const wantsJson = (req) => query(req).format === 'json' || (/application\/json/.test(String(req.headers.accept || '')) && !/text\/html/.test(String(req.headers.accept || '')));

router.get(['/api/prestataire/:token', '/prestataire/:token'], wrap(async (req, res) => {
  const { db, x } = await load(req);
  const json = wantsJson(req);
  if (!x) {
    if (json) throw new HttpError(404, 'introuvable', 'Ce lien n’est plus valable.');
    return html(res, 404, expiredPage('FR'));
  }
  const [missions, clients, vehicules, confirmations] = await Promise.all([
    db.collection('missions').find({ _deleted: { $ne: true } }).toArray(),
    db.collection('clients').find({ _deleted: { $ne: true } }, { projection: { nom: 1 } }).toArray(),
    db.collection('vehicules').find({ _deleted: { $ne: true } }, { projection: { nom: 1, categorie: 1, statut: 1, ordre: 1 } }).toArray(),
    confirmationsFor(db, x.partenaire._id),
  ]);
  const jours = Math.min(31, Math.max(7, parseInt(query(req).jours || '14', 10) || 14));
  const data = prestataireData({ token: x.acces.token, partenaire: x.partenaire, missions, clients, vehicules, confirmations, nowMs: now(), jours });
  await markVu(db, x.acces);
  if (json) { res.setHeader('Cache-Control', 'no-store'); return sendJson(res, 200, data); }
  const ok = query(req).confirme;
  html(res, 200, prestatairePage(data, { flash: ok && data.missions.some((m) => m.id === ok && m.confirmee) ? 'Merci, la mission est confirmée. La maison en est informée.' : '' }));
}));

router.post('/api/prestataire/:token/missions/:id/confirmer', wrap(async (req, res) => {
  requireOrigin(req);
  const { db, x } = await load(req);
  if (!x) throw new HttpError(404, 'introuvable', 'Ce lien n’est plus valable.');
  checkId(req.params.id);
  const m = await db.collection('missions').findOne({ _id: req.params.id, _deleted: { $ne: true } });
  if (!m || !missionsConfiees([m], x.partenaire._id).length) throw new HttpError(404, 'introuvable', 'Mission introuvable.');
  const r = await setConfirmation(db, { mission: m, partenaire: x.partenaire, by: 'prestataire', via: 'espace' });
  if (/text\/html/.test(String(req.headers.accept || '')) || /form-urlencoded/.test(String(req.headers['content-type'] || '')) || !req.headers['content-type']) {
    res.statusCode = 303;
    res.setHeader('Location', `/api/prestataire/${x.acces.token}?confirme=${encodeURIComponent(m._id)}#m-${encodeURIComponent(m._id)}`);
    res.setHeader('Cache-Control', 'no-store');
    return res.end();
  }
  sendJson(res, 200, { ok: true, confirmeeAt: r.at, already: r.already });
}));

router.post('/api/missions/:id/confirmation', wrap(async (req, res) => {
  requireOrigin(req);
  const { db, user } = await auth(req);
  checkId(req.params.id);
  const body = await readJson(req, 2048);
  if (!body || !ID_RE.test(String(body.partenaireId || ''))) throw new HttpError(400, 'partenaire_invalide', 'Indiquez le partenaire.');
  const [m, p] = await Promise.all([
    db.collection('missions').findOne({ _id: req.params.id, _deleted: { $ne: true } }),
    db.collection('partenaires').findOne({ _id: body.partenaireId, _deleted: { $ne: true } }),
  ]);
  if (!m) throw new HttpError(404, 'introuvable', 'Demande introuvable.');
  if (!p) throw new HttpError(404, 'introuvable', 'Partenaire introuvable.');
  const r = await setConfirmation(db, { mission: m, partenaire: p, by: user.id, via: 'equipe', confirme: body.confirme !== false });
  sendJson(res, 200, { ok: true, confirme: r.confirme, confirmeeAt: r.at || '' });
}));
