import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, call, H, login, at, jpeg } from './helpers.js';
import { DEFAULT_VEHICULES, DEFAULT_SERVICES } from '../src/lib/seed.js';
import { getDb } from '../src/lib/db.js';

const put = (cookie, col, id, body, url) => call(H.doc, { method: 'PUT', url: url || `/api/doc/${col}/${id}`, body, cookie });
const del = (cookie, col, id) => call(H.doc, { method: 'DELETE', url: `/api/doc/${col}/${id}`, cookie });
const sync = (cookie, since) => call(H.sync, { url: '/api/sync' + (since ? '?since=' + encodeURIComponent(since) : ''), cookie });

test('flotte et services de départ posés une fois (idempotent)', async () => {
  const { db } = fresh();
  const cookie = await login();
  const s = await sync(cookie);
  assert.deepEqual(s.json.changes.vehicules.map((v) => v.id).sort(), Object.keys(DEFAULT_VEHICULES).sort());
  assert.deepEqual(s.json.changes.services.map((v) => v.id).sort(), Object.keys(DEFAULT_SERVICES).sort());
  const urus = s.json.changes.vehicules.find((v) => v.id === 'urus');
  assert.equal(urus.nom, 'Urus SE');
  assert.equal(urus.tarifJour, 1000);
  assert.equal(urus._id, undefined);
  // Le gérant modifie une voiture : un nouveau démarrage ne l'écrase pas.
  await put(cookie, 'vehicules', 'urus', { tarifJour: 1100 });
  const { setDb } = await import('../src/lib/db.js');
  setDb(db); // oublie l'état « préparé » : comme un démarrage à froid
  await getDb();
  assert.equal(db.dump('vehicules').length, 5);
  assert.equal(db.dump('vehicules').find((v) => v._id === 'urus').tarifJour, 1100);
});

