// Prestataires (loueurs) — contrat : docs/prestataires.md
//   Équipe (session)   POST /api/partenaires/:id/portail · POST /api/partenaires/:id/valider · POST /api/missions/:id/dispo
//   Prestataire (jeton) GET /p/:token · GET /api/portail/:token · POST /api/portail/:token/dispos|vehicules|demandes/:missionId
//   Public              GET /prestataires · POST /api/prestataires/inscription
// Routes publiques : no-store, noindex, limite de débit par IP, même origine pour les écritures, 404 identique pour tout jeton refusé.
import { randomBytes } from 'node:crypto';
import { Router, wrap, sendJson, HttpError, auth, getDb, requireOrigin, methodNotAllowed } from './_common.js';
import { readJson, readRaw, clientIp, ID_RE } from '../lib/http.js';
import { requireSameOrigin } from '../lib/origin.js';
import { rateHit, tooMany } from '../lib/auth.js';
import { now } from '../lib/clock.js';
import { toApi } from '../lib/db.js';
import { emit } from '../lib/bus.js';
import { normPhone } from '../lib/phone.js';
import { parisDay } from '../lib/paris.js';
import { publicUrl, TOKEN_RE } from '../lib/share.js';
import { waConfigured, sendToConversation } from '../lib/whatsapp.js';
import {
  str, line, ensurePortail, validerPartenaire, partenaireByToken, portailData, declarerDispos, proposerVehicule,
  contexteDemande, poserDemande, repondreDemande, inscrirePrestataire, messagePortail, messageDispo, paramsDispo,
} from '../lib/portail.js';
import { portailPage, lienPerime, messagePage, inscriptionPage, merciPage } from '../pages/portail.js';

export const router = Router();

const HOUR = 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]{1,190}\.[A-Za-z]{2,24}$/;

function checkId(id) { if (typeof id !== 'string' || !ID_RE.test(id)) throw new HttpError(400, 'id_invalide', 'Identifiant invalide.'); }
const lienWa = (p, message) => { const n = p.telNorm || normPhone(p.tel); return n ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : ''; };

// ---------- équipe ----------

function reponsePortail(req, r) {
  const url = publicUrl(req, `/p/${r.token}`);
  const message = messagePortail(r.partenaire, url);
  return { token: r.token, url, created: r.created, message, waLink: lienWa(r.partenaire, message) };
}

router.post('/api/partenaires/:id/portail', wrap(async (req, res) => {
  requireOrigin(req);
  const { db, user } = await auth(req);
  checkId(req.params.id);
  const body = await readJson(req, 1024);
  sendJson(res, 200, reponsePortail(req, await ensurePortail(db, req.params.id, user.id, { reset: body.reset === true })));
}));

router.post('/api/partenaires/:id/valider', wrap(async (req, res) => {
  requireOrigin(req);
  const { db, user } = await auth(req);
  checkId(req.params.id);
  await validerPartenaire(db, req.params.id, user.id);
  sendJson(res, 200, reponsePortail(req, await ensurePortail(db, req.params.id, user.id)));
}));

/** Tente l'envoi WhatsApp au prestataire : texte dans la fenêtre de 24 h, sinon modèle `amane_dispo`. Jamais d'exception. */
async function envoyerDispo(db, { partenaire: p, message, params, by }) {
  const to = p.telNorm || normPhone(p.tel);
  if (!waConfigured() || !to) return false;
  try {
    const prev = await db.collection('conversations').findOne({ _id: to });
    const r = await sendToConversation(db, { conv: prev || { _id: to }, by, text: message, fallbackTemplate: { name: 'amane_dispo', lang: 'fr', params }, timeoutMs: 6000 });
    const at = r.doc.at;
    // La conversation du prestataire existe désormais (créée au besoin), marquée `partenaireId`.
    await db.collection('conversations').updateOne(
      { _id: to },
      { $set: { phone: to, partenaireId: p._id, lastAt: at, lastText: String(r.text).slice(0, 200), lastDir: 'out', lastOutAt: at, lastHumanOutAt: at, updatedAt: at, updatedBy: by }, $setOnInsert: { nom: p.nom || '+' + to, lang: 'FR', unread: 0, createdAt: at } },
      { upsert: true },
    );
    const c = await db.collection('conversations').findOne({ _id: to });
    if (c) emit('conversation', { conversation: toApi(c) });
    return true;
  } catch (e) {
    console.error('[amane] demande de disponibilité par WhatsApp impossible', e && (e.code || e.message));
    return false;
  }
}

