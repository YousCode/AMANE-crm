/* Store principal : données synchronisées (/api/sync + WebSocket), écritures optimistes, file hors ligne (IndexedDB). */
import { create } from 'zustand';
import { api, setAuthLostHandler, type ApiError } from '../lib/api';
import { queue, cache, type QueuedOp } from '../lib/queue';
import { nowISO, uid } from '../lib/format';
import type { Client, Mission, Vehicule, Service, Partenaire, Reglages, Conversation, Message, Activity, User } from '../shared';
import { toast } from './ui';

export type Col = 'clients' | 'missions' | 'vehicules' | 'services' | 'partenaires' | 'reglages' | 'conversations' | 'messages';
export const COLS: Col[] = ['clients', 'missions', 'vehicules', 'services', 'partenaires', 'reglages', 'conversations', 'messages'];
export interface Health { ok?: boolean; db?: boolean; auth?: boolean; whatsapp?: boolean; ia?: boolean; version?: string }
export interface Doc { id: string; updatedAt?: string; _deleted?: boolean; [k: string]: unknown }

export interface State {
  clients: Client[]; missions: Mission[]; vehicules: Vehicule[]; services: Service[]; partenaires: Partenaire[]; reglages: Reglages[]; conversations: Conversation[]; messages: Message[];
  user: User | null; auth: 'boot' | 'login' | 'in';
  since: string; ready: boolean; offline: boolean; syncing: boolean; pending: number; wsOn: boolean; lastSync: number;
  health: Health | null; feed: Activity[] | null; compteurs: Record<string, number>;
  boot: () => Promise<void>;
  login: (userId: string, pin: string) => Promise<User>;
  setup: (code: string, userId: string, pin: string) => Promise<User>;
  logout: () => Promise<void>;
  sync: () => Promise<void>;
  put: (col: Col, doc: Record<string, unknown> & { id?: string }) => Promise<string>;
  del: (col: Col, id: string) => Promise<void>;
  local: (col: Col, id: string, doc: Record<string, unknown> | null) => void;
  applyChange: (col: Col, doc: Doc) => void;
  applyDeleted: (col: Col, id: string) => void;
  counter: (key: string) => Promise<number>;
  loadFeed: () => Promise<void>;
  setWs: (on: boolean) => void;
}

const LS_USER = 'amane.web.user';
const seen: Record<string, string> = {}; // col/id → updatedAt confirmé par le serveur
let pendingKeys = new Set<string>();
let flushing = false, again = false, saveT: ReturnType<typeof setTimeout> | undefined;
const key = (col: string, id: string) => col + '/' + id;
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string | null) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } };

function upsert<T extends Doc>(arr: T[], doc: T): T[] { const i = arr.findIndex((x) => x.id === doc.id); if (i < 0) return [...arr, doc]; const n = arr.slice(); n[i] = doc; return n; }