test('PUT / DELETE / sync : curseur since, suppressions, champs serveur', async () => {
  const { db } = fresh();
  const t0 = at('2026-11-03T10:00:00.000Z');
  const cookie = await login();
  const r = await put(cookie, 'clients', 'c1', { nom: 'Khalid Al-Mansoori', tel: '06 12 34 56 78', langue: 'AR', _id: 'pirate', id: 'pirate', updatedAt: '1999', createdAt: '1999' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { id: 'c1', updatedAt: '2026-11-03T10:00:00.000Z' });
  const stored = db.dump('clients').find((c) => c._id === 'c1');
  assert.equal(stored.telNorm, '33612345678');
  assert.equal(stored.updatedBy, 'amel');
  assert.equal(stored.createdAt, '2026-11-03T10:00:00.000Z');
  assert.equal(db.dump('clients').length, 1);

  at(new Date(t0 + 5_000).toISOString());
  const full = await sync(cookie);
  assert.equal(full.status, 200);
  assert.equal(full.json.now, '2026-11-03T10:00:05.000Z');
  for (const col of ['clients', 'missions', 'vehicules', 'services', 'partenaires', 'reglages', 'conversations', 'messages']) {
    assert.ok(Array.isArray(full.json.changes[col]), col);
  }
  for (const col of ['users', 'ratelimits', 'photos', 'activity', 'meta']) assert.equal(full.json.changes[col], undefined, col);
  assert.equal(full.json.changes.clients[0].id, 'c1');
  assert.equal(full.json.changes.clients[0].nom, 'Khalid Al-Mansoori');
  assert.ok(!JSON.stringify(full.json).includes('pinHash'));
  const cursor = full.json.now;

  at(new Date(t0 + 10_000).toISOString());
  await put(cookie, 'missions', 'm1', { titre: 'Urus 3 jours', clientId: 'c1', statut: 'nouvelle', montant: 3000 });
  const inc = await sync(cookie, cursor);
  assert.deepEqual(inc.json.changes.missions.map((m) => m.id), ['m1']);
  assert.equal(inc.json.changes.clients.length, 0, 'client inchangé depuis le curseur');
  assert.equal(inc.json.changes.vehicules.length, 0);

  // Marge de 2 s : une écriture à la même seconde que le curseur est renvoyée.
  at(new Date(t0 + 11_000).toISOString());
  const c2 = (await sync(cookie)).json.now;
  await put(cookie, 'clients', 'c1', { nom: 'Khalid Al-Mansoori', tel: '+971 50 123 4567', email: 'k@example.ae' });
  const again = await sync(cookie, c2);
  assert.deepEqual(again.json.changes.clients.map((c) => c.id), ['c1']);
  const c1 = again.json.changes.clients[0];
  assert.equal(c1.email, 'k@example.ae');
  assert.equal(c1.langue, undefined, 'PUT remplace la fiche : champ absent retiré');
  assert.equal(c1.telNorm, '971501234567');
  assert.equal(c1.createdAt, '2026-11-03T10:00:00.000Z', 'createdAt conservé');

  at(new Date(t0 + 20_000).toISOString());
  const d = await del(cookie, 'missions', 'm1');
  assert.deepEqual(d.json, { ok: true });
  const after = await sync(cookie, again.json.now);
  assert.deepEqual(after.json.changes.missions, []);
  assert.deepEqual(after.json.deleted.missions, ['m1']);
  const fullAfter = await sync(cookie);
  assert.ok(!fullAfter.json.changes.missions.some((m) => m.id === 'm1'));
  assert.deepEqual(fullAfter.json.deleted.missions, ['m1']);

  // Recréer une fiche supprimée la fait réapparaître.
  at(new Date(t0 + 30_000).toISOString());
  await put(cookie, 'missions', 'm1', { titre: 'Urus 3 jours (bis)' });
  const back = await sync(cookie, after.json.now);
  assert.deepEqual(back.json.changes.missions.map((m) => m.id), ['m1']);
  assert.equal(back.json.changes.missions[0]._deleted, undefined);

  const bad = await sync(cookie, 'pas-une-date');
  assert.equal(bad.status, 400);
});

test('validation : collection, id, champs, taille', async () => {
  fresh();
  const cookie = await login();
  assert.equal((await put(cookie, 'users', 'amel', { pinHash: 'x' })).status, 400);
  assert.equal((await put(cookie, 'conversations', 'x', { a: 1 })).status, 400);
  assert.equal((await put(cookie, 'clients', 'a.b', { a: 1 })).status, 400);
  assert.equal((await put(cookie, 'clients', 'x'.repeat(65), { a: 1 })).status, 400);
  assert.equal((await put(cookie, 'clients', 'ok', { $where: 1 })).status, 400);
  assert.equal((await put(cookie, 'clients', 'ok', { 'a.b': 1 })).status, 400);
  assert.equal((await put(cookie, 'clients', 'ok', { prefs: { $gt: 1 } })).status, 400);
  const arr = await call(H.doc, { method: 'PUT', url: '/api/doc/clients/ok', raw: '[1,2]', cookie });
  assert.equal(arr.status, 400);
  const big = await put(cookie, 'clients', 'ok', { notes: 'x'.repeat(600 * 1024) });
  assert.equal(big.status, 413);
  assert.equal(big.json.error, 'trop_lourd');
  const rewritten = await put(cookie, 'clients', 'ok', { nom: 'Via réécriture' }, '/api/doc?col=clients&id=ok');
  assert.equal(rewritten.status, 200);
  assert.equal((await call(H.doc, { method: 'POST', url: '/api/doc/clients/ok', body: {}, cookie })).status, 405);
});

test('journal d’activité : résumés en français, filtre docId, plus récent d’abord', async () => {
  fresh();
  const t0 = at('2026-11-03T10:00:00.000Z');
  const cookie = await login('aziz', '1234');
  let k = 0;
  const step = () => at(new Date(t0 + ++k * 1000).toISOString());
  step(); await put(cookie, 'missions', 'm1', { titre: 'G 63 week-end', statut: 'nouvelle', montant: 1300 });
  step(); await put(cookie, 'missions', 'm1', { titre: 'G 63 week-end', statut: 'confirmee', montant: 1300 });
  const m = { titre: 'G 63 week-end', statut: 'confirmee', montant: 1500, debut: '2026-11-20T10:00', fin: '2026-11-22T18:00' };
  step(); await put(cookie, 'missions', 'm1', m);
  step(); await put(cookie, 'missions', 'm1', { ...m }); // rien ne change : pas d'entrée
  step(); await put(cookie, 'missions', 'm1', { ...m, statut: 'encours', lieu: 'Ritz' });
  step(); await put(cookie, 'missions', 'm1', { ...m, statut: 'encours', lieu: 'Ritz', fin: undefined });
  step(); await put(cookie, 'clients', 'c9', { nom: 'Mme Ivanova' });
  step(); await del(cookie, 'missions', 'm1');

  const a = await call(H.doc, { url: '/api/activity?docId=m1&limit=50', cookie });
  assert.equal(a.status, 200);
  assert.deepEqual(a.json.items.map((i) => i.resume), [
    'Suppression : G 63 week-end',
    'modifié : dates',
    'statut : Confirmée → En cours ; modifié : lieu',
    'modifié : montant, dates',
    'statut : Nouvelle → Confirmée',
    'Création : G 63 week-end',
  ]);
  assert.deepEqual(a.json.items.map((i) => i.action), ['delete', 'update', 'update', 'update', 'update', 'create']);
  const first = a.json.items[5];
  assert.equal(first.user, 'aziz');
  assert.equal(first.col, 'missions');
  assert.equal(first.docId, 'm1');
  assert.equal(first.at, '2026-11-03T10:00:01.000Z');
  assert.ok(first.id && first._id === undefined);

  const all = await call(H.doc, { url: '/api/activity?limit=2', cookie });
  assert.equal(all.json.items.length, 2);
  assert.equal(all.json.items[0].resume, 'Suppression : G 63 week-end');
  assert.equal(all.json.items[1].resume, 'Création : Mme Ivanova');
  const viaRewrite = await call(H.doc, { url: '/api/doc?op=activity', cookie });
  assert.equal(viaRewrite.json.items.length, 7);
});

test('compteur : 20 appels simultanés → 1 à 20 sans doublon', async () => {
  fresh();
  const cookie = await login();
  const rs = await Promise.all(Array.from({ length: 20 }, () => call(H.doc, { method: 'POST', url: '/api/counter', body: { key: 'devis-2026' }, cookie })));
  const ns = rs.map((r) => r.json.n).sort((a, b) => a - b);
  assert.deepEqual(ns, Array.from({ length: 20 }, (_, i) => i + 1));
  const other = await call(H.doc, { method: 'POST', url: '/api/doc?op=counter', body: { key: 'facture-2026' }, cookie });
  assert.equal(other.json.n, 1);
  const s = await sync(cookie);
  assert.deepEqual(s.json.compteurs, { 'devis-2026': 20, 'facture-2026': 1 });
  assert.equal((await call(H.doc, { method: 'POST', url: '/api/counter', body: { key: 'updatedAt' }, cookie })).status, 400);
  assert.equal((await call(H.doc, { method: 'POST', url: '/api/counter', body: { key: 'a b' }, cookie })).status, 400);
});

test('photo : envoi, lecture (octets et type), limite de 600 Ko, formats', async () => {
  const { db } = fresh();
  const cookie = await login();
  const img = jpeg(50_000);
  const up = await call(H.photo, { method: 'POST', url: '/api/photo', body: { dataUrl: 'data:image/jpeg;base64,' + img.toString('base64') }, cookie });
  assert.equal(up.status, 200);
  assert.match(up.json.id, /^[A-Za-z0-9_-]{1,64}$/);
  assert.equal(up.json.url, `/api/photo?id=${up.json.id}`);
  const stored = db.dump('photos')[0];
  assert.equal(stored.data._bsontype, 'Binary', 'stocké en BSON Binary');
  assert.equal(stored.size, 50_000);

  const get = await call(H.photo, { url: up.json.url, cookie });
  assert.equal(get.status, 200);
  assert.equal(get.headers['content-type'], 'image/jpeg');
  assert.equal(get.headers['cache-control'], 'private, max-age=31536000, immutable');
  assert.ok(get.body.equals(img));
  assert.equal((await call(H.photo, { url: up.json.url })).status, 401);

  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);
  const upPng = await call(H.photo, { method: 'POST', url: '/api/photo', body: { dataUrl: 'data:image/png;base64,' + png.toString('base64') }, cookie });
  assert.equal((await call(H.photo, { url: upPng.json.url, cookie })).headers['content-type'], 'image/png');

  const tooBig = await call(H.photo, { method: 'POST', url: '/api/photo', body: { dataUrl: 'data:image/jpeg;base64,' + jpeg(600 * 1024 + 1).toString('base64') }, cookie });
  assert.equal(tooBig.status, 413);
  const exact = await call(H.photo, { method: 'POST', url: '/api/photo', body: { dataUrl: 'data:image/jpeg;base64,' + jpeg(600 * 1024).toString('base64') }, cookie });
  assert.equal(exact.status, 200);
  const gif = await call(H.photo, { method: 'POST', url: '/api/photo', body: { dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }, cookie });
  assert.equal(gif.status, 400);
  const fake = await call(H.photo, { method: 'POST', url: '/api/photo', body: { dataUrl: 'data:image/jpeg;base64,' + Buffer.from('<svg onload=alert(1)>').toString('base64') }, cookie });
  assert.equal(fake.status, 400);
  assert.equal((await call(H.photo, { url: '/api/photo?id=inconnu', cookie })).status, 404);
  assert.equal((await call(H.photo, { url: '/api/photo?id=../x', cookie })).status, 400);
});
