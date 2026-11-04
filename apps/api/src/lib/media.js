// Médias WhatsApp : téléchargement depuis Meta (GET /{media-id} → URL signée → octets), stockage dans `photos`,
// envoi d'un média à Meta (upload multipart → id). Limite 16 Mo.
import { nowIso } from './clock.js';
import { newId } from './db.js';

export const GRAPH_VERSION = 'v21.0';
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
export const MEDIA_MAX = 16 * 1024 * 1024;
export const PHOTO_MAX = 600 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SAFE_TYPES = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|3gpp)|audio\/(ogg|mpeg|mp4|aac|amr|opus|wav)|application\/pdf|text\/plain|application\/(vnd\.openxmlformats-officedocument\.[a-z.]+|msword|vnd\.ms-excel|vnd\.ms-powerpoint))(;.*)?$/i;

export function safeMime(m) {
  const s = String(m || '').toLowerCase().split(';')[0].trim();
  return SAFE_TYPES.test(s) ? s : 'application/octet-stream';
}

function auth() {
  return { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` };
}

/** Buffer depuis un champ Binary/Buffer/Uint8Array stocké. */
export function toBuffer(data) {
  if (!data) return null;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (data._bsontype === 'Binary') {
    const b = data.buffer;
    return Buffer.from(b.buffer, b.byteOffset, typeof data.position === 'number' ? data.position : b.byteLength);
  }
  return null;
}

/** Télécharge un média Meta ; renvoie {buf, mime, sha256, size}. */
export async function fetchMetaMedia(mediaId, { timeoutMs = 8000 } = {}) {
  if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(String(mediaId))) throw new Error('media id invalide');
  const meta = await fetch(`${GRAPH_BASE}/${encodeURIComponent(mediaId)}`, { headers: auth(), signal: AbortSignal.timeout(timeoutMs) });
  const j = await meta.json().catch(() => ({}));
  if (!meta.ok || !j.url) throw new Error(`Meta média ${meta.status}`);
  if (typeof j.file_size === 'number' && j.file_size > MEDIA_MAX) throw new Error('média trop lourd');
  const r = await fetch(j.url, { headers: auth(), signal: AbortSignal.timeout(timeoutMs * 3) });
  if (!r.ok) throw new Error(`Meta média ${r.status}`);
  const ab = await r.arrayBuffer();
  if (ab.byteLength > MEDIA_MAX) throw new Error('média trop lourd');
  return { buf: Buffer.from(ab), mime: safeMime(j.mime_type || r.headers.get('content-type')), sha256: j.sha256 || '', size: ab.byteLength };
}

/** Stocke des octets dans `photos` ; renvoie l'id. */
export async function storeBlob(db, { buf, mime, by, filename, mediaId, sha256 }) {
  const { Binary } = await import('mongodb');
  const id = newId('p');
  const doc = { _id: id, type: mime, size: buf.length, data: new Binary(buf), at: nowIso(), by };
  if (filename) doc.filename = String(filename).slice(0, 160);
  if (mediaId) doc.mediaId = String(mediaId);
  if (sha256) doc.sha256 = String(sha256);
  await db.collection('photos').insertOne(doc);
  return id;
}

/** Télécharge le média d'un message entrant et le range dans `photos` ; pose `media.photoId` sur le message. Idempotent. */
export async function downloadInboundMedia(db, messageId) {
  const msgs = db.collection('messages');
  const m = await msgs.findOne({ _id: messageId });
  if (!m || !m.media || !m.media.id || m.media.photoId) return m && m.media && m.media.photoId ? { photoId: m.media.photoId, cached: true } : null;
  const existing = await db.collection('photos').findOne({ mediaId: m.media.id }, { projection: { _id: 1 } });
  let photoId = existing && existing._id;
  if (!photoId) {
    const { buf, mime, sha256 } = await fetchMetaMedia(m.media.id);
    photoId = await storeBlob(db, { buf, mime, by: 'whatsapp', filename: m.media.filename, mediaId: m.media.id, sha256 });
  }
  const at = nowIso();
  await msgs.updateOne({ _id: messageId }, { $set: { 'media.photoId': photoId, updatedAt: at, updatedBy: 'whatsapp' } });
  return { photoId, cached: Boolean(existing) };
}

/** Envoie un fichier à Meta (POST /{phone}/media, multipart) ; renvoie l'id de média. */
export async function uploadToMeta({ buf, mime, filename = 'fichier' }, { timeoutMs = 15000 } = {}) {
  const fd = new FormData();
  fd.append('messaging_product', 'whatsapp');
  fd.append('type', mime);
  fd.append('file', new Blob([buf], { type: mime }), filename);
  const r = await fetch(`${GRAPH_BASE}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`, { method: 'POST', headers: auth(), body: fd, signal: AbortSignal.timeout(timeoutMs) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) { const e = new Error((j.error && j.error.message) || `Meta upload ${r.status}`); e.graph = j.error; e.status = r.status; throw e; }
  return j.id;
}
