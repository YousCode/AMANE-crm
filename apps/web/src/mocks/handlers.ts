/* Handlers msw : un attrape-tout qui délègue au faux serveur en mémoire. */
import { http, HttpResponse } from 'msw';
import { handle, sim } from './fakeApi';

async function serve(req: Request): Promise<Response> {
  let body: unknown;
  if (req.method !== 'GET' && req.method !== 'HEAD') { try { body = await req.clone().json(); } catch { body = undefined; } }
  let r;
  try { r = handle(req.method, req.url, body, { cookie: req.headers.get('cookie') || '' }); }
  catch (e) { if ((e as Error).message === 'offline') return HttpResponse.error(); throw e; }
  if (r.html !== undefined) {
    if (r.headers && r.headers['x-dataurl']) { const b = await fetch(r.html).then((x) => x.blob()); return new HttpResponse(b, { status: 200, headers: { 'content-type': b.type || 'image/jpeg' } }); }
    return new HttpResponse(r.html, { status: r.status, headers: { 'content-type': 'text/html; charset=utf-8', ...(r.headers || {}) } });
  }
  return HttpResponse.json(r.body ?? {}, { status: r.status, headers: r.headers });
}
export const handlers = [
  http.all('*/api/*', ({ request }) => serve(request)),
  http.all('*/d/:token', ({ request }) => serve(request)),
  http.all('*/d/:token/accepter', ({ request }) => serve(request)),
];
export { sim };
