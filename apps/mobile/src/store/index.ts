import { create } from 'zustand';
import { Platform } from 'react-native';
import type { Client, Mission, Vehicule, Service, Partenaire, Conversation, Message, User } from '@amane/shared';
import { api, ApiError, MOCK_MODE, messageFor } from '@/lib/api';
import { session } from '@/lib/session';
import { storage } from '@/lib/storage';
import { connectWs, type WsEvent } from '@/lib/ws';
import { uid, nowISO } from '@/lib/format';

export type Data = {
  clients: Client[]; missions: Mission[]; vehicules: Vehicule[]; services: Service[]; partenaires: Partenaire[];
  reglages: any[]; conversations: Conversation[]; messages: Message[];
};
export const COLS = ['clients', 'missions', 'vehicules', 'services', 'partenaires', 'reglages', 'conversations', 'messages'] as const;
export type Col = (typeof COLS)[number];
const emptyData = (): Data => ({ clients: [], missions: [], vehicules: [], services: [], partenaires: [], reglages: [], conversations: [], messages: [] });

export type QueueOp = { id: string; method: 'PUT' | 'DELETE' | 'POST'; path: string; body?: unknown; at: string; label: string; /** id du message local à remplacer par celui du serveur une fois rejoué */ tmpMsg?: string };
export type SyncState = 'idle' | 'syncing' | 'online' | 'offline' | 'error';
export type Prefs = { theme: 'auto' | 'light' | 'dark'; haptics: boolean; roleClient: boolean };

type State = {
  booted: boolean; me: User | null; data: Data; since: string; sync: SyncState; pending: QueueOp[]; wsOn: boolean;
  health: any; toast: string | null; prefs: Prefs; lastSyncAt: string;
  boot(): Promise<void>;
  login(userId: string, pin: string): Promise<void>;
  setup(code: string, userId: string, pin: string): Promise<void>;
  logout(): Promise<void>;
  syncNow(full?: boolean): Promise<void>;
  applyEvent(e: WsEvent): void;
  upsert(col: Col, doc: any): void;
  dropDoc(col: Col, id: string): void;
  save(col: Col, doc: any, label?: string): Promise<void>;
  remove(col: Col, id: string, label?: string): Promise<void>;
  sendMessage(convId: string, payload: Record<string, unknown>, preview: { type: string; text: string }): Promise<string>;
  addNote(convId: string, text: string): Promise<void>;
  markRead(convId: string): Promise<void>;
  flush(): Promise<void>;
  setToast(msg: string | null): void;
  setPrefs(p: Partial<Prefs>): void;
  startLive(): void;
  stopLive(): void;
};

const K = { cache: 'amane.cache', since: 'amane.since', queue: 'amane.queue', prefs: 'amane.prefs' };
let stopWs: (() => void) | null = null; let timer: ReturnType<typeof setInterval> | null = null; let persistTimer: ReturnType<typeof setTimeout> | null = null;

function readJSON<T>(k: string, fallback: T): T { try { const s = storage.get(k); return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; } }

