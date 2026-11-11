/* Démo autonome (npm run build:demo) : tout le back-office dans une seule page, avec le faux serveur en mémoire de `mocks/fakeApi`
   branché directement sur `fetch` (pas de service worker, pas de réseau). Données fictives ; code PIN 1234. */
import '../styles/base.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../App';
import { handle, sim } from '../mocks/fakeApi';

const realFetch: typeof fetch | null = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
const pathOf = (url: string) => url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '');
const isApi = (p: string) => /^\/(app\/)?(api|d)\//.test(p);

async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const p = pathOf(url);
  if (!isApi(p)) { if (realFetch) return realFetch(input, init); throw new TypeError('réseau indisponible'); }
  const method = String(init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
  let body: unknown;
  if (method !== 'GET' && method !== 'HEAD' && typeof init?.body === 'string') { try { body = JSON.parse(init.body); } catch { body = undefined; } }
  let r;
  try { r = handle(method, 'http://amane.local' + p, body, { cookie: '' }); }
  catch (e) { if ((e as Error).message === 'offline') throw new TypeError('hors ligne'); throw e; }
  const empty = r.status === 204 || r.status === 304;
  if (r.html !== undefined) {
    if (r.headers && r.headers['x-dataurl'] && realFetch) { try { const b = await realFetch(r.html).then((x) => x.blob()); return new Response(b, { status: 200, headers: { 'content-type': b.type || 'image/jpeg' } }); } catch { return new Response(null, { status: 404 }); } }
    return new Response(empty ? null : r.html, { status: r.status, headers: { 'content-type': 'text/html; charset=utf-8', ...(r.headers || {}) } });
  }
  return new Response(empty ? null : JSON.stringify(r.body ?? {}), { status: r.status, headers: { 'content-type': 'application/json', ...(r.headers || {}) } });
}

window.__amaneMock = sim as unknown as Window['__amaneMock'];
window.fetch = demoFetch as typeof fetch;
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
