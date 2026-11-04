// Transcription des vocaux WhatsApp : média Meta → Whisper (OpenAI, WHISPER_API_KEY) → {text, lang}.
import { HttpError } from './http.js';
import { toBuffer, fetchMetaMedia, storeBlob } from './media.js';
import { nowIso } from './clock.js';

export const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';
export const transcribeConfigured = () => Boolean(process.env.WHISPER_API_KEY);

const ISO2 = { fr: 'FR', en: 'EN', es: 'ES', ar: 'AR', ru: 'RU', it: 'IT', de: 'DE', zh: 'ZH' };
const EXT = { 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr', 'audio/opus': 'ogg', 'audio/wav': 'wav' };

export async function whisper({ buf, mime, timeoutMs = 20000 }) {
  const fd = new FormData();
  fd.append('model', 'whisper-1');
  fd.append('response_format', 'verbose_json');
  fd.append('file', new Blob([buf], { type: mime }), 'vocal.' + (EXT[mime] || 'ogg'));
  let r;
  try {
    r = await fetch(WHISPER_URL, { method: 'POST', headers: { Authorization: `Bearer ${process.env.WHISPER_API_KEY}` }, body: fd, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new HttpError(504, 'transcribe_delai', 'La transcription n’a pas répondu à temps.');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || typeof j.text !== 'string') throw new HttpError(502, 'transcribe_erreur', 'La transcription a échoué.');
  const lang = ISO2[String(j.language || '').toLowerCase().slice(0, 2)] || '';
  return { text: j.text.trim().slice(0, 8000), lang };
}

/** Transcrit le vocal du message `messageId` (téléchargé si besoin) ; pose transcript/transcriptLang. Idempotent. */
export async function transcribeMessage(db, messageId) {
  if (!transcribeConfigured()) throw new HttpError(503, 'transcribe_off', 'La transcription n’est pas configurée (WHISPER_API_KEY).');
  const msgs = db.collection('messages');
  const m = await msgs.findOne({ _id: messageId });
  if (!m) throw new HttpError(404, 'introuvable', 'Message introuvable.');
  if (m.transcript) return { text: m.transcript, lang: m.transcriptLang || '', cached: true };
  if (!m.media || !m.media.id || !/^audio\//.test(m.media.mime || '') && m.type !== 'audio') throw new HttpError(400, 'pas_un_vocal', 'Ce message n’est pas un vocal.');
  let buf; let mime = m.media.mime || 'audio/ogg';
  if (m.media.photoId) {
    const p = await db.collection('photos').findOne({ _id: m.media.photoId });
    buf = p && toBuffer(p.data); if (p && p.type) mime = p.type;
  }
  if (!buf) {
    const r = await fetchMetaMedia(m.media.id);
    buf = r.buf; mime = r.mime;
    const photoId = await storeBlob(db, { buf, mime, by: 'whatsapp', mediaId: m.media.id, sha256: r.sha256 });
    await msgs.updateOne({ _id: messageId }, { $set: { 'media.photoId': photoId } });
  }
  const { text, lang } = await whisper({ buf, mime: mime.split(';')[0] });
  await msgs.updateOne({ _id: messageId }, { $set: { transcript: text, transcriptLang: lang, updatedAt: nowIso(), updatedBy: 'ia' } });
  return { text, lang, cached: false };
}
