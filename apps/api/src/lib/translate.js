// Traduction avec cache Mongo (`translations`, clé = sha256(from+to+text)).
import { createHash } from 'node:crypto';
import { detectLang } from '@amane/shared';
import { nowIso } from './clock.js';
import { aiConfigured, translateText, AiError } from './ai.js';

export const cacheKey = (from, to, text) => createHash('sha256').update(`${from || ''}\n${to}\n${text}`).digest('hex');

/**
 * Traduit avec cache. Renvoie {text, from, cached}. Lève AiError('ia_off') sans clé.
 * Si la langue d'origine détectée est la cible, renvoie le texte tel quel (cached:false, from = to).
 */
export async function translateCached(db, { text, to, from, context = 'message', timeoutMs = 8000 }) {
  const clean = String(text || '').trim();
  const target = String(to || 'FR').toUpperCase();
  const src = from ? String(from).toUpperCase() : (detectLang(clean) || '');
  if (!clean) return { text: '', from: src, cached: false };
  if (src && src === target) return { text: clean, from: src, cached: false };
  const key = cacheKey(src, target, clean);
  const col = db.collection('translations');
  const hit = await col.findOne({ _id: key });
  if (hit && typeof hit.text === 'string') return { text: hit.text, from: hit.from || src, cached: true };
  if (!aiConfigured()) throw new AiError('ia_off', 'IA non configurée.');
  const r = await translateText({ text: clean, to: target, from: src || undefined, context, timeoutMs });
  await col.updateOne({ _id: key }, { $set: { text: r.text, from: r.from || src, to: target, at: nowIso(), context } }, { upsert: true }).catch(() => {});
  return { text: r.text, from: r.from || src, cached: false };
}
