/* État d'interface : tiroir (fiche), palette, majordome, feuille « Plus », toasts, filtres. */
import { create } from 'zustand';

export type DrawerKind = 'mission' | 'client' | 'vehicule' | 'partenaire' | 'service';
export interface DrawerState { kind: DrawerKind; id: string | null; tab: string; preset?: Record<string, unknown> }
export interface Toast { id: number; text: string }
export interface Filters { mine: boolean; svc: string; q: string; week: number; todo: string; dview?: 'kanban' | 'liste'; pview?: 'liste' | 'grille'; lst?: string; pq?: string; pt?: string; fm?: number; from?: string; to?: string; todoAll?: boolean; cvq?: string; cvf?: string }

interface UI {
  drawer: DrawerState | null; openDrawer: (kind: DrawerKind, id?: string | null, tab?: string, preset?: Record<string, unknown>) => void; closeDrawer: () => void; setTab: (t: string) => void;
  pal: boolean; setPal: (v: boolean) => void;
  mj: boolean; mjText: string; setMj: (v: boolean, text?: string) => void;
  plus: boolean; setPlus: (v: boolean) => void;
  toasts: Toast[]; toast: (t: string) => void;
  filters: Filters; setFilter: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
  theme: 'auto' | 'light' | 'dark'; setTheme: (t: 'auto' | 'light' | 'dark') => void;
}
let tid = 0;
export const useUI = create<UI>((set, get) => ({
  drawer: null,
  openDrawer: (kind, id = null, tab = 'main', preset) => set({ drawer: { kind, id, tab, preset }, plus: false, pal: false }),
  closeDrawer: () => set({ drawer: null }),
  setTab: (tab) => { const d = get().drawer; if (d) set({ drawer: { ...d, tab } }); },
  pal: false, setPal: (v) => set({ pal: v }),
  mj: false, mjText: '', setMj: (v, text) => set({ mj: v, mjText: text ?? get().mjText }),
  plus: false, setPlus: (v) => set({ plus: v }),
  toasts: [],
  toast: (text) => { const id = ++tid; set({ toasts: [...get().toasts, { id, text }] }); setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2600); },
  filters: { mine: false, svc: '', q: '', week: 0, todo: '', fm: 0 },
  setFilter: (k, v) => set({ filters: { ...get().filters, [k]: v } }),
  theme: (() => { try { return (localStorage.getItem('amane.theme') as 'auto' | 'light' | 'dark') || 'auto'; } catch { return 'auto'; } })(),
  setTheme: (t) => { set({ theme: t }); try { localStorage.setItem('amane.theme', t); } catch { /* ignore */ } applyTheme(t); },
}));
export function applyTheme(t: 'auto' | 'light' | 'dark') { const r = document.documentElement; if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t); }
export const toast = (t: string) => useUI.getState().toast(t);
