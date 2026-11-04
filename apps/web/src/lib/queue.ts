/* File hors ligne dans IndexedDB (repli mémoire si IndexedDB est absent, par ex. en test). */
export interface QueuedOp { key: string; op: 'put' | 'del'; col: string; id: string; body?: Record<string, unknown>; t: number }
const DB = 'amane-web', STORE = 'queue', CACHE = 'cache';

let dbp: Promise<IDBDatabase | null> | null = null;
function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    if (typeof indexedDB === 'undefined') return res(null);
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => { const d = rq.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'key' }); if (!d.objectStoreNames.contains(CACHE)) d.createObjectStore(CACHE); };
      rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); rq.onblocked = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}
const mem: { queue: Map<string, QueuedOp>; cache: Map<string, unknown> } = { queue: new Map(), cache: new Map() };
function tx<T>(store: string, mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then((d) => new Promise<T | undefined>((res) => {
    if (!d) return res(undefined);
    try { const t = d.transaction(store, mode); const r = f(t.objectStore(store)); t.oncomplete = () => res(r ? (r as IDBRequest<T>).result : undefined); t.onerror = () => res(undefined); t.onabort = () => res(undefined); } catch { res(undefined); }
  }));
}
export const queue = {
  async all(): Promise<QueuedOp[]> {
    const d = await open(); if (!d) return [...mem.queue.values()].sort((a, b) => a.t - b.t);
    const r = await tx<QueuedOp[]>(STORE, 'readonly', (s) => s.getAll()); return (r || []).sort((a, b) => a.t - b.t);
  },
  async put(op: QueuedOp) { const d = await open(); if (!d) { mem.queue.set(op.key, op); return; } await tx(STORE, 'readwrite', (s) => { s.put(op); }); },
  async remove(key: string) { const d = await open(); if (!d) { mem.queue.delete(key); return; } await tx(STORE, 'readwrite', (s) => { s.delete(key); }); },
  async clear() { const d = await open(); if (!d) { mem.queue.clear(); return; } await tx(STORE, 'readwrite', (s) => { s.clear(); }); },
};
export const cache = {
  async get<T>(k: string): Promise<T | undefined> { const d = await open(); if (!d) return mem.cache.get(k) as T | undefined; return tx<T>(CACHE, 'readonly', (s) => s.get(k)); },
  async set(k: string, v: unknown) { const d = await open(); if (!d) { mem.cache.set(k, v); return; } await tx(CACHE, 'readwrite', (s) => { s.put(v, k); }); },
  async clear() { const d = await open(); if (!d) { mem.cache.clear(); return; } await tx(CACHE, 'readwrite', (s) => { s.clear(); }); },
};
