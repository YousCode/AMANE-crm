import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, call, H, login, cookieOf, BASE_ENV, at } from './helpers.js';

test('setup + login + me + logout', async () => {
  fresh();
  const bad = await call(H.auth, { method: 'POST', url: '/api/auth/setup', body: { code: 'faux', userId: 'amel', pin: '1234' } });
  assert.equal(bad.status, 401);
  assert.equal(bad.json.error, 'bad_code');

  const s = await call(H.auth, { method: 'POST', url: '/api/auth/setup', body: { code: BASE_ENV.AMANE_SETUP_CODE, userId: 'Amel', pin: '2468' } });
  assert.equal(s.status, 200);
  assert.deepEqual(s.json, { ok: true });

  const r = await call(H.auth, { method: 'POST', url: '/api/auth/login', body: { userId: 'amel', pin: '2468' } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { user: { id: 'amel', nom: 'Amel', role: 'Relation client' } });
  const sc = r.headers['set-cookie'];
  assert.match(sc, /^amane_s=amel\.\d+\.[A-Za-z0-9_-]+; /);
  for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', `Max-Age=${30 * 86400}`]) assert.ok(sc.includes(attr), attr);
  const cookie = cookieOf(r);

  const me = await call(H.auth, { url: '/api/auth/me', cookie });
  assert.equal(me.status, 200);
  assert.equal(me.json.user.id, 'amel');

  // forme réécrite par vercel.json
  const me2 = await call(H.auth, { url: '/api/auth?action=me', cookie });
  assert.equal(me2.status, 200);

  const out = await call(H.auth, { method: 'POST', url: '/api/auth/logout', cookie });
  assert.equal(out.status, 200);
  assert.match(out.headers['set-cookie'], /^amane_s=; .*Max-Age=0/);
  const me3 = await call(H.auth, { url: '/api/auth/me', cookie: 'amane_s=' });
  assert.equal(me3.status, 401);
  assert.equal(me3.json.error, 'non_connecte');
  assert.equal(typeof me3.json.message, 'string');
});

test('mauvais PIN → 401 bad_pin ; PIN jamais créé → 409 no_pin ; PIN invalide refusé à la création', async () => {
  fresh();
  const none = await call(H.auth, { method: 'POST', url: '/api/auth/login', body: { userId: 'aziz', pin: '1234' } });
  assert.equal(none.status, 409);
  assert.equal(none.json.error, 'no_pin');
  await login('amel', '1234');
  const r = await call(H.auth, { method: 'POST', url: '/api/auth/login', body: { userId: 'amel', pin: '9999' } });
  assert.equal(r.status, 401);
  assert.equal(r.json.error, 'bad_pin');
  assert.equal(r.headers['set-cookie'], undefined);
  const unknown = await call(H.auth, { method: 'POST', url: '/api/auth/login', body: { userId: 'mallory', pin: '1234' } });
  assert.equal(unknown.status, 401);
  const weak = await call(H.auth, { method: 'POST', url: '/api/auth/setup', body: { code: BASE_ENV.AMANE_SETUP_CODE, userId: 'aziz', pin: '12' } });
  assert.equal(weak.status, 400);
  assert.equal(weak.json.error, 'pin_invalide');
});

test('5 échecs en 15 min pour un prénom → 429, même avec le bon PIN ; puis la fenêtre expire', async () => {
  fresh();
  const t0 = at('2026-11-03T10:00:00Z');
  await login('amel', '1234');
  for (let i = 0; i < 5; i++) {
    const r = await call(H.auth, { method: 'POST', url: '/api/auth/login', body: { userId: 'amel', pin: '0000' }, ip: `198.51.100.${i}` });
    assert.equal(r.status, 401);
  }
  const blocked = await call(H.auth, { method: 'POST', url: '/api/auth/login', body: { userId: 'amel', pin: '1234' }, ip: '198.51.100.99' });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.json.error, 'trop_de_tentatives');
  at(new Date(t0 + 16 * 60 * 1000).toISOString());
  const ok = await call(H.auth, { method: 'POST', url: '/api/auth/login', body: { userId: 'amel', pin: '1234' }, ip: '198.51.100.99' });
  assert.equal(ok.status, 200);
});

test('5 échecs depuis une même IP (prénoms différents) → 429', async () => {
  const { db } = fresh();
  await login('youssouf', '4321');
  await login('amel', '1111');
  await login('aziz', '2222');
  const users = ['amel', 'aziz', 'youssouf', 'amel', 'aziz'];
  for (const u of users) await call(H.auth, { method: 'POST', url: '/api/auth/login', body: { userId: u, pin: '0000' }, ip: '192.0.2.50' });
  const r = await call(H.auth, { method: 'POST', url: '/api/auth/login', body: { userId: 'youssouf', pin: '4321' }, ip: '192.0.2.50' });
  assert.equal(r.status, 429);
  const rl = db.dump('ratelimits').find((d) => d._id === 'login:ip:192.0.2.50');
  assert.ok(rl.expireAt instanceof Date, 'expireAt est une Date (index TTL)');
});