router.post('/api/missions/:id/dispo', wrap(async (req, res) => {
  requireOrigin(req);
  const { db, user } = await auth(req);
  checkId(req.params.id);
  const body = await readJson(req, 2 * 1024);
  if (typeof body.vehiculeId !== 'string' || !ID_RE.test(body.vehiculeId)) throw new HttpError(400, 'id_invalide', 'Véhicule invalide.');
  const { mission, vehicule, partenaire } = await contexteDemande(db, req.params.id, body.vehiculeId);
  const { token } = await ensurePortail(db, partenaire._id, user.id);
  const url = publicUrl(req, `/p/${token}`);
  const message = messageDispo(partenaire, vehicule, mission, url);
  const canal = (await envoyerDispo(db, { partenaire, message, params: paramsDispo(partenaire, vehicule, mission, url), by: user.id })) ? 'whatsapp' : 'lien';
  await poserDemande(db, { missionId: mission._id, vehicule, partenaire, canal, by: user.id });
  sendJson(res, 200, { ok: true, canal, url, message, waLink: lienWa(partenaire, message) });
}));

// ---------- routes publiques : outils ----------

const isForm = (req) => /^application\/x-www-form-urlencoded\b/i.test(String(req.headers['content-type'] || ''));

/** Corps JSON, ou formulaire HTML classique (page utilisée sans JavaScript) : champs texte à plat. */
async function readBody(req, limit) {
  if (!isForm(req)) return readJson(req, limit);
  const out = Object.create(null);
  for (const [k, v] of new URLSearchParams((await readRaw(req, limit)).toString('utf8'))) if (!(k in out)) out[k] = v;
  return out;
}

function entetes(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Frame-Options', 'DENY');
}

/** Page HTML : aucun script hors celui de la page (nonce), aucune ressource tierce hors les polices de la charte. */
function html(res, status, page) {
  const nonce = randomBytes(16).toString('base64');
  res.statusCode = status;
  entetes(res);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`);
  res.end(typeof page === 'function' ? page(nonce) : page);
}

function redirect(res, to) {
  res.statusCode = 303;
  res.setHeader('Location', to);
  res.end();
}

const perime = () => Object.assign(new HttpError(404, 'introuvable', 'Ce lien n’est plus valable.'), { lien: true });

/**
 * Enveloppe d'une route publique : en-têtes, même origine pour les écritures, et, pour un formulaire envoyé sans
 * JavaScript, les erreurs en page HTML plutôt qu'en JSON.
 */
const pub = (fn, { retour = () => '' } = {}) => wrap(async (req, res) => {
  entetes(res);
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') requireSameOrigin(req);
    await fn(req, res);
  } catch (e) {
    if (!(e instanceof HttpError) || !isForm(req) || res.headersSent) throw e;
    html(res, e.status, e.lien ? lienPerime() : messagePage({ message: e.message, retour: retour(req) }));
  }
});

const retourPortail = (req) => { const t = String(req.params.token || ''); return TOKEN_RE.test(t) ? `/p/${t}` : ''; };

/** Limite de débit puis jeton. `p` est null pour tout jeton refusé (mal formé, inconnu, révoqué, à valider, supprimé). */
async function portail(req, { write = false } = {}) {
  const db = await getDb();
  const ip = clientIp(req);
  if (await rateHit(db, 'p:ip:' + ip, HOUR) > 240) throw tooMany('Trop de requêtes. Réessayez dans un moment.');
  if (write && await rateHit(db, 'pw:ip:' + ip, HOUR) > 120) throw tooMany('Trop de modifications. Réessayez dans un moment.');
  return { db, p: await partenaireByToken(db, String(req.params.token || '')) };
}

/** Écriture du prestataire : le jeton est vérifié avant toute lecture du corps (404 identique quel que soit le corps). */
async function ecriture(req) {
  const { db, p } = await portail(req, { write: true });
  if (!p) throw perime();
  return { db, p };
}

// ---------- prestataire (jeton) ----------

router.get('/p/:token', pub(async (req, res) => {
  const { db, p } = await portail(req);
  if (!p) return html(res, 404, lienPerime());
  const data = await portailData(db, p);
  const today = parisDay(now());
  const wa = normPhone(process.env.WHATSAPP_PUBLIC_NUMBER || '');
  html(res, 200, (nonce) => portailPage({ token: p.portailToken, data, today, max: `${Number(today.slice(0, 4)) + 2}${today.slice(4)}`, contact: wa ? `https://wa.me/${wa}` : '', nonce }));
}));

