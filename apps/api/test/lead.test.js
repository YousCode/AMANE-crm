import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
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

// ── Demandes signées par le site amane.paris (serveur à serveur) ──
const SECRET = 's'.repeat(40);
/** Appel signé comme le fait le site : HMAC-SHA256 de « <horodatage>.<corps> ». */
function signed(body, { t, secret = SECRET, origin = 'https://amane.paris', sig } = {}) {
  const raw = JSON.stringify(body);
  const ts = String(t ?? Math.floor(Date.parse('2026-11-26T12:00:00Z') / 1000));
  const v1 = sig ?? createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');
  return call(H.lead, { method: 'POST', url: '/api/lead', raw, headers: { origin, 'content-type': 'application/json', 'x-amane-signature': `t=${ts},v1=${v1}` }, ip: '51.91.0.10' });
}

test('demande signée par le site : acceptée depuis une autre origine', async () => {
  const { db } = fresh({ SITE_LEAD_SECRET: SECRET });
  at('2026-11-26T12:00:00Z');
  const r = await signed({ nom: 'Claire Martin', email: 'claire@example.fr', langue: 'FR', service: 'voitures', date: '2026-12-05', passagers: '3', message: 'Une berline pour la soirée' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true });
  assert.equal(r.headers['access-control-allow-origin'], undefined);
  const [m] = db.dump('missions');
  assert.deepEqual(
    { statut: m.statut, source: m.source, service: m.service, debut: m.debut, notes: m.notes },
    { statut: 'nouvelle', source: 'site', service: 'location', debut: '2026-12-05', notes: 'Une berline pour la soirée\n\nPassagers : 3' },
  );
  assert.equal(db.dump('clients')[0].email, 'claire@example.fr');
});

test('demande signée : les services que le CRM ne connaît pas vont en conciergerie, leur nom en tête des notes', async () => {
  const { db } = fresh({ SITE_LEAD_SECRET: SECRET });
  at('2026-11-26T12:00:00Z');
  const cases = [['immobilier', 'Immobilier'], ['tables', 'Tables & restaurants'], ['evenements', 'Événements'], ['esthetique', 'Séjour esthétique'], ['creation', 'Création & marketing'], ['autre', 'Autre demande']];
  for (const [i, [id, label]] of cases.entries()) {
    assert.equal((await signed({ nom: 'S' + i, email: `s${i}@example.com`, service: id, message: 'Bonjour' })).status, 200);
    const m = db.dump('missions').find((x) => x.titre === 'Site — S' + i);
    assert.equal(m.service, 'conciergerie', id);
    assert.equal(m.notes, `Service demandé sur le site : ${label}\n\nBonjour`, id);
  }
  const known = [['van', 'van'], ['chauffeur', 'chauffeur'], ['sejours', 'sejour'], ['shopping', 'shopping'], ['conciergerie', 'conciergerie']];
  for (const [i, [id, crm]] of known.entries()) {
    await signed({ nom: 'K' + i, email: `k${i}@example.com`, service: id, message: 'Bonjour' });
    assert.equal(db.dump('missions').find((x) => x.titre === 'Site — K' + i).service, crm, id);
  }
});

test('demande signée : signature fausse, périmée ou sans secret → 403, rien n’est créé', async () => {
  const body = { nom: 'X', email: 'x@example.com', message: 'Bonjour' };
  let { db } = fresh({ SITE_LEAD_SECRET: SECRET });
  at('2026-11-26T12:00:00Z');
  for (const r of [
    await signed(body, { sig: 'a'.repeat(64) }),
    await signed(body, { secret: 'autre-secret-'.repeat(4) }),
    await signed(body, { t: Math.floor(Date.parse('2026-11-26T11:50:00Z') / 1000) }),
    await signed(body, { t: Math.floor(Date.parse('2026-11-26T12:10:00Z') / 1000) }),
    await call(H.lead, { method: 'POST', url: '/api/lead', body, headers: { origin: 'https://amane.paris', 'x-amane-signature': 'n-importe-quoi' } }),
  ]) {
    assert.equal(r.status, 403);
    assert.equal(r.json.error, 'signature_refusee');
  }
  assert.equal(db.dump('missions').length, 0);
  // Sans secret configuré (ou trop court), aucune signature n'est acceptée.
  for (const env of [{}, { SITE_LEAD_SECRET: 'court' }]) {
    ({ db } = fresh(env));
    at('2026-11-26T12:00:00Z');
    const r = await signed(body, { secret: env.SITE_LEAD_SECRET || SECRET });
    assert.equal(r.status, 403);
    assert.equal(db.dump('missions').length, 0);
  }
});

