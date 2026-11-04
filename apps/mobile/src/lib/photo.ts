import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { api } from './api';

/*
 * Photo (appareil ou galerie) → redimensionnée à 1600 px et compressée en JPEG (≤ 600 Ko attendus par /api/photo)
 * → POST /api/photo {dataUrl} → {id, url}.
 */
export type Picked = { uri: string; width: number; height: number; base64?: string | null };

export async function pickPhoto(source: 'camera' | 'library'): Promise<Picked | null> {
  if (source === 'camera') {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) return null;
  } else {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted && Platform.OS !== 'web') return null;
  }
  const r = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, base64: Platform.OS === 'web' })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, base64: Platform.OS === 'web', allowsMultipleSelection: false });
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  return { uri: a.uri, width: a.width, height: a.height, base64: a.base64 };
}

/** Compresse jusqu'à passer sous `maxBytes` (qualité décroissante). Renvoie un data URL JPEG. */
export async function compressToDataUrl(p: Picked, maxBytes = 600 * 1024): Promise<string> {
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(p.width || maxSide, p.height || maxSide));
  for (const q of [0.82, 0.7, 0.58, 0.46, 0.34]) {
    const ctx = ImageManipulator.manipulate(p.uri);
    if (scale < 1) ctx.resize({ width: Math.round((p.width || maxSide) * scale) });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ compress: q, format: SaveFormat.JPEG, base64: true });
    const b64 = out.base64 || '';
    if (b64.length * 0.75 <= maxBytes || q === 0.34) return 'data:image/jpeg;base64,' + b64;
  }
  return p.base64 ? 'data:image/jpeg;base64,' + p.base64 : p.uri;
}

export async function uploadPhoto(dataUrl: string): Promise<{ id: string; url: string }> {
  return api<{ id: string; url: string }>('POST', '/api/photo', { dataUrl });
}

/** Tout en un : choisir, compresser, envoyer. `null` si l'utilisateur annule. */
export async function takeAndUpload(source: 'camera' | 'library'): Promise<{ id: string; url: string; dataUrl: string } | null> {
  const p = await pickPhoto(source); if (!p) return null;
  const dataUrl = await compressToDataUrl(p);
  const r = await uploadPhoto(dataUrl);
  return { ...r, dataUrl };
}
