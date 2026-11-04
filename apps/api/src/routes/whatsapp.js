// WhatsApp : GET/POST /api/whatsapp (Meta), /api/whatsapp/send|read|note|assign|templates, /api/conversations/:id/messages
import { Router, wrap, sendJson, HttpError, auth, getDb, requireOrigin, query, methodNotAllowed } from './_common.js';
import { readRaw, readJson, ID_RE } from '../lib/http.js';
import { safeEqual, TEAM } from '../lib/auth.js';
import { nowIso } from '../lib/clock.js';
import { normPhone } from '../lib/phone.js';
import { toApi } from '../lib/db.js';
import { emit } from '../lib/bus.js';
import { track } from '../lib/background.js';
import {
  waConfigured, verifySignature, handleWebhook, runFollowups, sendToConversation, recordNote, markReadMeta, getTemplates,
} from '../lib/whatsapp.js';
import { ensureDevisShare, ensureEspace, publicUrl } from '../lib/share.js';
import { docLang, t, firstName, mapsLink } from '@amane/shared';

export const router = Router();

const dispatch = wrap(async (req, res) => {
  const action = req.params.action || query(req).action || '';
  if (action === 'send') return send(req, res);
  if (action === 'read') return markRead(req, res);
  if (action === 'note') return note(req, res);
  if (action === 'assign') return assign(req, res);
  if (action === 'templates') return templates(req, res);
  if (action) throw new HttpError(404, 'introuvable', 'Route inconnue.');
  if (req.method === 'GET') return verify(req, res);
  if (req.method === 'POST') return receive(req, res);
  throw methodNotAllowed(['GET', 'POST']);
});
router.all('/api/whatsapp', dispatch);
router.all('/api/whatsapp/:action', dispatch);

function verify(req, res) {
  const q = query(req);
  const expected = process.env.WHATSAPP_VERIFY_TOKEN || '';
  const ok = expected && q['hub.mode'] === 'subscribe' && safeEqual(q['hub.verify_token'] || '', expected);
  if (!ok) throw new HttpError(403, 'verification_refusee', 'Jeton de vérification incorrect.');
  const challenge = String(q['hub.challenge'] || '').slice(0, 200);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(challenge);
}

async function receive(req, res) {
  const secret = process.env.WHATSAPP_APP_SECRET || '';
  if (!secret) throw new HttpError(503, 'whatsapp_off', 'WhatsApp n’est pas configuré sur ce serveur.');
  const raw = await readRaw(req, 1024 * 1024);
  if (!verifySignature(raw, req.headers['x-hub-signature-256'], secret)) throw new HttpError(401, 'signature', 'Signature invalide.');
  let payload;
  try { payload = JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, 'json_invalide', 'Corps illisible.'); }
  const db = await getDb();
  const { followups, stats } = await handleWebhook(db, payload);
  sendJson(res, 200, { ok: true, ...stats });
  track(runFollowups(followups, 12000), 'suites WhatsApp');
}

const convIdOf = (v) => { const id = normPhone('+' + String(v || '').replace(/\D/g, '')); return id && id === String(v) ? id : ''; };

async function conversation(db, body) {
  const convId = convIdOf(body.convId);
  if (!convId) throw new HttpError(400, 'conversation_invalide', 'Conversation invalide.');
  const conv = await db.collection('conversations').findOne({ _id: convId });
  if (!conv || conv._deleted) throw new HttpError(404, 'introuvable', 'Conversation introuvable.');
  return conv;
}

async function send(req, res) {
  if (req.method !== 'POST') throw methodNotAllowed(['POST']);
  requireOrigin(req);
  const { db, user } = await auth(req);
  if (!waConfigured()) throw new HttpError(503, 'whatsapp_off', 'WhatsApp n’est pas configuré sur ce serveur.');
  const body = await readJson(req, 16 * 1024);
  const conv = await conversation(db, body);
  let { text, media, location } = body;
  // Document devis/facture demandé par son chemin (`/api/missions/:id/devis.pdf`) : pas de PDF côté serveur,
  // on envoie le lien public du devis (ou de la facture dans l'espace client) dans la langue du client.
  const docPath = media && typeof media.url === 'string' && /^(?:https?:\/\/[^/]+)?\/api\/missions\/([A-Za-z0-9_-]{1,64})\/(devis|facture)\.pdf$/.exec(media.url);
  if (docPath) {
    const client = conv.clientId ? await db.collection('clients').findOne({ _id: conv.clientId }) : null;
    const lang = (client && client.langue) || conv.lang || docLang(client);
    if (docPath[2] === 'devis') {
      const sh = await ensureDevisShare(db, docPath[1], user.id);
      text = t(lang, 'quick.devis_lien', { prenom: firstName(client && client.nom), numero: (sh.mission.devis && sh.mission.devis.numero) || '', lien: publicUrl(req, `/d/${sh.token}`) });
    } else {
      const es = await ensureEspace(db, docPath[1], user.id);
      text = t(lang, 'quick.espace_lien', { prenom: firstName(client && client.nom), lien: publicUrl(req, `/api/espace/${es.token}/facture`) });
    }
    media = undefined;
  }
  // Position sans coordonnées : itinéraire en texte (pas de géocodage côté serveur).
  if (location && !(Number(location.lat) || Number(location.lng)) && (location.address || location.name)) {
    const lieu = String(location.address || location.name).slice(0, 300);
    const client = conv.clientId ? await db.collection('clients').findOne({ _id: conv.clientId }, { projection: { nom: 1, langue: 1 } }) : null;
    text = t((client && client.langue) || conv.lang || 'EN', 'quick.itineraire', { prenom: firstName(client && client.nom), lieu, lien: mapsLink(lieu) });
    location = undefined;
  }
  const r = await sendToConversation(db, {
    conv, by: user.id,
    text, media, location, contact: body.contact, template: body.template, replyTo: body.replyTo,
    extra: body.originalText && typeof body.originalText === 'string' ? { originalText: body.originalText.slice(0, 4096), translation: body.originalText.slice(0, 4096), translationLang: 'FR', sourceLang: 'FR' } : undefined,
  });
  await db.collection('conversations').updateOne({ _id: conv._id }, { $set: { unread: 0 } });
  sendJson(res, 200, { id: r.id, type: r.type, text: r.text });
}

