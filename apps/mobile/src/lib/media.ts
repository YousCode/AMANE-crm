import { Platform, Linking } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_URL, authHeaders, mediaUrl } from './api';

/*
 * Ouverture d'un média WhatsApp (PDF, image) servi par GET /api/media/:id (session).
 * Appareil : téléchargement avec le cookie dans le cache puis aperçu/partage natif.
 * Web : ouverture dans un nouvel onglet (le navigateur porte le cookie).
 */
export async function openMedia(id: string, filename?: string): Promise<boolean> {
  const url = mediaUrl(id);
  if (Platform.OS === 'web') {
    try { if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener'); else await Linking.openURL(url); return true; } catch { return false; }
  }
  try {
    const res = await fetch(url, { headers: await authHeaders() });
    if (!res.ok) return false;
    const buf = new Uint8Array(await res.arrayBuffer());
    const f = new File(Paths.cache, filename || `amane-${id}.${(res.headers.get('content-type') || '').includes('pdf') ? 'pdf' : 'bin'}`);
    if (f.exists) f.delete();
    f.write(buf);
    if (await File.canPreview(f)) { await File.preview(f); return true; }
    if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(f.uri); return true; }
    return Linking.openURL(f.uri).then(() => true, () => false);
  } catch {
    return false;
  }
}

/** Source audio d'un vocal pour expo-audio (en-tête Cookie sur l'appareil). */
export async function audioSource(id: string): Promise<{ uri: string; headers?: Record<string, string> }> {
  return { uri: mediaUrl(id), headers: await authHeaders() };
}

export const absolute = (u: string) => (/^(https?:|data:)/.test(u) ? u : API_URL + u);
