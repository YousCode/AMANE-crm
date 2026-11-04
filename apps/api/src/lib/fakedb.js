// Base MongoDB en mémoire, pour les tests et le serveur de développement (FAKE_DB=1).
// N'implémente QUE le sous-ensemble du pilote utilisé par lib/ et api/ :
//   collection(name)
//   find(filter, {sort, limit, projection}) → curseur (.sort .limit .project .toArray)
//   findOne(filter, {projection})
//   insertOne(doc)                    — _id en double → erreur code 11000
//   updateOne(filter, update, {upsert})
//   findOneAndUpdate(filter, update, {upsert, returnDocument, projection}) → document ou null (pilote v6)
//   deleteOne(filter), countDocuments(filter), createIndex() (sans effet)
// Filtres : égalité (y compris valeur contenue dans un tableau), $gt $gte $lt $lte $in $nin $ne $exists $regex, $or/$and à la racine.
// Mises à jour : $set $unset $inc $setOnInsert $push $addToSet $pull $max $min (chemins pointés acceptés).
// Aussi : insertMany, updateMany, deleteMany, estimatedDocumentCount, distinct.
// Les opérations sont atomiques (aucune attente entre lecture et écriture).

import { randomBytes } from 'node:crypto';

export class FakeDb {
  constructor() {
    this.collections = new Map();
    this.databaseName = 'amane-fake';
  }

  collection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new FakeCollection(name));
    return this.collections.get(name);
  }

  /** Accès direct pour les tests (copie). */
  dump(name) {
    return [...this.collection(name).docs.values()].map(clone);
  }
}

class DuplicateKeyError extends Error {
  constructor(coll, id) {
    super(`E11000 duplicate key error collection: ${coll} index: _id_ dup key: { _id: ${JSON.stringify(id)} }`);
    this.name = 'MongoServerError';
    this.code = 11000;
  }
}

class FakeCollection {
  constructor(name) {
    this.collectionName = name;
    this.docs = new Map(); // clé : _id sérialisé
  }

  async createIndex() {
    return 'fake_index';
  }

  find(filter = {}, options = {}) {
    return new FakeCursor(this, filter, options);
  }

  _query(filter, { sort, limit, skip, projection } = {}) {
    let out = [...this.docs.values()].filter((d) => matches(d, filter));
    if (sort) out.sort(sorter(sort));
    if (skip) out = out.slice(skip);
    if (limit && limit > 0) out = out.slice(0, limit);
    return out.map((d) => project(clone(d), projection));
  }

  async findOne(filter = {}, options = {}) {
    const r = this._query(filter, { ...options, limit: 1 });
    return r[0] || null;
  }

  async countDocuments(filter = {}) {
    let n = 0;
    for (const d of this.docs.values()) if (matches(d, filter)) n++;
    return n;
  }

  async insertOne(doc) {
    const d = clone(doc);
    if (d._id === undefined) d._id = randomBytes(12).toString('hex');
    const k = key(d._id);
    if (this.docs.has(k)) throw new DuplicateKeyError(this.collectionName, d._id);
    this.docs.set(k, d);
    return { acknowledged: true, insertedId: d._id };
  }

  _first(filter, sort) {
    for (const d of sort ? [...this.docs.values()].sort(sorter(sort)) : this.docs.values()) {
      if (matches(d, filter)) return d;
    }
    return null;
  }

  _upsertDoc(filter, update) {
    const d = {};
    for (const [k, v] of Object.entries(filter || {})) {
      if (k.startsWith('$')) continue;
      if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && Object.keys(v).some((x) => x.startsWith('$'))) continue;
      setPath(d, k, clone(v));
    }
    applyUpdate(d, update, true);
    if (d._id === undefined) d._id = randomBytes(12).toString('hex');
    const k = key(d._id);
    if (this.docs.has(k)) throw new DuplicateKeyError(this.collectionName, d._id);
    this.docs.set(k, d);
    return d;
  }

  async updateOne(filter, update, options = {}) {
    checkUpdate(update);
    const d = this._first(filter);
    if (d) {
      const before = JSON.stringify(d);
      applyUpdate(d, update, false);
      return { acknowledged: true, matchedCount: 1, modifiedCount: before === JSON.stringify(d) ? 0 : 1, upsertedCount: 0, upsertedId: null };
    }
    if (options.upsert) {
      const nd = this._upsertDoc(filter, update);
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: nd._id };
    }
    return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0, upsertedId: null };
  }

  async findOneAndUpdate(filter, update, options = {}) {
    checkUpdate(update);
    const after = options.returnDocument === 'after';
    let d = this._first(filter, options.sort);
    if (d) {
      const before = clone(d);
      applyUpdate(d, update, false);
      return project(clone(after ? d : before), options.projection);
    }
    if (options.upsert) {
      d = this._upsertDoc(filter, update);
      return after ? project(clone(d), options.projection) : null;
    }
    return null;
  }

  async deleteOne(filter) {
    for (const [k, d] of this.docs) {
      if (matches(d, filter)) {
        this.docs.delete(k);
        return { acknowledged: true, deletedCount: 1 };
      }
    }
    return { acknowledged: true, deletedCount: 0 };
  }

  async deleteMany(filter = {}) {
    let n = 0;
    for (const [k, d] of [...this.docs]) if (matches(d, filter)) { this.docs.delete(k); n++; }
    return { acknowledged: true, deletedCount: n };
  }

  async insertMany(docs) {
    const ids = [];
    for (const d of docs) ids.push((await this.insertOne(d)).insertedId);
    return { acknowledged: true, insertedCount: ids.length, insertedIds: ids };
  }

  async updateMany(filter, update, options = {}) {
    checkUpdate(update);
    let matched = 0; let modified = 0;
    for (const d of this.docs.values()) {
      if (!matches(d, filter)) continue;
      matched++;
      const before = JSON.stringify(d);
      applyUpdate(d, update, false);
      if (before !== JSON.stringify(d)) modified++;
    }
    if (!matched && options.upsert) { this._upsertDoc(filter, update); return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 }; }
    return { acknowledged: true, matchedCount: matched, modifiedCount: modified, upsertedCount: 0 };
  }

  async estimatedDocumentCount() { return this.docs.size; }

  async distinct(field, filter = {}) {
    const out = new Set();
    for (const d of this.docs.values()) if (matches(d, filter)) { const v = getPath(d, field); if (Array.isArray(v)) v.forEach((x) => out.add(x)); else if (v !== undefined) out.add(v); }
    return [...out];
  }
}

