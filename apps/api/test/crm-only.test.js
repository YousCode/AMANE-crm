// Mode « CRM seul » (CRM_ONLY=1) : le CRM à la racine, relié à l'API ; site vitrine non exposé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

test('CRM_ONLY=1 : / sert le CRM, /api fonctionne, le site n’est pas servi', async () => {
  const api = await createApp({ fake: true, crmOnly: true });
  const port = await api.listen(0);
  const base = `http://127.0.0.1:${port}`;
  try {
    const home = await fetch(base + '/');
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /<title>Amane CRM<\/title>/);
    assert.equal(home.headers.get('x-robots-tag'), 'noindex, nofollow');
    const health = await (await fetch(base + '/api/health')).json();
    assert.equal(health.ok, true);
    const site = await fetch(base + '/vercel.html');
    assert.equal(site.status, 404);
    const fav = await fetch(base + '/favicon.svg');
    assert.equal(fav.status, 200);
  } finally { await api.close(); }
});
