// Synchronisation incrémentale : fiches modifiées depuis `since` (moins 2 s de marge).
import { HttpError } from './http.js';
import { now } from './clock.js';
import { SYNCED } from './docs.js';
import { toApi } from './db.js';

export const SINCE_MARGIN_MS = 2000;
const MESSAGES_DAYS = 60;

export async function buildSync(db, sinceParam) {
  const t = now();
  const nowStr = new Date(t).toISOString();
  let since = null;
  if (sinceParam) {
    const ms = Date.parse(sinceParam);
    if (Number.isNaN(ms)) throw new HttpError(400, 'since_invalide', 'Paramètre « since » invalide (date ISO attendue).');
    since = new Date(ms - SINCE_MARGIN_MS).toISOString();
  }
  const changes = {};
  const deleted = {};
  await Promise.all(SYNCED.map(async (col) => {
    let filter = {};
    if (since) filter = { updatedAt: { $gt: since } };
    else if (col === 'messages') filter = { updatedAt: { $gt: new Date(t - MESSAGES_DAYS * 86400000).toISOString() } };
    const docs = await db.collection(col).find(filter, { sort: { updatedAt: 1 } }).toArray();
    changes[col] = [];
    deleted[col] = [];
    for (const d of docs) {
      if (d._deleted) deleted[col].push(d._id);
      else changes[col].push(toApi(d));
    }
  }));
  const cpt = await db.collection('meta').findOne({ _id: 'compteurs' });
  const compteurs = {};
  if (cpt) for (const [k, v] of Object.entries(cpt)) if (typeof v === 'number') compteurs[k] = v;
  return { now: nowStr, changes, deleted, compteurs };
}
