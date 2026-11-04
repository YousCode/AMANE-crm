import { Platform } from 'react-native';
import { session, cookieFromHeader } from './session';

/*
 * Client HTTP du contrat docs/crm-serveur.md + docs/architecture-v2.md.
 * EXPO_PUBLIC_API_URL vide ou « mock » → couche de simulation (src/mocks) installée par le store.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
export const MOCK_MODE = !API_URL || API_URL === 'mock';
export const ROLE_CLIENT = String(process.env.EXPO_PUBLIC_ROLE_CLIENT || 'false') === 'true';

export class ApiError extends Error {
  status: number; code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}

const MSG: Record<string, string> = {
  non_connecte: 'Vous n’êtes plus connecté.',
  bad_pin: 'Code incorrect.',
  bad_code: 'Code d’installation incorrect.',
  no_pin: 'Aucun code n’a encore été créé pour cette personne.',
  trop_de_tentatives: 'Trop de tentatives. Patientez quinze minutes.',
  window_closed: 'Fenêtre de 24 h fermée : envoyez le modèle approuvé.',
  whatsapp_off: 'WhatsApp n’est pas encore relié au serveur.',
  ia_off: 'L’IA n’est pas activée sur le serveur.',
  transcribe_off: 'La transcription n’est pas activée sur le serveur.',
  trop_lourd: 'Fichier trop lourd.',
  offline: 'Hors ligne : l’action sera rejouée au retour du réseau.',
  erreur_serveur: 'Erreur du serveur. Réessayez dans un instant.',
};
export const messageFor = (code: string, fallback?: string) => MSG[code] || fallback || 'Une erreur est survenue.';

export async function api<T = any>(method: string, path: string, body?: unknown, opts: { raw?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (Platform.OS !== 'web') { const ck = await session.getCookie(); if (ck) headers.Cookie = ck; }
  let res: Response;
  try {
    res = await fetch(API_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'include' });
  } catch {
    throw new ApiError(0, 'offline', MSG.offline);
  }
  if (Platform.OS !== 'web') {
    const sc = res.headers.get('set-cookie');
    const ck = cookieFromHeader(sc);
    if (ck) await session.setCookie(ck);
  }
  if (opts.raw) return res as unknown as T;
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!res.ok) {
    const code = data.error || (res.status === 401 ? 'non_connecte' : res.status === 429 ? 'trop_de_tentatives' : 'erreur_serveur');
    throw new ApiError(res.status, code, data.message || messageFor(code));
  }
  return data as T;
}

/** URL d'un média/photo servi par l'API (avec le cookie sur l'appareil, via en-tête). */
export const mediaUrl = (id: string) => `${API_URL}/api/media/${encodeURIComponent(id)}`;
export const photoUrl = (id: string) => (/^(data:|https?:)/.test(id) ? id : `${API_URL}/api/photo?id=${encodeURIComponent(id)}`);
export async function authHeaders(): Promise<Record<string, string>> {
  if (Platform.OS === 'web') return {};
  const ck = await session.getCookie();
  return ck ? { Cookie: ck } : {};
}
