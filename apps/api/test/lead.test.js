import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, call, H, login, at } from './helpers.js';

const lead = (body, opts = {}) => call(H.lead, { method: 'POST', url: '/api/lead', body, ...opts });

test('demande du site → client + demande + activité', async () => {
  const { db, net } = fresh();
  at('2026-11-03T10:00:00Z');
  const r = await lead({ nom: 'Sophie Laurent', tel: '06 98 76 54 32', email: 'Sophie@Example.fr', langue: 'FR', service: 'chauffeur', date: '2026-11-20', message: 'Chauffeur pour la Fashion Week', website: '' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true });
  const [c] = db.dump('clients');
  assert.deepEqual(
    { nom: c.nom, tel: c.tel, telNorm: c.telNorm, email: c.email, langue: c.langue, canal: c.canal, statut: c.statut, responsable: c.responsable, updatedBy: c.updatedBy },
    { nom: 'Sophie Laurent', tel: '+33698765432', telNorm: '33698765432', email: 'sophie@example.fr', langue: 'FR', canal: 'Site', statut: 'prospect', responsable: 'amel', updatedBy: 'site' },
  );
  const [m] = db.dump('missions');
  assert.deepEqual(
    { statut: m.statut, source: m.source, canal: m.canal, responsable: m.responsable, service: m.service, clientId: m.clientId, debut: m.debut, notes: m.notes },
    { statut: 'nouvelle', source: 'site', canal: 'Site', responsable: 'amel', service: 'chauffeur', clientId: c._id, debut: '2026-11-20', notes: 'Chauffeur pour la Fashion Week' },
  );
  const act = db.dump('activity').find((a) => a.action === 'lead');
  assert.equal(act.resume, 'Demande reçue du site : Sophie Laurent (nouveau client)');
  assert.equal(act.user, 'site');
  assert.equal(net.graphCalls.length, 0, 'pas d’alerte sans TEAM_ALERT_NUMBERS');
  // visible dans le CRM
  const cookie = await login();
  const s = await call(H.sync, { url: '/api/sync', cookie });
  assert.equal(s.json.changes.missions.length, 1);
});

test('client existant réutilisé par téléphone ou par e-mail', async () => {
  const { db } = fresh();
  const cookie = await login();
  await call(H.doc, { method: 'PUT', url: '/api/doc/clients/vip1', body: { nom: 'M. Al Thani', tel: '+33612345678' }, cookie });
  await call(H.doc, { method: 'PUT', url: '/api/doc/clients/vip2', body: { nom: 'Mrs Smith', email: 'smith@example.com' }, cookie });
  assert.equal((await lead({ nom: 'Al Thani', tel: '06 12 34 56 78', message: 'Rolls pour le Bourget' })).status, 200);
  assert.equal((await lead({ nom: 'J. Smith', email: 'SMITH@example.com', message: 'Shopping avenue Montaigne' })).status, 200);
  assert.equal(db.dump('clients').length, 2);
  const ms = db.dump('missions');
  assert.deepEqual(ms.map((m) => m.clientId).sort(), ['vip1', 'vip2']);
  assert.equal(ms.find((m) => m.clientId === 'vip1').service, 'transfert');
  assert.equal(ms.find((m) => m.clientId === 'vip2').service, 'shopping');
  assert.equal(db.dump('clients').find((c) => c._id === 'vip2').tel, undefined);
});

test('libellés du formulaire du site → service', async () => {
  const { db } = fresh();
  const cases = [["Voitures d'exception", 'location'], ['Private chauffeur', 'chauffeur'], ['فان VIP', 'van'], ['Estancias llave en mano', 'sejour'], ['Conciergerie sur demande', 'conciergerie'], ['التسوّق الشخصي', 'shopping'], ['Autre demande', 'transfert']];
  for (const [i, [label, id]] of cases.entries()) {
    await lead({ nom: 'L' + i, email: `l${i}@example.com`, service: label, message: 'Arrivée à CDG vendredi' }, { ip: '198.51.100.' + i });
    const m = db.dump('missions').find((x) => x.titre === 'Site — L' + i);
    assert.equal(m.service, id, label);
  }
});

test('piège à robots : réponse ok, rien n’est créé', async () => {
  const { db } = fresh();
  const r = await lead({ nom: 'Bot', tel: '0611111111', website: 'http://spam.example' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true });
  assert.equal(db.dump('clients').length, 0);
  assert.equal(db.dump('missions').length, 0);
});

test('validation : téléphone ou e-mail requis, formats', async () => {
  fresh();
  const none = await lead({ nom: 'Sans contact', message: 'Bonjour' });
  assert.equal(none.status, 400);
  assert.equal(none.json.error, 'contact_requis');
  assert.match(none.json.message, /téléphone ou une adresse e-mail/);
  assert.equal((await lead({ nom: 'X', email: 'pas-un-email' })).status, 400);
  assert.equal((await lead({ nom: 'X', tel: '12' })).status, 400);
  assert.equal((await call(H.lead, { method: 'POST', url: '/api/lead', raw: '{oops' })).status, 400);
  assert.equal((await call(H.lead, { method: 'GET', url: '/api/lead' })).status, 405);
});

test('limite : 5 demandes par heure et par IP → 429', async () => {
  const { db } = fresh();
  const t = at('2026-11-03T10:00:00Z');
  for (let i = 0; i < 5; i++) assert.equal((await lead({ nom: 'N' + i, email: `n${i}@example.com` }, { ip: '203.0.113.50' })).status, 200);
  const r = await lead({ nom: 'N6', email: 'n6@example.com' }, { ip: '203.0.113.50' });
  assert.equal(r.status, 429);
  assert.equal((await lead({ nom: 'Autre IP', email: 'o@example.com' }, { ip: '203.0.113.51' })).status, 200);
  at(new Date(t + 61 * 60 * 1000).toISOString());
  assert.equal((await lead({ nom: 'Plus tard', email: 'later@example.com' }, { ip: '203.0.113.50' })).status, 200);
  assert.equal(db.dump('missions').length, 7);
});

test('même origine seulement, aucun en-tête CORS', async () => {
  fresh();
  const cross = await lead({ nom: 'X', email: 'x@example.com' }, { headers: { origin: 'https://autre-site.example' } });
  assert.equal(cross.status, 403);
  const same = await lead({ nom: 'X', email: 'x@example.com' }, { headers: { origin: 'https://amane.test' } });
  assert.equal(same.status, 200);
  assert.equal(same.headers['access-control-allow-origin'], undefined);
});

test('alerte équipe envoyée si configurée', async () => {
  const { net } = fresh({ TEAM_ALERT_NUMBERS: 'amel:33600000001' });
  await lead({ nom: 'Sophie', tel: '0698765432', message: 'Van pour 8 personnes' });
  assert.equal(net.graphCalls.length, 1);
  const b = net.graphCalls[0].body;
  assert.equal(b.to, '33600000001');
  assert.equal(b.type, 'template');
  assert.equal(b.template.name, 'amane_alerte');
  assert.deepEqual(b.template.components[0].parameters.map((p) => p.text), ['Sophie', 'Van pour 8 personnes']);
});