export const useStore = create<State>()((set, get) => {
  const persist = () => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => { const s = get(); storage.set(K.cache, JSON.stringify(s.data)); storage.set(K.since, s.since); storage.set(K.queue, JSON.stringify(s.pending)); }, 400);
  };
  const merge = (data: Data, col: Col, docs: any[], deleted: string[] = []): Data => {
    const cur = [...(data[col] as any[])]; const idx = new Map(cur.map((x, i) => [x.id, i]));
    for (const d of docs) { if (!d || !d.id) continue; const i = idx.get(d.id); if (i == null) { idx.set(d.id, cur.length); cur.push(d); } else cur[i] = d; }
    const del = new Set(deleted);
    return { ...data, [col]: del.size ? cur.filter((x) => !del.has(x.id)) : cur };
  };

  return {
    booted: false, me: null, data: emptyData(), since: '', sync: 'idle', pending: [], wsOn: false, health: null, toast: null,
    prefs: { theme: 'auto', haptics: true, roleClient: false }, lastSyncAt: '',

    async boot() {
      if (MOCK_MODE) { const { installMockFetch } = await import('@/mocks/server'); installMockFetch(); }
      const prefs = readJSON<Prefs>(K.prefs, get().prefs);
      const cache = readJSON<Data>(K.cache, emptyData()); const since = storage.get(K.since) || ''; const pending = readJSON<QueueOp[]>(K.queue, []);
      const me = (await session.getUser()) as User | null;
      set({ prefs: { ...get().prefs, ...prefs }, data: { ...emptyData(), ...cache }, since, pending, me, booted: true });
      if (me) {
        try { const r = await api<{ user: User }>('GET', '/api/auth/me'); set({ me: r.user }); await session.setUser(r.user); get().startLive(); }
        catch (e) { if (e instanceof ApiError && e.status === 401) { await session.clear(); set({ me: null }); } else { set({ sync: 'offline' }); get().startLive(); } }
      }
    },

    async login(userId, pin) {
      const r = await api<{ user: User }>('POST', '/api/auth/login', { userId, pin });
      await session.setUser(r.user); set({ me: r.user, since: '' });
      get().startLive();
    },
    async setup(code, userId, pin) { await api('POST', '/api/auth/setup', { code, userId, pin }); },
    async logout() {
      get().stopLive();
      try { await api('POST', '/api/auth/logout'); } catch { /* déjà déconnecté */ }
      await session.clear(); storage.set(K.cache, null); storage.set(K.since, null); storage.set(K.queue, null);
      set({ me: null, data: emptyData(), since: '', pending: [], sync: 'idle', wsOn: false });
    },

    async syncNow(full) {
      if (!get().me) return;
      set({ sync: 'syncing' });
      try {
        const since = full ? '' : get().since;
        const r = await api<{ now: string; changes: Partial<Record<Col, any[]>>; deleted: Partial<Record<Col, string[]>>; compteurs: any }>('GET', '/api/sync' + (since ? '?since=' + encodeURIComponent(since) : ''));
        let data = since ? get().data : emptyData();
        for (const col of COLS) data = merge(data, col, r.changes[col] || [], r.deleted?.[col] || []);
        set({ data, since: r.now, sync: 'online', lastSyncAt: nowISO() }); persist();
        if (get().pending.length) await get().flush();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) { await session.clear(); set({ me: null, sync: 'idle' }); get().stopLive(); return; }
        set({ sync: e instanceof ApiError && e.code === 'offline' ? 'offline' : 'error' });
      }
    },

    applyEvent(e) {
      const d = get().data;
      if (e.type === 'change' && (COLS as readonly string[]).includes(e.col)) set({ data: merge(d, e.col as Col, [e.doc]) });
      else if (e.type === 'deleted' && (COLS as readonly string[]).includes(e.col)) set({ data: merge(d, e.col as Col, [], [e.id]) });
      else if (e.type === 'message') set({ data: merge(d, 'messages', [e.message]) });
      else if (e.type === 'conversation') set({ data: merge(d, 'conversations', [e.conversation]) });
      persist();
    },
    upsert(col, doc) { set({ data: merge(get().data, col, [doc]) }); persist(); },
    dropDoc(col, id) { set({ data: merge(get().data, col, [], [id]) }); persist(); },

    async save(col, doc, label) {
      const id = doc.id || uid(); const now = nowISO();
      const local = { ...doc, id, updatedAt: now, updatedBy: get().me?.id, createdAt: doc.createdAt || now };
      get().upsert(col, local);
      const body = { ...doc }; delete body.id; delete body._id; delete body.updatedAt; delete body.updatedBy; delete body.createdAt; delete body.telNorm;
      await runOrQueue(get, set, { id: uid(), method: 'PUT', path: `/api/doc/${col}/${encodeURIComponent(id)}`, body, at: now, label: label || `Enregistrer ${col}` }, persist);
    },
    async remove(col, id, label) {
      get().dropDoc(col, id);
      await runOrQueue(get, set, { id: uid(), method: 'DELETE', path: `/api/doc/${col}/${encodeURIComponent(id)}`, at: nowISO(), label: label || `Supprimer ${col}` }, persist);
    },

    async sendMessage(convId, payload, preview) {
      const tmp = 'tmp_' + uid(); const at = nowISO(); const me = get().me?.id || 'amel';
      get().upsert('messages', { id: tmp, convId, dir: 'out', type: preview.type, text: preview.text, at, status: 'sending', by: me, ...(payload.media ? { media: { id: String((payload.media as any).photoId || (payload.media as any).url || ''), mime: (payload.media as any).type === 'document' ? 'application/pdf' : 'image/jpeg', filename: (payload.media as any).filename, caption: (payload.media as any).caption } } : {}), ...(payload.location ? { location: payload.location } : {}) });
      try {
        const r = await api<{ id: string }>('POST', '/api/whatsapp/send', { convId, ...payload });
        get().dropDoc('messages', tmp);
        get().upsert('messages', { id: r.id || tmp, convId, dir: 'out', type: preview.type, text: preview.text, at, status: 'envoye', by: me, ...(payload.media ? { media: { id: String((payload.media as any).photoId || (payload.media as any).url || ''), mime: (payload.media as any).type === 'document' ? 'application/pdf' : 'image/jpeg', filename: (payload.media as any).filename, caption: (payload.media as any).caption } } : {}), ...(payload.location ? { location: payload.location } : {}), ...(payload.template ? { template: payload.template } : {}) });
        const cv = get().data.conversations.find((c) => c.id === convId);
        if (cv) get().upsert('conversations', { ...cv, lastAt: at, lastText: preview.text, lastDir: 'out', unread: 0, lastOutAt: at });
        return r.id;
      } catch (e) {
        get().dropDoc('messages', tmp);
        if (e instanceof ApiError && e.code === 'offline') {
          // hors ligne : on garde le message en attente et on le rejoue au retour du réseau
          get().upsert('messages', { id: tmp, convId, dir: 'out', type: preview.type, text: preview.text, at, status: 'sending', by: me });
          set({ pending: [...get().pending, { id: uid(), method: 'POST', path: '/api/whatsapp/send', body: { convId, ...payload }, at, label: 'Message WhatsApp', tmpMsg: tmp }], sync: 'offline' }); persist();
          return tmp;
        }
        throw e;
      }
    },
    async addNote(convId, text) {
      const id = 'note_' + uid(); const at = nowISO(); const me = get().me?.id || 'amel';
      const local = { id, convId, dir: 'note' as const, type: 'note', text, at, status: 'recu' as const, by: me };
      get().upsert('messages', local);
      try {
        const r = await api<{ id: string; message?: Message }>('POST', '/api/whatsapp/note', { convId, text });
        get().dropDoc('messages', id); get().upsert('messages', r.message || { ...local, id: r.id || id });
        if (get().sync === 'offline') set({ sync: 'online' });
      } catch (e) {
        if (e instanceof ApiError && e.code === 'offline') { set({ pending: [...get().pending, { id: uid(), method: 'POST', path: '/api/whatsapp/note', body: { convId, text }, at, label: 'Note interne', tmpMsg: id }], sync: 'offline' }); persist(); return; }
        get().dropDoc('messages', id);
        if (e instanceof ApiError && e.status === 401) { await session.clear(); set({ me: null }); }
        throw e;
      }
    },
    async markRead(convId) {
      const cv = get().data.conversations.find((c) => c.id === convId);
      if (!cv || !cv.unread) return;
      get().upsert('conversations', { ...cv, unread: 0 });
      try { await api('POST', '/api/whatsapp/read', { convId }); } catch { /* non bloquant */ }
    },

    async flush() {
      const ops = [...get().pending]; if (!ops.length) return;
      for (const op of ops) {
        try {
          const r = await api<{ id?: string; message?: Message }>(op.method, op.path, op.body);
          set({ pending: get().pending.filter((x) => x.id !== op.id) });
          if (op.tmpMsg) {
            // le message local « en attente » prend l'identité donnée par le serveur (sinon la synchro le dupliquerait)
            const local = get().data.messages.find((x) => x.id === op.tmpMsg);
            get().dropDoc('messages', op.tmpMsg);
            if (local) get().upsert('messages', r.message || { ...local, id: r.id || op.tmpMsg, status: local.dir === 'note' ? 'recu' : 'envoye' });
          }
        }
        catch (e) {
          if (e instanceof ApiError && e.code === 'offline') { set({ sync: 'offline' }); persist(); return; }
          // erreur serveur (409, 404…) : on abandonne l'opération pour ne pas bloquer la file, et on prévient
          set({ pending: get().pending.filter((x) => x.id !== op.id), toast: `${op.label} : ${e instanceof ApiError ? e.message : messageFor('erreur_serveur')}` });
        }
      }
      persist(); if (get().sync === 'offline') set({ sync: 'online' });
    },
    setToast(msg) { set({ toast: msg }); },
    setPrefs(p) { const prefs = { ...get().prefs, ...p }; set({ prefs }); storage.set(K.prefs, JSON.stringify(prefs)); },

    startLive() {
      get().stopLive();
      void get().syncNow(!get().since);
      timer = setInterval(() => { if (get().sync === 'offline' || !get().wsOn) void get().syncNow(); if (get().pending.length) void get().flush(); }, MOCK_MODE ? 60000 : 15000);
      if (!MOCK_MODE) {
        stopWs = connectWs({
          onEvent: (e) => get().applyEvent(e),
          onOpen: () => { set({ wsOn: true, sync: 'online' }); void get().syncNow(); },
          onClose: () => set({ wsOn: false }),
        });
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.addEventListener('online', () => { void get().syncNow(); });
        window.addEventListener('offline', () => set({ sync: 'offline' }));
      }
    },
    stopLive() { if (stopWs) { stopWs(); stopWs = null; } if (timer) { clearInterval(timer); timer = null; } set({ wsOn: false }); },
  };
});

async function runOrQueue(get: () => State, set: (p: Partial<State>) => void, op: QueueOp, persist: () => void) {
  try { await api(op.method, op.path, op.body); if (get().sync === 'offline') set({ sync: 'online' }); }
  catch (e) {
    if (e instanceof ApiError && e.code === 'offline') { set({ pending: [...get().pending, op], sync: 'offline' }); persist(); return; }
    if (e instanceof ApiError && e.status === 401) { await session.clear(); set({ me: null }); }
    throw e;
  }
}

export const selectData = (s: State) => s.data;
export const selectMe = (s: State) => s.me;
