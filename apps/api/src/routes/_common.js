// Outils communs aux routes Express.
import { Router } from 'express';
import { HttpError, sendJson, sendError } from '../lib/http.js';
import { getDb } from '../lib/db.js';
import { requireSession } from '../lib/auth.js';
import { requireOrigin } from '../lib/origin.js';

export { Router, HttpError, sendJson, getDb, requireSession, requireOrigin };

/** Handler async → erreurs transmises à Express. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Session requise, base prête. */
export async function auth(req) {
  const db = await getDb();
  const user = await requireSession(req, db);
  return { db, user };
}

/** Session, ou clé interne (X-Internal-Key = INTERNAL_KEY) pour les tâches de fond. */
export async function authOrInternal(req) {
  const db = await getDb();
  const key = req.headers['x-internal-key'];
  if (key && process.env.INTERNAL_KEY && String(key) === process.env.INTERNAL_KEY) return { db, user: { id: 'systeme', nom: 'Système', role: 'interne' } };
  const user = await requireSession(req, db);
  return { db, user };
}

export const query = (req) => {
  const out = {};
  for (const [k, v] of Object.entries(req.query || {})) out[k] = Array.isArray(v) ? String(v[0]) : typeof v === 'object' && v !== null ? '' : String(v);
  return out;
};

export function methodNotAllowed(allowed) {
  return new HttpError(405, 'methode', `Méthode non permise (attendu : ${allowed.join(', ')}).`);
}

/** Middleware d'erreur final. */
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (res.headersSent) { try { res.end(); } catch { /* ignoré */ } return; }
  if (err instanceof HttpError || (err && err.http && err.status)) return sendError(res, err.status, err.code, err.message);
  if (err && err.type === 'entity.too.large') return sendError(res, 413, 'trop_lourd', 'Contenu trop volumineux.');
  if (err && (err.status === 400 || err.statusCode === 400)) return sendError(res, 400, 'requete_invalide', 'Requête invalide.');
  console.error('[amane] erreur', err && err.name, err && err.message);
  sendError(res, 500, 'erreur_serveur', 'Une erreur est survenue. Réessayez dans un instant.');
}