export const useStore = create<State>((set, get) => {
  const snapshot = (now = false) => { clearTimeout(saveT); saveT = setTimeout(() => { const s = get(); const data: Record<string, unknown> = { since: s.since, compteurs: s.compteurs }; COLS.forEach((c) => { data[c] = c === 'messages' ? s.messages.slice(-600) : s[c]; }); cache.set('store', data).catch(() => { }); }, now ? 0 : 1200); };

  async function flush() {
    if (flushing) { again = true; return; } flushing = true;
    try {
      let ops = await queue.all();
      while (ops.length) {
        const q = ops[0];
        try {
          if (q.op === 'put') { const r = await api<{ id: string; updatedAt?: string }>('PUT', `/api/doc/${q.col}/${encodeURIComponent(q.id)}`, q.body); if (r.updatedAt) seen[key(q.col, q.id)] = r.updatedAt; }
          else await api('DELETE', `/api/doc/${q.col}/${encodeURIComponent(q.id)}`);
          await queue.remove(q.key); pendingKeys.delete(key(q.col, q.id)); ops = ops.slice(1); set({ pending: ops.length, offline: false });
        } catch (e) {
          const err = e as ApiError;
          if (err.code === 'offline' || !err.status || err.status >= 500 || err.status === 401 || err.status === 429 || err.status === 408) { if (err.code === 'offline') set({ offline: true }); break; }
          await queue.remove(q.key); pendingKeys.delete(key(q.col, q.id)); ops = ops.slice(1); set({ pending: ops.length });
          toast(err.message || (err.status === 413 ? 'Fiche trop volumineuse : modification non enregistrée.' : 'Modification refusée par le serveur.'));
        }
      }
    } finally { flushing = false; if (again) { again = false; setTimeout(flush, 20); } }
  }

  return {
    clients: [], missions: [], vehicules: [], services: [], partenaires: [], reglages: [], conversations: [], messages: [],
    user: null, auth: 'boot', since: '', ready: false, offline: false, syncing: false, pending: 0, wsOn: false, lastSync: 0, health: null, feed: null, compteurs: {},

    async boot() {
      setAuthLostHandler(() => { if (get().auth === 'in') set({ auth: 'login' }); });
      // Cache local (hors ligne) puis session.
      try { const c = await cache.get<Record<string, unknown>>('store'); if (c) { const patch: Partial<State> = { since: (c.since as string) || '', compteurs: (c.compteurs as Record<string, number>) || {} }; COLS.forEach((k) => { if (Array.isArray(c[k])) (patch as Record<string, unknown>)[k] = c[k]; }); set(patch); } } catch { /* ignore */ }
      const ops = await queue.all(); pendingKeys = new Set(ops.map((o) => key(o.col, o.id))); set({ pending: ops.length });
      // Rejoue les écritures en attente sur l'état local (elles priment sur le cache).
      ops.forEach((o) => { if (o.op === 'put' && o.body) get().local(o.col as Col, o.id, o.body); else if (o.op === 'del') get().local(o.col as Col, o.id, null); });
      try {
        const r = await api<{ user: User }>('GET', '/api/auth/me', undefined, { auth: true });
        if (r.user && r.user.id) { set({ user: r.user, auth: 'in' }); lsSet(LS_USER, JSON.stringify(r.user)); await get().sync(); get().loadFeed(); api<Health>('GET', '/api/health').then((h) => set({ health: h })).catch(() => { }); return; }
        set({ auth: 'login' });
      } catch (e) {
        const err = e as ApiError;
        if (err.status === 401) { set({ auth: 'login' }); return; }
        // Serveur injoignable : on garde la session mémorisée pour travailler hors ligne.
        const u = lsGet(LS_USER); if (u) { try { set({ user: JSON.parse(u), auth: 'in', offline: true, ready: get().missions.length > 0 }); return; } catch { /* ignore */ } }
        set({ auth: 'login', offline: true });
      }
    },
    async login(userId, pin) {
      const r = await api<{ user: User }>('POST', '/api/auth/login', { userId, pin }, { auth: true });
      const user = r.user || { id: userId, nom: userId, role: '' }; set({ user, auth: 'in' }); lsSet(LS_USER, JSON.stringify(user));
      get().sync().then(() => get().loadFeed()); api<Health>('GET', '/api/health').then((h) => set({ health: h })).catch(() => { });
      return user;
    },
    async setup(code, userId, pin) { await api('POST', '/api/auth/setup', { code, userId, pin }, { auth: true }); return get().login(userId, pin); },
    async logout() {
      try { await api('POST', '/api/auth/logout', {}, { auth: true }); } catch { /* ignore */ }
      await queue.clear(); await cache.clear(); lsSet(LS_USER, null); pendingKeys = new Set();
      set({ user: null, auth: 'login', since: '', ready: false, pending: 0, clients: [], missions: [], vehicules: [], services: [], partenaires: [], reglages: [], conversations: [], messages: [], feed: null });
    },
    async sync() {
      if (get().auth !== 'in') return; if (get().syncing) { again = true; return; }
      set({ syncing: true });
      try {
        await flush();
        const since = get().since;
        const j = await api<{ now: string; changes: Record<string, Doc[]>; deleted: Record<string, string[]>; compteurs?: Record<string, number> }>('GET', '/api/sync' + (since ? '?since=' + encodeURIComponent(since) : ''));
        const s = get(); const first = !s.ready; const patch: Partial<State> = {};
        const cur: Record<string, Doc[]> = {}; COLS.forEach((c) => { cur[c] = s[c] as Doc[]; });
        Object.entries(j.changes || {}).forEach(([c, arr]) => {
          if (!COLS.includes(c as Col)) return;
          (arr || []).forEach((d) => {
            if (!d || !d.id || pendingKeys.has(key(c, d.id))) return;
            const k = key(c, d.id); if (seen[k] && d.updatedAt && String(d.updatedAt) < seen[k]) return;
            if (d._deleted) cur[c] = cur[c].filter((x) => x.id !== d.id); else cur[c] = upsert(cur[c], d);
          });
        });
        Object.entries(j.deleted || {}).forEach(([c, ids]) => { if (!COLS.includes(c as Col)) return; (ids || []).forEach((id) => { if (!pendingKeys.has(key(c, id))) cur[c] = cur[c].filter((x) => x.id !== id); }); });
        COLS.forEach((c) => { (patch as Record<string, unknown>)[c] = cur[c]; });
        if (j.compteurs) patch.compteurs = { ...s.compteurs, ...j.compteurs };
        if (j.now) patch.since = j.now; patch.ready = true; patch.offline = false; patch.lastSync = Date.now();
        set(patch); snapshot(first);
      } catch (e) {
        const err = e as ApiError; if (err.code === 'offline') set({ offline: true }); else if (err.status >= 500) set({ offline: false });
      } finally { set({ syncing: false }); if (again) { again = false; setTimeout(() => get().sync(), 30); } }
    },
    async put(col, doc) {
      const id = doc.id || uid(); const body: Record<string, unknown> = { ...doc }; delete body.id;
      body.updatedAt = nowISO(); if (!body.createdAt) body.createdAt = body.updatedAt;
      get().local(col, id, body);
      const k = key(col, id); pendingKeys.add(k);
      await queue.put({ key: k, op: 'put', col, id, body, t: Date.now() } as QueuedOp);
      set({ pending: (await queue.all()).length }); snapshot(); flush();
      return id;
    },
    async del(col, id) {
      get().local(col, id, null); const k = key(col, id); pendingKeys.add(k);
      await queue.put({ key: k, op: 'del', col, id, t: Date.now() }); set({ pending: (await queue.all()).length }); snapshot(); flush();
    },
    local(col, id, doc) {
      const arr = get()[col] as Doc[];
      set({ [col]: doc ? upsert(arr, { ...doc, id } as Doc) : arr.filter((x) => x.id !== id) } as Partial<State>);
    },
    applyChange(col, doc) { if (!doc || !doc.id || pendingKeys.has(key(col, doc.id))) return; if (doc._deleted) get().applyDeleted(col, doc.id); else { get().local(col, doc.id, doc); snapshot(); } },
    applyDeleted(col, id) { if (pendingKeys.has(key(col, id))) return; get().local(col, id, null); snapshot(); },
    async counter(k) { const r = await api<{ n: number }>('POST', '/api/counter', { key: k }); const n = +r.n; if (!n) throw { code: 'resource_exhausted', status: 500, message: 'Numérotation impossible' }; set({ compteurs: { ...get().compteurs, [k]: n } }); return n; },
    async loadFeed() { try { const r = await api<{ items: Activity[] }>('GET', '/api/activity?limit=20'); set({ feed: r.items || [] }); } catch { if (!get().feed) set({ feed: [] }); } },
    setWs(on) { set({ wsOn: on }); },
  };
});

/* Sélecteurs utilitaires */
export const byId = <T extends { id: string }>(arr: T[], id?: string | null): T | undefined => (id ? arr.find((x) => x.id === id) : undefined);
export const clientOf = (m: Pick<Mission, 'clientId'>, clients: Client[]) => byId(clients, m.clientId);
export const unreadTotal = (convs: Conversation[]) => convs.reduce((s, c) => s + (+(c.unread || 0)), 0);
