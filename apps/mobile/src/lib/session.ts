import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/*
 * Session : le cookie `amane_s` (httpOnly côté serveur) est conservé dans expo-secure-store sur l'appareil
 * et renvoyé en en-tête `Cookie`. Sur le web, le navigateur gère le cookie lui-même (credentials:'include'),
 * on ne garde que l'utilisateur connecté.
 */
const KEY_COOKIE = 'amane.cookie';
const KEY_USER = 'amane.user';

const mem: Record<string, string> = {};
function webGet(k: string): string | null {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : mem[k] ?? null; } catch { return mem[k] ?? null; }
}
function webSet(k: string, v: string | null) {
  mem[k] = v ?? '';
  try { if (typeof localStorage !== 'undefined') { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } } catch { /* privé */ }
}

async function get(k: string): Promise<string | null> {
  if (Platform.OS === 'web') return webGet(k);
  try { return await SecureStore.getItemAsync(k); } catch { return mem[k] ?? null; }
}
async function set(k: string, v: string | null): Promise<void> {
  if (Platform.OS === 'web') return webSet(k, v);
  try { if (v == null) await SecureStore.deleteItemAsync(k); else await SecureStore.setItemAsync(k, v); } catch { if (v == null) delete mem[k]; else mem[k] = v; }
}

export const session = {
  getCookie: () => get(KEY_COOKIE),
  setCookie: (v: string | null) => set(KEY_COOKIE, v),
  getUser: async () => { const s = await get(KEY_USER); try { return s ? (JSON.parse(s) as { id: string; nom: string; role: string }) : null; } catch { return null; } },
  setUser: (u: { id: string; nom: string; role: string } | null) => set(KEY_USER, u ? JSON.stringify(u) : null),
  clear: async () => { await set(KEY_COOKIE, null); await set(KEY_USER, null); },
};

/** Extrait `amane_s=…` d'un en-tête Set-Cookie. */
export function cookieFromHeader(h: string | null | undefined): string | null {
  if (!h) return null;
  const m = /amane_s=([^;,\s]+)/.exec(h);
  return m ? `amane_s=${m[1]}` : null;
}