test('demande signée : passagers « 8+ » repris tel quel, valeur fantaisiste ignorée', async () => {
  const { db } = fresh({ SITE_LEAD_SECRET: SECRET });
  at('2026-11-26T12:00:00Z');
  await signed({ nom: 'Huit', email: 'huit@example.com', service: 'van', passagers: '8+', message: 'Mariage' });
  await signed({ nom: 'Faux', email: 'faux@example.com', service: 'van', passagers: 'beaucoup', message: 'Mariage' });
  assert.equal(db.dump('missions').find((m) => m.titre === 'Site — Huit').notes, 'Mariage\n\nPassagers : 8+');
  assert.equal(db.dump('missions').find((m) => m.titre === 'Site — Faux').notes, 'Mariage');
});

test('téléphone en chiffres arabes : lu comme les chiffres latins', async () => {
  const { db } = fresh({ SITE_LEAD_SECRET: SECRET });
  at('2026-11-26T12:00:00Z');
  assert.equal((await signed({ nom: 'Khalid', tel: '+٩٦٦ ٥٠ ١٢٣ ٤٥٦٧', message: 'Bonjour' })).status, 200);
  assert.equal(db.dump('clients')[0].tel, '+966501234567');
});

test('demande signée : un téléphone illisible ne fait pas perdre une demande qui a un e-mail', async () => {
  const { db } = fresh({ SITE_LEAD_SECRET: SECRET });
  at('2026-11-26T12:00:00Z');
  assert.equal((await signed({ nom: 'Avec Mail', tel: '12 34', email: 'avec@example.com', message: 'Bonjour' })).status, 200);
  const [m] = db.dump('missions');
  assert.equal(m.notes, 'Bonjour\n\nTéléphone saisi sur le site : 12 34');
  assert.equal(db.dump('clients')[0].tel, '');
  // Sans e-mail, il n'y a aucun moyen de répondre : la demande reste refusée.
  const r = await signed({ nom: 'Sans Mail', tel: '12 34', message: 'Bonjour' });
  assert.equal(r.status, 400);
  // Hors appel signé, la règle ne change pas.
  const n = await lead({ nom: 'Navigateur', tel: '12 34', email: 'nav@example.com' });
  assert.equal(n.status, 400);
  assert.equal(n.json.error, 'tel_invalide');
});

test('demande signée : renvoyée deux fois, enregistrée une seule', async () => {
  const { db } = fresh({ SITE_LEAD_SECRET: SECRET });
  at('2026-11-26T12:00:00Z');
  const body = { nom: 'Deux Fois', email: 'deux@example.com', message: 'Bonjour' };
  assert.equal((await signed(body)).status, 200);
  assert.equal((await signed(body)).status, 200);
  assert.equal(db.dump('missions').length, 1);
});

test('demande signée : pas de limite par IP, le site appelle toujours de la même adresse', async () => {
  const { db } = fresh({ SITE_LEAD_SECRET: SECRET });
  at('2026-11-26T12:00:00Z');
  for (let i = 0; i < 8; i++) assert.equal((await signed({ nom: 'N' + i, email: `n${i}@example.com`, message: 'Bonjour' })).status, 200);
  assert.equal(db.dump('missions').length, 8);
});

test('sans signature, une autre origine reste refusée même si le secret est configuré', async () => {
  fresh({ SITE_LEAD_SECRET: SECRET });
  const r = await lead({ nom: 'X', email: 'x@example.com' }, { headers: { origin: 'https://amane.paris' } });
  assert.equal(r.status, 403);
  assert.equal(r.json.error, 'origine_refusee');
});
