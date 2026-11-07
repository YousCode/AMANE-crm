// Accès à MongoDB Atlas : client mis en cache entre deux invocations (même conteneur),
// index et données de départ posés une fois par base. Les tests et le serveur de
// développement injectent une base en mémoire avec setDb(new FakeDb()).
import { randomBytes } from 'node:crypto';
import { nowIso, now as clockNow } from './clock.js';
import { seedIfEmpty } from './seed.js';
import { HttpError } from './http.js';

const SCHEMA_VERSION = 2;
const G = globalThis;
G.__amane = G.__amane || { injected: null, conn: null, prepared: new WeakMap() };
const state = G.__amane;

export function setDb(db) {
  state.injected = db;
  state.prepared = new WeakMap();
}

export function dbConfigured() {
  return Boolean(state.injected || (process.env.MONGODB_URI && process.env.MONGODB_DB));
}

async function connect() {
  const uri = process.env.MONGODB_URI;
  const name = process.env.MONGODB_DB;
  if (!uri || !name) throw new HttpError(503, 'db_off', 'Base de données non configurée (MONGODB_URI, MONGODB_DB).');
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri, {
    appName: 'amane-api',
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  await client.connect();
  return client.db(name);
}

async function rawDb() {
  if (state.injected) return state.injected;
  if (!state.conn) {
    state.conn = connect().catch((e) => {
      state.conn = null;
      throw e;
    });
  }
  return state.conn;
}

/** Base prête (index + flotte de départ). */
export async function getDb() {
  const db = await rawDb();
  let p = state.prepared.get(db);
  if (!p) {
    p = prepare(db).catch((e) => {
      state.prepared.delete(db);
      throw e;
    });
    state.prepared.set(db, p);
  }
  await p;
  return db;
}

async function prepare(db) {
  const meta = db.collection('meta');
  const schema = await meta.findOne({ _id: 'schema' });
  if (schema && schema.version >= SCHEMA_VERSION && schema.seeded) return;
  if (schema && schema.seeded && schema.version < SCHEMA_VERSION) {
    // Migration 1 → 2 : index supplémentaires et modèles WhatsApp par défaut ; aucune donnée modifiée.
  }
  const idx = [
    ['ratelimits', { expireAt: 1 }, { expireAfterSeconds: 0 }],
    ['clients', { telNorm: 1 }],
    ['clients', { email: 1 }],
    ['clients', { updatedAt: 1 }],
    ['missions', { clientId: 1, statut: 1 }],
    ['missions', { updatedAt: 1 }],
    ['vehicules', { updatedAt: 1 }],
    ['services', { updatedAt: 1 }],
    ['partenaires', { updatedAt: 1 }],
    ['reglages', { updatedAt: 1 }],
    ['conversations', { updatedAt: 1 }],
    ['messages', { updatedAt: 1 }],
    ['messages', { convId: 1, at: -1 }],
    ['activity', { at: -1 }],
    ['activity', { docId: 1, at: -1 }],
    ['translations', { at: 1 }],
    ['rappels', { missionId: 1, type: 1 }],
    ['rappels', { updatedAt: 1 }],
    ['push_tokens', { userId: 1 }],
    ['missions', { espaceToken: 1 }],
    ['missions', { 'devis.shareToken': 1 }],
    ['photos', { mediaId: 1 }],
    ['acces_prestataires', { token: 1 }, { unique: true }],
    ['confirmations', { partenaireId: 1 }],
    ['relances', { key: 1, n: -1 }],
    ['relances', { clientId: 1, at: -1 }],
    ['relances', { missionId: 1, at: -1 }],
    ['relances', { partenaireId: 1, at: -1 }],
  ];
  await Promise.all(idx.map(([c, k, o]) => db.collection(c).createIndex(k, o || {})));
  await seedIfEmpty(db, nowIso());
  await meta.updateOne(
    { _id: 'schema' },
    { $set: { version: SCHEMA_VERSION, seeded: true, updatedAt: nowIso() } },
    { upsert: true },
  );
}

/** Identifiant texte aléatoire, compatible avec ID_RE. */
export function newId(prefix = '') {
  return prefix + randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 10) + Date.now().toString(36).slice(-4);
}

/** Document stocké → forme exposée par l'API (`id`, jamais `_id`). */
export function toApi(doc) {
  if (!doc) return doc;
  const { _id, _deleted, ...rest } = doc;
  return { id: _id, ...rest };
}

export function isDuplicate(err) {
  return Boolean(err && (err.code === 11000 || err.code === 11001));
}

/**
 * Verrou court (collection `ratelimits`, expiré par TTL) pour sérialiser des créations
 * concurrentes, par exemple plusieurs messages WhatsApp d'un même numéro en rafale.
 */
export async function withLock(db, name, fn, { ttlMs = 15000, waitMs = 4000 } = {}) {
  const col = db.collection('ratelimits');
  const id = 'lock:' + name;
  const now = clockNow;
  const start = Date.now(); // attente mesurée en temps réel (l'horloge peut être figée en test)
  let owned = false;
  while (!owned) {
    const t = now();
    try {
      await col.insertOne({ _id: id, expireAt: new Date(t + ttlMs), resetAt: new Date(t + ttlMs), count: 0 });
      owned = true;
    } catch (e) {
      if (!isDuplicate(e)) throw e;
      const stolen = await col.findOneAndUpdate(
        { _id: id, expireAt: { $lt: new Date(t) } },
        { $set: { expireAt: new Date(t + ttlMs), resetAt: new Date(t + ttlMs) } },
        { returnDocument: 'after' },
      );
      if (stolen) owned = true;
      else if (Date.now() - start > waitMs) break; // on continue sans verrou plutôt que d'échouer
      else await new Promise((r) => setTimeout(r, 120 + Math.random() * 120));
    }
  }
  try {
    return await fn();
  } finally {
    if (owned) await col.deleteOne({ _id: id }).catch(() => {});
  }
}
