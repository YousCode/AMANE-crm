/* Client HTTP vers l'API Amane. `VITE_API_URL` pour un serveur distant ; sinon même origine (ou msw en développement). */
export interface ApiError { code: string; status: number; message: string }
export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';

let onAuthLost: (() => void) | null = null;
export function setAuthLostHandler(f: () => void) { onAuthLost = f; }

export async function api<T = Record<string, unknown>>(method: string, path: string, body?: unknown, o?: { auth?: boolean; signal?: AbortSignal }): Promise<T> {
  let r: Response;
  try {
    r = await fetch(API_BASE + path, {
      method, credentials: 'include', cache: 'no-store', signal: o?.signal,
      headers: body !== undefined ? { 'content-type': 'application/json', accept: 'application/json' } : { accept: 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw { code: 'offline', status: 0, message: 'Hors ligne' } as ApiError;
  }
  let j: Record<string, unknown> | null = null;
  try { j = await r.json(); } catch { /* corps vide */ }
  if (!r.ok) {
    const err: ApiError = { code: (j && (j.error as string)) || 'http_' + r.status, status: r.status, message: (j && (j.message as string)) || '' };
    if (r.status === 401 && !o?.auth && onAuthLost) onAuthLost();
    throw err;
  }
  return (j || {}) as T;
}
export const isOffline = (e: unknown) => !!e && (e as ApiError).code === 'offline';
export const photoURL = (id: string) => `${API_BASE}/api/photo?id=${encodeURIComponent(id)}`;
export const mediaURL = (id: string) => `${API_BASE}/api/media/${encodeURIComponent(id)}`;

/* Photos : réduites dans le navigateur (1600 px, JPEG 0,72) puis envoyées. */
function blobToDataURL(b: Blob): Promise<string> { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); }); }
async function shrink(b: Blob, max: number, q: number): Promise<Blob> {
  const bmp = await createImageBitmap(b); const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return (await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', q))) || b;
}
export async function uploadPhoto(file: Blob): Promise<{ id: string; url: string }> {
  let du = await blobToDataURL(file);
  for (const [mx, q] of [[1600, 0.72], [1280, 0.66], [1024, 0.6]] as const) {
    if (du.length <= 790000 && /^data:image\/(jpeg|png|webp)/.test(du)) break;
    try { du = await blobToDataURL(await shrink(file, mx, q)); } catch { break; }
  }
  if (du.length > 815000) throw { code: 'too_large', status: 413, message: 'Photo trop lourde.' } as ApiError;
  const r = await api<{ id: string; url?: string }>('POST', '/api/photo', { dataUrl: du });
  if (!r.id) throw { code: 'upload_failed', status: 500, message: 'Envoi impossible.' } as ApiError;
  return { id: r.id, url: r.url || photoURL(r.id) };
}