class FakeCursor {
  constructor(coll, filter, options) {
    this.coll = coll;
    this.filter = filter;
    this.options = { ...options };
  }
  sort(s) { this.options.sort = s; return this; }
  limit(n) { this.options.limit = n; return this; }
  skip(n) { this.options.skip = n; return this; }
  project(p) { this.options.projection = p; return this; }
  async toArray() { return this.coll._query(this.filter, this.options); }
}

// ---------- outils ----------

function key(id) {
  return typeof id === 'string' ? 's:' + id : 'j:' + JSON.stringify(id);
}

export function clone(v) {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof Date) return new Date(v.getTime());
  if (Buffer.isBuffer(v)) return Buffer.from(v);
  if (v instanceof Uint8Array) return new Uint8Array(v);
  if (v._bsontype) return v; // Binary, ObjectId… : immuables dans notre usage
  if (Array.isArray(v)) return v.map(clone);
  const o = {};
  for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = clone(x);
  return o;
}

function getPath(doc, path) {
  let cur = doc;
  for (const p of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function setPath(doc, path, value) {
  const parts = path.split('.');
  let cur = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function unsetPath(doc, path) {
  const parts = path.split('.');
  let cur = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur === null || typeof cur !== 'object') return;
    cur = cur[parts[i]];
  }
  if (cur && typeof cur === 'object') delete cur[parts[parts.length - 1]];
}

function typeRank(v) {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return 1;
  if (typeof v === 'string') return 2;
  if (v instanceof Date) return 5;
  if (typeof v === 'boolean') return 4;
  return 3;
}

function cmp(a, b) {
  const ra = typeRank(a), rb = typeRank(b);
  if (ra !== rb) return ra - rb;
  if (a instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' || typeof a === 'boolean') return Number(a) - Number(b);
  if (typeof a === 'string') return a < b ? -1 : a > b ? 1 : 0;
  return 0;
}

function eq(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a === null || a === undefined) return b === null || b === undefined;
  if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

function valueMatches(v, q) {
  if (Array.isArray(v) && !Array.isArray(q)) return v.some((x) => eq(x, q));
  return eq(v, q);
}

function comparable(v, q) {
  return v !== undefined && v !== null && typeRank(v) === typeRank(q);
}

function opMatches(v, ops) {
  for (const [op, q] of Object.entries(ops)) {
    switch (op) {
      case '$gt': if (!(comparable(v, q) && cmp(v, q) > 0)) return false; break;
      case '$gte': if (!(comparable(v, q) && cmp(v, q) >= 0)) return false; break;
      case '$lt': if (!(comparable(v, q) && cmp(v, q) < 0)) return false; break;
      case '$lte': if (!(comparable(v, q) && cmp(v, q) <= 0)) return false; break;
      case '$in': if (!q.some((x) => valueMatches(v, x))) return false; break;
      case '$nin': if (q.some((x) => valueMatches(v, x))) return false; break;
      case '$regex': { const re = q instanceof RegExp ? q : new RegExp(q, ops.$options || ''); if (typeof v !== 'string' || !re.test(v)) return false; break; }
      case '$options': break;
      case '$not': if (opMatches(v, q)) return false; break;
      case '$size': if (!Array.isArray(v) || v.length !== q) return false; break;
      case '$ne': if (valueMatches(v, q)) return false; break;
      case '$exists': if ((v !== undefined) !== Boolean(q)) return false; break;
      default: throw new Error(`FakeDb : opérateur non pris en charge ${op}`);
    }
  }
  return true;
}

export function matches(doc, filter) {
  for (const [k, q] of Object.entries(filter || {})) {
    if (k === '$or') { if (!Array.isArray(q) || !q.some((f) => matches(doc, f))) return false; continue; }
    if (k === '$and') { if (!Array.isArray(q) || !q.every((f) => matches(doc, f))) return false; continue; }
    if (k === '$nor') { if (!Array.isArray(q) || q.some((f) => matches(doc, f))) return false; continue; }
    if (k.startsWith('$')) throw new Error(`FakeDb : opérateur racine non pris en charge ${k}`);
    const v = getPath(doc, k);
    const isOps = q && typeof q === 'object' && !Array.isArray(q) && !(q instanceof Date) && Object.keys(q).length && Object.keys(q).every((x) => x.startsWith('$'));
    if (isOps ? !opMatches(v, q) : !valueMatches(v, q)) return false;
  }
  return true;
}

function sorter(sort) {
  const entries = Object.entries(sort);
  return (a, b) => {
    for (const [k, dir] of entries) {
      const c = cmp(getPath(a, k), getPath(b, k));
      if (c) return dir < 0 ? -c : c;
    }
    return 0;
  };
}

function project(doc, projection) {
  if (!doc || !projection) return doc;
  const entries = Object.entries(projection);
  const incl = entries.filter(([k, v]) => v && k !== '_id');
  if (incl.length) {
    const o = {};
    if (projection._id !== 0 && projection._id !== false) o._id = doc._id;
    for (const [k] of incl) if (doc[k] !== undefined) o[k] = doc[k];
    return o;
  }
  for (const [k, v] of entries) if (!v) delete doc[k];
  return doc;
}

const UPDATE_OPS = new Set(['$set', '$unset', '$inc', '$setOnInsert', '$push', '$addToSet', '$pull', '$max', '$min']);

function checkUpdate(update) {
  const ks = Object.keys(update || {});
  if (!ks.length || !ks.every((k) => k.startsWith('$'))) throw new Error('FakeDb : une mise à jour doit utiliser des opérateurs ($set…)');
  for (const k of ks) if (!UPDATE_OPS.has(k)) throw new Error(`FakeDb : opérateur de mise à jour non pris en charge ${k}`);
  // MongoDB refuse un même champ dans deux opérateurs.
  const seen = new Set();
  for (const k of ks) {
    for (const f of Object.keys(update[k])) {
      if (seen.has(f)) throw new Error(`FakeDb : conflit sur le champ ${f}`);
      seen.add(f);
    }
  }
}

function applyUpdate(doc, update, inserting) {
  if (update.$set) for (const [k, v] of Object.entries(update.$set)) setPath(doc, k, clone(v));
  if (update.$unset) for (const k of Object.keys(update.$unset)) unsetPath(doc, k);
  if (update.$inc) {
    for (const [k, v] of Object.entries(update.$inc)) {
      const cur = getPath(doc, k);
      if (cur !== undefined && typeof cur !== 'number') throw new Error(`FakeDb : $inc sur un champ non numérique ${k}`);
      setPath(doc, k, (cur || 0) + v);
    }
  }
  if (update.$push) {
    for (const [k, v] of Object.entries(update.$push)) {
      const cur = getPath(doc, k);
      const arr = Array.isArray(cur) ? cur : [];
      if (cur !== undefined && !Array.isArray(cur)) throw new Error(`FakeDb : $push sur un champ non tableau ${k}`);
      if (v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.$each)) { arr.push(...v.$each.map(clone)); if (typeof v.$slice === 'number') arr.splice(0, Math.max(0, arr.length - Math.abs(v.$slice))); } else arr.push(clone(v));
      setPath(doc, k, arr);
    }
  }
  if (update.$addToSet) {
    for (const [k, v] of Object.entries(update.$addToSet)) {
      const cur = getPath(doc, k);
      const arr = Array.isArray(cur) ? cur : [];
      const vals = v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.$each) ? v.$each : [v];
      for (const x of vals) if (!arr.some((y) => eq(y, x))) arr.push(clone(x));
      setPath(doc, k, arr);
    }
  }
  if (update.$pull) {
    for (const [k, v] of Object.entries(update.$pull)) {
      const cur = getPath(doc, k);
      if (!Array.isArray(cur)) continue;
      const isOps = v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length && Object.keys(v).every((x) => x.startsWith('$'));
      setPath(doc, k, cur.filter((x) => (isOps ? !opMatches(x, v) : v && typeof v === 'object' && !Array.isArray(v) ? !matches(x, v) : !eq(x, v))));
    }
  }
  if (update.$max) for (const [k, v] of Object.entries(update.$max)) { const cur = getPath(doc, k); if (cur === undefined || cmp(v, cur) > 0) setPath(doc, k, clone(v)); }
  if (update.$min) for (const [k, v] of Object.entries(update.$min)) { const cur = getPath(doc, k); if (cur === undefined || cmp(v, cur) < 0) setPath(doc, k, clone(v)); }
  if (inserting && update.$setOnInsert) for (const [k, v] of Object.entries(update.$setOnInsert)) setPath(doc, k, clone(v));
}
