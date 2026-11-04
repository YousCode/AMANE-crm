// POST /api/photo {dataUrl} → {id, url} ; GET /api/photo?id= → l'image ; GET /api/media/:id → tout média stocké (session).
import { Router, wrap, sendJson, HttpError, auth, requireOrigin, query, methodNotAllowed } from './_common.js';
import { readJson, ID_RE } from '../lib/http.js';
import { nowIso } from '../lib/clock.js';
import { toBuffer, PHOTO_MAX, IMAGE_TYPES, safeMime } from '../lib/media.js';
import { storeBlob } from '../lib/media.js';

function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export const router = Router();

router.all('/api/photo', wrap(async (req, res) => {
  if (req.method === 'POST') return upload(req, res);
  if (req.method === 'GET' || req.method === 'HEAD') return serve(req, res, query(req).id || '', { imagesOnly: true });
  throw methodNotAllowed(['GET', 'POST']);
}));
router.get('/api/media/:id', wrap((req, res) => serve(req, res, req.params.id, { imagesOnly: false, download: query(req).download === '1' })));
router.head('/api/media/:id', wrap((req, res) => serve(req, res, req.params.id, { imagesOnly: false })));

async function upload(req, res) {
  requireOrigin(req);
  const { db, user } = await auth(req);
  const { dataUrl, filename } = await readJson(req, Math.ceil(PHOTO_MAX * 4 / 3) + 4096);
  const m = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(typeof dataUrl === 'string' ? dataUrl : '');
  if (!m) throw new HttpError(400, 'image_invalide', 'Image attendue (JPEG, PNG ou WebP en data URL).');
  const buf = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
  if (!buf.length) throw new HttpError(400, 'image_invalide', 'Image vide.');
  if (buf.length > PHOTO_MAX) throw new HttpError(413, 'trop_lourd', 'Photo trop lourde (600 Ko maximum).');
  const type = sniff(buf);
  if (!type || !IMAGE_TYPES.includes(type)) throw new HttpError(400, 'image_invalide', 'Format d’image non reconnu (JPEG, PNG ou WebP).');
  const id = await storeBlob(db, { buf, mime: type, by: user.id, filename: typeof filename === 'string' ? filename : '' });
  void nowIso;
  sendJson(res, 200, { id, url: `/api/photo?id=${id}` });
}

async function serve(req, res, id, { imagesOnly, download }) {
  const { db } = await auth(req);
  if (!ID_RE.test(id)) throw new HttpError(400, 'id_invalide', 'Identifiant invalide.');
  const p = await db.collection('photos').findOne({ _id: id });
  const buf = p && toBuffer(p.data);
  if (!buf) throw new HttpError(404, 'introuvable', imagesOnly ? 'Photo introuvable.' : 'Média introuvable.');
  const type = imagesOnly ? (IMAGE_TYPES.includes(p.type) ? p.type : 'application/octet-stream') : safeMime(p.type);
  res.statusCode = 200;
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Length', String(buf.length));
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!imagesOnly) res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  if (download || type === 'application/octet-stream') res.setHeader('Content-Disposition', `attachment; filename="${String(p.filename || id).replace(/[^\w.\-]+/g, '_')}"`);
  res.end(req.method === 'HEAD' ? undefined : buf);
}