async function markRead(req, res) {
  if (req.method !== 'POST') throw methodNotAllowed(['POST']);
  requireOrigin(req);
  const { db, user } = await auth(req);
  const { convId } = await readJson(req, 2 * 1024);
  if (typeof convId !== 'string' || !ID_RE.test(convId)) throw new HttpError(400, 'conversation_invalide', 'Conversation invalide.');
  const r = await db.collection('conversations').findOneAndUpdate({ _id: convId }, { $set: { unread: 0, updatedAt: nowIso(), updatedBy: user.id } }, { returnDocument: 'after' });
  if (!r) throw new HttpError(404, 'introuvable', 'Conversation introuvable.');
  emit('conversation', { conversation: toApi(r) });
  track(markReadMeta(db, r), 'accusé de lecture');
  sendJson(res, 200, { ok: true });
}

async function note(req, res) {
  if (req.method !== 'POST') throw methodNotAllowed(['POST']);
  requireOrigin(req);
  const { db, user } = await auth(req);
  const body = await readJson(req, 16 * 1024);
  const conv = await conversation(db, body);
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) throw new HttpError(400, 'texte_vide', 'Note vide.');
  if (text.length > 4096) throw new HttpError(400, 'texte_trop_long', 'Note trop longue.');
  const doc = await recordNote(db, { convId: conv._id, text, by: user.id, missionId: conv.missionId });
  if (body.assigne !== undefined) await setAssigne(db, conv, body.assigne, user);
  sendJson(res, 200, { id: doc._id, message: toApi(doc) });
}

async function setAssigne(db, conv, assigne, user) {
  const who = assigne === '' || assigne === null ? '' : String(assigne).toLowerCase();
  if (who && !TEAM[who]) throw new HttpError(400, 'utilisateur_inconnu', 'Prénom inconnu (amel, youssouf ou aziz).');
  const r = await db.collection('conversations').findOneAndUpdate({ _id: conv._id }, { $set: { assigne: who, updatedAt: nowIso(), updatedBy: user.id } }, { returnDocument: 'after' });
  if (r) emit('conversation', { conversation: toApi(r) });
  if (who && who !== user.id) {
    await recordNote(db, { convId: conv._id, text: `${user.nom} a transmis la conversation à ${TEAM[who].nom}.`, by: user.id, missionId: conv.missionId });
  }
  return who;
}

async function assign(req, res) {
  if (req.method !== 'POST') throw methodNotAllowed(['POST']);
  requireOrigin(req);
  const { db, user } = await auth(req);
  const body = await readJson(req, 4 * 1024);
  const conv = await conversation(db, body);
  const who = await setAssigne(db, conv, body.assigne, user);
  if (typeof body.note === 'string' && body.note.trim()) await recordNote(db, { convId: conv._id, text: body.note.trim().slice(0, 4096), by: user.id, missionId: conv.missionId });
  sendJson(res, 200, { ok: true, assigne: who });
}

async function templates(req, res) {
  if (req.method !== 'GET') throw methodNotAllowed(['GET']);
  const { db } = await auth(req);
  sendJson(res, 200, { modeles: await getTemplates(db) });
}

router.get('/api/conversations/:id/messages', wrap(async (req, res) => {
  const { db } = await auth(req);
  const convId = convIdOf(req.params.id);
  if (!convId) throw new HttpError(400, 'conversation_invalide', 'Conversation invalide.');
  const q = query(req);
  let limit = parseInt(q.limit || '100', 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 100;
  limit = Math.min(limit, 500);
  const filter = { convId };
  if (q.before) { const ms = Date.parse(q.before); if (Number.isNaN(ms)) throw new HttpError(400, 'before_invalide', 'Paramètre « before » invalide.'); filter.at = { $lt: new Date(ms).toISOString() }; }
  const items = await db.collection('messages').find(filter, { sort: { at: -1 }, limit }).toArray();
  sendJson(res, 200, { items: items.reverse().map(toApi), hasMore: items.length === limit });
}));
