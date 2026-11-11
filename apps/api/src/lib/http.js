// Petits outils HTTP communs aux fonctions Vercel et au serveur de développement.
// N'utilise que l'API Node standard (req/res de node:http), pas les aides Vercel.

export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sendJson(res, status, body, headers = {}) {
  if (res.writableEnded) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export function sendError(res, status, code, message) {
  sendJson(res, status, { error: code, message });
}

/** Enveloppe un handler : erreurs connues → JSON propre ; le reste → 500 sans pile. */
export function handler(fn) {
  return async function wrapped(req, res) {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        if (!res.headersSent) sendError(res, err.status, err.code, err.message);
        return;
      }
      console.error('[amane] erreur', err && err.name, err && err.message);
      if (!res.headersSent) sendError(res, 500, 'erreur_serveur', 'Une erreur est survenue. Réessayez dans un instant.');
      else if (!res.writableEnded) res.end();
    }
  };
}

export function methodNotAllowed(allowed) {
  return new HttpError(405, 'methode', `Méthode non permise (attendu : ${allowed.join(', ')}).`);
}

/**
 * Chemin + paramètres de la requête. Fusionne les paramètres de l'URL et ceux que Vercel
 * pose dans req.query après une réécriture (vercel.json → rewrites).
 */
export function parseUrl(req) {
  const u = new URL(req.url || '/', 'http://localhost');
  const query = {};
  if (req.query && typeof req.query === 'object') {
    for (const [k, v] of Object.entries(req.query)) query[k] = Array.isArray(v) ? String(v[0]) : String(v);
  }
  for (const [k, v] of u.searchParams) if (!(k in query)) query[k] = v;
  return { path: u.pathname.replace(/\/+$/, '') || '/', query };
}

/** Lit le corps brut (Buffer) avec une limite de taille. */
export async function readRaw(req, limit) {
  if (Buffer.isBuffer(req.rawBody)) {
    if (req.rawBody.length > limit) throw tooLarge();
    return req.rawBody;
  }
  const chunks = [];
  let size = 0;
  let over = false;
  if (!req.readableEnded && typeof req[Symbol.asyncIterator] === 'function') {
    for await (const chunk of req) {
      const b = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      size += b.length;
      if (size > limit) over = true;
      else chunks.push(b);
    }
  }
  if (over) throw tooLarge();
  if (size > 0) return Buffer.concat(chunks);
  // Le flux a déjà été lu par les aides Vercel : on reprend ce qu'elles ont gardé.
  let b;
  try { b = req.body; } catch { b = undefined; }
  if (Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') return Buffer.from(b);
  if (b && typeof b === 'object') return Buffer.from(JSON.stringify(b));
  return Buffer.alloc(0);
}

function tooLarge() {
  return new HttpError(413, 'trop_lourd', 'Contenu trop volumineux.');
}

/** Lit un corps JSON (objet attendu). */
export async function readJson(req, limit = 64 * 1024) {
  const raw = await readRaw(req, limit);
  if (!raw.length) return {};
  let data;
  try {
    data = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new HttpError(400, 'json_invalide', 'Corps de requête illisible (JSON attendu).');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpError(400, 'json_invalide', 'Un objet JSON est attendu.');
  }
  return data;
}

/**
 * Adresse du client telle que la voit le proxy de confiance (`trust proxy`, réglé dans app.js) : `X-Real-IP` et les
 * entrées de `X-Forwarded-For` ajoutées par le client lui-même ne comptent pas — sinon chaque limite de débit se contourne.
 */
export function clientIp(req) {
  return String(req.ip || (req.socket && req.socket.remoteAddress) || 'inconnue').slice(0, 64);
}

/**
 * Requêtes qui modifient : si le navigateur envoie Origin, elle doit être celle du site.
 * (Même origine seulement, aucun en-tête CORS n'est jamais renvoyé.)
 */
export function checkSameOrigin(req) {
  const origin = req.headers && req.headers.origin;
  if (!origin) return;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
  let oh = '';
  try { oh = new URL(origin).host.toLowerCase(); } catch { oh = ''; }
  if (!host || oh !== host) throw new HttpError(403, 'origine_refusee', 'Origine non autorisée.');
}

export function parseCookies(req) {
  const out = {};
  const raw = (req.headers && req.headers.cookie) || '';
  for (const part of String(raw).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k || k in out) continue;
    let v = part.slice(i + 1).trim();
    try { v = decodeURIComponent(v); } catch { /* valeur brute */ }
    out[k] = v;
  }
  return out;
}

export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}