router.get('/api/portail/:token', pub(async (req, res) => {
  const { db, p } = await portail(req);
  if (!p) throw perime();
  sendJson(res, 200, await portailData(db, p));
}));

router.post('/api/portail/:token/dispos', pub(async (req, res) => {
  const { db, p } = await ecriture(req);
  const body = await readJson(req, 8 * 1024);
  checkId(body.vehiculeId);
  sendJson(res, 200, { ok: true, dispos: await declarerDispos(db, p, body.vehiculeId, body.dispos) });
}));

router.post('/api/portail/:token/vehicules', pub(async (req, res) => {
  const { db, p } = await ecriture(req);
  const vehicule = await proposerVehicule(db, p, await readBody(req, 4 * 1024));
  if (isForm(req)) return redirect(res, `/p/${p.portailToken}`);
  sendJson(res, 200, { ok: true, id: vehicule.id, vehicule });
}, { retour: retourPortail }));

router.post('/api/portail/:token/demandes/:missionId', pub(async (req, res) => {
  const { db, p } = await ecriture(req);
  checkId(req.params.missionId);
  const body = await readBody(req, 1024);
  checkId(body.vehiculeId);
  const r = await repondreDemande(db, { partenaire: p, missionId: req.params.missionId, vehiculeId: body.vehiculeId, reponse: body.reponse, canal: 'portail' });
  if (isForm(req)) return redirect(res, `/p/${p.portailToken}`);
  sendJson(res, 200, { ok: true, statut: r.statut, deja: r.deja });
}, { retour: retourPortail }));

// ---------- inscription publique ----------

router.get('/prestataires', pub(async (req, res) => {
  const db = await getDb();
  if (await rateHit(db, 'p:ip:' + clientIp(req), HOUR) > 240) throw tooMany('Trop de requêtes. Réessayez dans un moment.');
  html(res, 200, (nonce) => inscriptionPage({ nonce }));
}));

router.all('/api/prestataires/inscription', pub(async (req, res) => {
  if (req.method !== 'POST') throw methodNotAllowed(['POST']);
  const body = await readBody(req, 16 * 1024);
  const fini = () => (isForm(req) ? html(res, 200, merciPage()) : sendJson(res, 200, { ok: true }));
  if (str(body.website, 200)) return fini(); // champ piège : réponse normale, rien n'est créé
  const db = await getDb();
  if (await rateHit(db, 'presta:ip:' + clientIp(req), HOUR) > 5) throw tooMany('Trop de demandes envoyées. Réessayez plus tard ou écrivez-nous sur WhatsApp.');
  const societe = line(body.societe, 120);
  const contact = line(body.nom, 120);
  const telRaw = line(body.tel, 40);
  const telNorm = normPhone(telRaw);
  const email = line(body.email, 200).toLowerCase();
  const sirenRaw = line(body.siren, 20);
  const siren = sirenRaw.replace(/[\s.-]/g, '');
  if (!societe && !contact) throw new HttpError(400, 'nom_requis', 'Indiquez votre nom ou celui de votre société.');
  if (!telRaw) throw new HttpError(400, 'tel_requis', 'Indiquez un numéro de téléphone.');
  if (!telNorm) throw new HttpError(400, 'tel_invalide', 'Numéro de téléphone invalide.');
  if (email && !EMAIL_RE.test(email)) throw new HttpError(400, 'email_invalide', 'Adresse e-mail invalide.');
  if (sirenRaw && !/^\d{9}$/.test(siren)) throw new HttpError(400, 'siren_invalide', 'SIREN invalide (9 chiffres).');
  // Numéro déjà au carnet : rien n'est créé et la réponse est la même (pas de fuite d'existence).
  await inscrirePrestataire(db, { nom: societe || contact, societe, contact, telNorm, email, siren, vehicules: str(body.vehicules, 1000), message: str(body.message, 2000) });
  fini();
}, { retour: () => '/prestataires' }));