test('cookie falsifié, expiré, ou PIN réinitialisé → 401', async () => {
  fresh();
  const t0 = at('2026-11-03T10:00:00Z');
  const cookie = await login('amel', '1234');
  const [name, val] = cookie.split('=');
  const [u, exp, sig] = val.split('.');
  const forged = `${name}=aziz.${exp}.${sig}`;
  assert.equal((await call(H.auth, { url: '/api/auth/me', cookie: forged })).status, 401);
  const longer = `${name}=${u}.${Number(exp) + 999999}.${sig}`;
  assert.equal((await call(H.auth, { url: '/api/auth/me', cookie: longer })).status, 401);
  assert.equal((await call(H.auth, { url: '/api/auth/me', cookie })).status, 200);
  at(new Date(t0 + 31 * 86400 * 1000).toISOString());
  assert.equal((await call(H.auth, { url: '/api/auth/me', cookie })).status, 401);
  at(new Date(t0).toISOString());
  await call(H.auth, { method: 'POST', url: '/api/auth/setup', body: { code: BASE_ENV.AMANE_SETUP_CODE, userId: 'amel', pin: '5555' } });
  assert.equal((await call(H.auth, { url: '/api/auth/me', cookie })).status, 401, 'nouveau PIN : ancienne session invalide');
});

test('le PIN est haché (scrypt + sel), jamais stocké en clair', async () => {
  const { db } = fresh();
  await login('amel', '1234');
  await login('aziz', '1234');
  const [a, z] = ['amel', 'aziz'].map((id) => db.dump('users').find((x) => x._id === id));
  assert.match(a.pinHash, /^scrypt\$16384\$8\$1\$/);
  assert.ok(!a.pinHash.includes('1234'));
  assert.notEqual(a.pinHash, z.pinHash, 'sel différent');
});

test('sans session : 401 sur chaque route protégée', async () => {
  const { net } = fresh({ ANTHROPIC_API_KEY: 'sk-test' });
  const routes = [
    [H.auth, 'GET', '/api/auth/me'],
    [H.auth, 'POST', '/api/auth/logout'],
    [H.sync, 'GET', '/api/sync'],
    [H.sync, 'GET', '/api/sync?since=2026-01-01T00:00:00.000Z'],
    [H.doc, 'PUT', '/api/doc/clients/c1', { nom: 'X' }],
    [H.doc, 'DELETE', '/api/doc/clients/c1'],
    [H.doc, 'POST', '/api/counter', { key: 'devis-2026' }],
    [H.doc, 'GET', '/api/activity'],
    [H.photo, 'POST', '/api/photo', { dataUrl: 'data:image/jpeg;base64,/9j/' }],
    [H.photo, 'GET', '/api/photo?id=p1'],
    [H.ai, 'POST', '/api/ai', { messages: [{ role: 'user', content: 'Bonjour' }] }],
    [H.whatsapp, 'POST', '/api/whatsapp/send', { convId: '33612345678', text: 'Bonjour' }],
    [H.whatsapp, 'POST', '/api/whatsapp/read', { convId: '33612345678' }],
  ];
  for (const [h, method, url, body] of routes) {
    for (const cookie of [undefined, 'amane_s=amel.9999999999.faux']) {
      const r = await call(h, { method, url, body, cookie });
      assert.equal(r.status, 401, `${method} ${url} → ${r.status}`);
      assert.equal(r.json.error, 'non_connecte');
    }
  }
  assert.equal(net.calls.length, 0);
});

test('requête d’une autre origine refusée (403), santé publique', async () => {
  fresh();
  const cookie = await login();
  const r = await call(H.doc, { method: 'PUT', url: '/api/doc/clients/c1', body: { nom: 'X' }, cookie, headers: { origin: 'https://evil.example' } });
  assert.equal(r.status, 403);
  const ok = await call(H.doc, { method: 'PUT', url: '/api/doc/clients/c1', body: { nom: 'X' }, cookie, headers: { origin: 'https://amane.test' } });
  assert.equal(ok.status, 200);
  const h = await call(H.health, { url: '/api/health' });
  assert.equal(h.status, 200);
  assert.deepEqual(Object.keys(h.json).sort(), ['auth', 'db', 'ia', 'ok', 'version', 'whatsapp']);
  assert.equal(h.json.ok, true);
  assert.equal(h.json.whatsapp, true);
  assert.equal(h.json.ia, false);
});

test('erreur interne : 500 sans pile ni détail', async () => {
  const { db } = fresh();
  const cookie = await login();
  const orig = db.collection('clients').findOne;
  db.collection('clients').findOne = async () => { throw new Error('secret interne at /var/task/lib/x.js:12'); };
  const origErr = console.error; console.error = () => {};
  const r = await call(H.doc, { method: 'PUT', url: '/api/doc/clients/c1', body: { nom: 'X' }, cookie });
  console.error = origErr;
  db.collection('clients').findOne = orig;
  assert.equal(r.status, 500);
  assert.equal(r.json.error, 'erreur_serveur');
  assert.ok(!r.text.includes('secret') && !r.text.includes('/var/task'));
});

test('cookie envoyé deux fois, séparé par une virgule (appli iOS) → session reconnue', async () => {
  fresh();
  await call(H.auth, { method: 'POST', url: '/api/auth/setup', body: { code: BASE_ENV.AMANE_SETUP_CODE, userId: 'amel', pin: '2468' } });
  const r = await call(H.auth, { method: 'POST', url: '/api/auth/login', body: { userId: 'amel', pin: '2468' } });
  const cookie = cookieOf(r);
  for (const doubled of [`${cookie},${cookie}`, `${cookie}, ${cookie}`, `autre=1, ${cookie}`]) {
    const me = await call(H.auth, { url: '/api/auth/me', cookie: doubled });
    assert.equal(me.status, 200, doubled);
    assert.equal(me.json.user.id, 'amel');
  }
});
