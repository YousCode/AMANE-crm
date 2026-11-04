// POST /api/ai (Majordome), POST /api/translate, POST /api/transcribe, GET /api/digest
import { Router, wrap, sendJson, HttpError, auth, requireOrigin, query } from './_common.js';
import { readJson } from '../lib/http.js';
import { rateHit, tooMany } from '../lib/auth.js';
import { aiConfigured, claude, AiError } from '../lib/ai.js';
import { translateCached } from '../lib/translate.js';
import { transcribeMessage, transcribeConfigured } from '../lib/transcribe.js';
import { buildDigest } from '../lib/digest.js';
import { nowIso } from '../lib/clock.js';
import { toApi } from '../lib/db.js';
import { emit } from '../lib/bus.js';

const MAX_CHARS = 120000;
const LANGS = ['FR', 'EN', 'ES', 'AR', 'RU', 'IT', 'DE', 'ZH'];

export const router = Router();

function aiHttp(e) {
  if (e instanceof AiError) {
    const status = e.code === 'ia_off' ? 503 : e.code === 'ia_delai' ? 504 : e.code === 'ia_refus' ? 422 : 502;
    return new HttpError(status, e.code, e.message);
  }
  return e;
}

router.post('/api/ai', wrap(async (req, res) => {
  requireOrigin(req);
  const { db, user } = await auth(req);
  if (!aiConfigured()) throw new HttpError(503, 'ia_off', 'L’IA n’est pas configurée sur ce serveur.');
  const body = await readJson(req, 512 * 1024);
  const { system, messages } = body;
  if (!Array.isArray(messages) || !messages.length || messages.length > 40) throw new HttpError(400, 'messages_invalides', 'Liste de messages invalide.');
  let total = 0;
  const clean = messages.map((m) => {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) {
      throw new HttpError(400, 'messages_invalides', 'Chaque message doit avoir un rôle (user ou assistant) et un texte.');
    }
    total += m.content.length;
    return { role: m.role, content: m.content };
  });
  if (clean[0].role !== 'user' || clean[clean.length - 1].role !== 'user') throw new HttpError(400, 'messages_invalides', 'La conversation doit commencer et finir par un message de l’utilisateur.');
  if (system !== undefined && typeof system !== 'string') throw new HttpError(400, 'system_invalide', 'Consigne invalide.');
  total += (system || '').length;
  if (total > MAX_CHARS) throw new HttpError(413, 'trop_lourd', 'Texte trop long pour l’IA.');
  let maxTokens = parseInt(body.max_tokens ?? 1024, 10);
  if (!Number.isFinite(maxTokens) || maxTokens < 1) maxTokens = 1024;
  maxTokens = Math.min(maxTokens, 4096);
  if (await rateHit(db, 'ai:u:' + user.id, 60 * 60 * 1000) > 200) throw tooMany('Trop de demandes à l’IA cette heure-ci.');
  try {
    const { text } = await claude({ system: system || undefined, messages: clean, maxTokens, timeoutMs: 25000 });
    sendJson(res, 200, { text });
  } catch (e) { throw aiHttp(e); }
}));

router.post('/api/translate', wrap(async (req, res) => {
  requireOrigin(req);
  const { db, user } = await auth(req);
  const body = await readJson(req, 64 * 1024);
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) throw new HttpError(400, 'texte_vide', 'Texte à traduire manquant.');
  if (text.length > 6000) throw new HttpError(413, 'trop_lourd', 'Texte trop long (6 000 caractères maximum).');
  const to = String(body.to || '').toUpperCase();
  if (!LANGS.includes(to)) throw new HttpError(400, 'langue_invalide', 'Langue cible invalide (FR, EN, ES, AR, RU, IT, DE, ZH).');
  const from = body.from ? String(body.from).toUpperCase() : undefined;
  if (from && !LANGS.includes(from)) throw new HttpError(400, 'langue_invalide', 'Langue d’origine invalide.');
  const context = body.context === 'document' ? 'document' : 'message';
  if (await rateHit(db, 'tr:u:' + user.id, 60 * 60 * 1000) > 600) throw tooMany('Trop de traductions cette heure-ci.');
  try {
    const r = await translateCached(db, { text, to, from, context });
    if (body.messageId && typeof body.messageId === 'string' && /^[A-Za-z0-9_.=+/-]{1,200}$/.test(body.messageId) && to === 'FR') {
      const col = db.collection('messages');
      const m = await col.findOne({ _id: body.messageId });
      if (m && m.dir === 'in') {
        await col.updateOne({ _id: m._id }, { $set: { translation: r.text, translationLang: 'FR', sourceLang: r.from || '', updatedAt: nowIso(), updatedBy: user.id } });
        emit('message', { message: toApi({ ...m, translation: r.text, translationLang: 'FR', sourceLang: r.from || '' }) });
      }
    }
    sendJson(res, 200, { text: r.text, from: r.from, cached: r.cached });
  } catch (e) { throw aiHttp(e); }
}));

router.post('/api/transcribe', wrap(async (req, res) => {
  requireOrigin(req);
  const { db, user } = await auth(req);
  if (!transcribeConfigured()) throw new HttpError(503, 'transcribe_off', 'La transcription n’est pas configurée (WHISPER_API_KEY).');
  const body = await readJson(req, 4 * 1024);
  const id = typeof body.mediaId === 'string' ? body.mediaId : typeof body.messageId === 'string' ? body.messageId : '';
  if (!id || !/^[A-Za-z0-9_.=+/-]{1,200}$/.test(id)) throw new HttpError(400, 'id_invalide', 'Identifiant de message (wamid) attendu dans mediaId.');
  let m = await db.collection('messages').findOne({ _id: id });
  if (!m) m = await db.collection('messages').findOne({ 'media.id': id });
  if (!m) throw new HttpError(404, 'introuvable', 'Message introuvable.');
  if (await rateHit(db, 'tr:w:' + user.id, 60 * 60 * 1000) > 120) throw tooMany('Trop de transcriptions cette heure-ci.');
  const r = await transcribeMessage(db, m._id);
  let translation = null;
  if (aiConfigured() && r.text && (r.lang || '') !== 'FR') {
    try {
      const t = await translateCached(db, { text: r.text, to: 'FR', from: r.lang || undefined, context: 'message' });
      translation = t.text;
      await db.collection('messages').updateOne({ _id: m._id }, { $set: { translation: t.text, translationLang: 'FR', sourceLang: t.from || r.lang || '' } });
    } catch (e) { /* la transcription reste utile sans traduction */ }
  }
  const fresh = await db.collection('messages').findOne({ _id: m._id });
  if (fresh) emit('message', { message: toApi(fresh) });
  sendJson(res, 200, { text: r.text, lang: r.lang, translation, cached: r.cached, messageId: m._id });
}));

router.get('/api/digest', wrap(async (req, res) => {
  const { db } = await auth(req);
  const semaine = query(req).semaine || '';
  if (semaine && !/^\d{4}-(W\d{2}|\d{2}-\d{2})$/.test(semaine)) throw new HttpError(400, 'semaine_invalide', 'Paramètre « semaine » invalide (AAAA-MM-JJ ou AAAA-Www).');
  sendJson(res, 200, await buildDigest(db, semaine));
}));
