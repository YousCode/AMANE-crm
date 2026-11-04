/* Stockage hors ligne (web et tests) : localStorage, repli mémoire. Sur l'appareil, Metro prend storage.native.ts (expo-sqlite). */
const mem: Record<string, string> = {};
export const storage = {
  get(k: string): string | null {
    try { if (typeof localStorage !== 'undefined') return localStorage.getItem(k); } catch { /* privé */ }
    return mem[k] ?? null;
  },
  set(k: string, v: string | null): void {
    if (v == null) delete mem[k]; else mem[k] = v;
    try { if (typeof localStorage !== 'undefined') { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } } catch { /* quota */ }
  },
  clear(): void {
    for (const k of Object.keys(mem)) delete mem[k];
    try { if (typeof localStorage !== 'undefined') Object.keys(localStorage).filter((k) => k.startsWith('amane.')).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
  },
};
