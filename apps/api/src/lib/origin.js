// Origines autorisées : même hôte, PUBLIC_URL, CORS_ORIGINS, et en développement les origines Expo/Vite locales.
import { HttpError } from './http.js';

const DEV_RE = /^(https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?|exp:\/\/.*|https?:\/\/.*\.exp\.direct(:\d+)?)$/i;

export function hostOf(req) {
  return String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
}

export function isDev() {
  return process.env.AMANE_DEV === '1' || process.env.FAKE_DB === '1';
}

/** L'origine de la requête est-elle acceptée ? (absente → oui) */
export function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  let o;
  try { o = new URL(origin); } catch { return false; }
  if (o.host.toLowerCase() === hostOf(req)) return true;
  const pub = process.env.PUBLIC_URL;
  if (pub) { try { if (new URL(pub).origin.toLowerCase() === o.origin.toLowerCase()) return true; } catch { /* ignoré */ } }
  const list = String(process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (list.includes(o.origin.toLowerCase())) return true;
  if (isDev() && DEV_RE.test(origin)) return true;
  return false;
}

/** Écritures : Origin présent → doit être acceptée. */
export function requireOrigin(req) {
  if (!originAllowed(req)) throw new HttpError(403, 'origine_refusee', 'Origine non autorisée.');
}

/** Même origine stricte (formulaire public du site) : aucun en-tête CORS. */
export function requireSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let oh = '';
  try { oh = new URL(origin).host.toLowerCase(); } catch { oh = ''; }
  const host = hostOf(req);
  if (!host || oh !== host) throw new HttpError(403, 'origine_refusee', 'Origine non autorisée.');
}

/** Middleware CORS : en-têtes seulement pour une origine acceptée différente de l'hôte. */
export function cors() {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && originAllowed(req)) {
      let same = false;
      try { same = new URL(origin).host.toLowerCase() === hostOf(req); } catch { same = false; }
      if (!same) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie, X-Internal-Key, X-Requested-With');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Max-Age', '600');
      }
    }
    if (req.method === 'OPTIONS') { res.statusCode = originAllowed(req) ? 204 : 403; return res.end(); }
    next();
  };
}
