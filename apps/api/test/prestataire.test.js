// Espace prestataire : lien personnel à jeton, page publique (missions confiées, disponibilités), confirmation, révocation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, call, H, login, at } from './helpers.js';

const NOW = '2026-11-08T09:00:00Z';
const put = (cookie, col, id, body) => call(H.doc, { method: 'PUT', url: `/api/doc/${col}/${id}`, body, cookie });

async function base() {
  const ctx = fresh();
  at(NOW);
  const cookie = await login('youssouf');
  await put(cookie, 'clients', 'c1', { nom: 'John Smith', tel: '+447700900123', langue: 'EN' });
  await put(cookie, 'clients', 'c2', { nom: 'Mme Ivanova', tel: '+79161234567', langue: 'RU' });
  await put(cookie, 'partenaires', 'p1', { nom: 'Karim Benali', contact: 'Karim', type: 'chauffeur', tel: '+33611223344', langues: 'FR, AR' });
  await put(cookie, 'partenaires', 'p2', { nom: 'Le Cinq', type: 'restaurant', tel: '+33149527000', adresse: '31 avenue George V' });
  await put(cookie, 'vehicules', 'urus', { nom: 'Urus SE', categorie: 'Super SUV', ordre: 1, statut: 'disponible' });
  await put(cookie, 'vehicules', 'g63', { nom: 'G 63', categorie: 'SUV', ordre: 2, statut: 'entretien' });
  await put(cookie, 'vehicules', 'f296', { nom: 'Ferrari 296 GTB', categorie: 'Supercar', ordre: 3, statut: 'disponible' });
  // m1 : chauffeur p1, confirmée, Urus du 10 au 11 ; m2 : étape restaurant chez p2 ; m3 : option (non confiée) ; m4 : passée.
  await put(cookie, 'missions', 'm1', { titre: 'Urus avec chauffeur — Smith', clientId: 'c1', statut: 'confirmee', service: 'chauffeur', vehiculeId: 'urus', chauffeurId: 'p1', debut: '2026-11-10T10:00', fin: '2026-11-11T18:00', lieu: 'Hôtel Plaza Athénée', montant: 3000, acompte: 900, notes: 'Client exigeant, code porte 1234' });
  await put(cookie, 'missions', 'm2', { titre: 'Séjour Ivanova', clientId: 'c2', statut: 'encours', service: 'sejour', debut: '2026-11-08T08:00', fin: '2026-11-12T20:00', programme: [{ dt: '2026-11-09T20:30', type: 'restaurant', partenaireId: 'p2', lieu: 'Le Cinq', client: 'Table au calme', interne: 'Commission 10 %' }, { dt: '2026-11-10T09:00', type: 'transfert', partenaireId: 'p1', lieu: 'Gare du Nord' }] });
  await put(cookie, 'missions', 'm3', { titre: 'Option Ferrari', clientId: 'c1', statut: 'proposition', service: 'location', vehiculeId: 'f296', chauffeurId: 'p1', debut: '2026-11-13T10:00', fin: '2026-11-13T20:00' });
  await put(cookie, 'missions', 'm4', { titre: 'Ancienne', clientId: 'c1', statut: 'terminee', service: 'chauffeur', chauffeurId: 'p1', debut: '2026-10-01T10:00', fin: '2026-10-01T18:00' });
  return { ...ctx, cookie };
}

test('lien prestataire : création idempotente, renouvellement, révocation, droits', async () => {
  const { db, cookie } = await base();
  assert.equal((await call(H.doc, { method: 'POST', url: '/api/partenaires/p1/espace' })).status, 401, 'équipe seulement');
  assert.equal((await call(H.doc, { method: 'POST', url: '/api/partenaires/inconnu/espace', cookie })).status, 404);
  const info0 = await call(H.doc, { url: '/api/partenaires/p1/espace', cookie });
  assert.equal(info0.json.actif, false);
  assert.deepEqual(info0.json.missions.map((m) => m.id), ['m2', 'm1'], 'missions fermes à venir, triées');

  const r = await call(H.doc, { method: 'POST', url: '/api/partenaires/p1/espace', cookie });
  assert.equal(r.status, 200);
  assert.match(r.json.url, /^https:\/\/amane\.test\/api\/prestataire\/[A-Za-z0-9_-]{24}$/);
  assert.equal(r.json.created, true);
  assert.match(r.json.message, /^Bonjour Karim, voici votre espace prestataire Amane/);
  assert.match(r.json.waLink, /^https:\/\/wa\.me\/33611223344\?text=/);
  const again = await call(H.doc, { method: 'POST', url: '/api/partenaires/p1/espace', cookie, body: {} });
  assert.equal(again.json.token, r.json.token);
  assert.equal(again.json.created, false);
  assert.equal(db.dump('partenaires').find((p) => p._id === 'p1').espaceToken, undefined, 'jeton hors de la fiche synchronisée');

  const info = await call(H.doc, { url: '/api/partenaires/p1/espace', cookie });
  assert.equal(info.json.actif, true);
  assert.equal(info.json.url, r.json.url);
  assert.equal(info.json.createdBy, 'youssouf');

  const renew = await call(H.doc, { method: 'POST', url: '/api/partenaires/p1/espace', cookie, body: { renouveler: true } });
  assert.notEqual(renew.json.token, r.json.token);
  assert.equal((await call(H.doc, { url: `/api/prestataire/${r.json.token}` })).status, 404, 'ancien lien coupé');
  assert.equal((await call(H.doc, { url: `/api/prestataire/${renew.json.token}` })).status, 200);

  const del = await call(H.doc, { method: 'DELETE', url: '/api/partenaires/p1/espace', cookie });
  assert.deepEqual(del.json, { ok: true, revoked: true });
  const gone = await call(H.doc, { url: `/api/prestataire/${renew.json.token}` });
  assert.equal(gone.status, 404);
  assert.match(gone.text, /plus valable/);
  assert.equal((await call(H.doc, { url: `/api/prestataire/${renew.json.token}?format=json` })).json.error, 'introuvable');
  assert.equal((await call(H.doc, { method: 'DELETE', url: '/api/partenaires/p1/espace', cookie })).json.revoked, false);
  const acts = db.dump('activity').filter((a) => a.docId === 'p1').map((a) => a.resume);
  assert.ok(acts.includes('Lien de l’espace prestataire créé') && acts.includes('Lien de l’espace prestataire révoqué') && acts.some((x) => /l’ancien ne fonctionne plus/.test(x)));
  assert.equal((await call(H.doc, { method: 'POST', url: '/api/partenaires/p1/espace', cookie, headers: { origin: 'https://evil.example' } })).status, 403);
});

test('page prestataire : missions confiées, client au prénom, disponibilités, aucune donnée sensible, charte', async () => {
  const { db, cookie } = await base();
  const { json: { token } } = await call(H.doc, { method: 'POST', url: '/api/partenaires/p1/espace', cookie });
  const page = await call(H.doc, { url: `/api/prestataire/${token}` });
  assert.equal(page.status, 200);
  assert.equal(page.headers['cache-control'], 'no-store');
  assert.match(page.headers['x-robots-tag'], /noindex/);
  const html = page.text;
  assert.match(html, /Bonjour <em>Karim<\/em>/);
  assert.match(html, /Chauffeur VIP/);
  assert.match(html, /Client : John/);
  assert.match(html, /Client : Mme I\./, 'civilité + initiale');
  assert.ok(!/Smith|Ivanova/.test(html), 'jamais le nom complet du client');
  assert.ok(!/447700900123|79161234567/.test(html), 'pas de téléphone client');
  assert.ok(!/3\s?000|900|€|code porte|Commission|Table au calme/.test(html), 'ni montant, ni notes');
  assert.ok(!/Option Ferrari|Ancienne/.test(html), 'ni options, ni missions passées');
  assert.match(html, /Hôtel Plaza Athénée/);
  assert.match(html, /Gare du Nord/, 'étape du programme confiée');
  assert.ok(html.includes('#FAF8F4') && html.includes('#8A6A3B') && /Bodoni\+Moda/.test(html) && /Jost/.test(html), 'charte Amane');
  assert.ok(html.includes('M452 -6 L560 -6'), 'le A à serrure');
  assert.match(html, /Disponibilités de la flotte/);
  assert.equal((html.match(/Je confirme cette mission/g) || []).length, 2);

  const j = await call(H.doc, { url: `/api/prestataire/${token}`, headers: { accept: 'application/json' } });
  assert.equal(j.status, 200);
  assert.deepEqual(j.json.missions.map((m) => [m.id, m.role, m.client, m.vehicule]), [['m2', 'Transfert', 'Mme I.', ''], ['m1', 'Chauffeur', 'John', 'Urus SE']]);
  assert.equal(JSON.stringify(j.json).includes('montant'), false);
  const D = j.json.disponibilites;
  assert.equal(D.jours[0], '2026-11-08');
  assert.equal(D.jours.length, 14);
  const urus = D.vehicules.find((v) => v.id === 'urus'); const g63 = D.vehicules.find((v) => v.id === 'g63'); const f296 = D.vehicules.find((v) => v.id === 'f296');
  assert.deepEqual(urus.jours.slice(0, 5), ['libre', 'libre', 'reserve', 'reserve', 'libre']);
  assert.ok(g63.jours.every((s) => s === 'indisponible'));
  assert.equal(f296.jours[5], 'option');
  assert.equal((await call(H.doc, { url: `/prestataire/${token}?jours=7`, headers: { accept: 'application/json' } })).json.disponibilites.jours.length, 7, 'alias court, 7 jours');
  const a = db.dump('acces_prestataires')[0];
  assert.equal(a.vues, 3);
  assert.ok(a.vuAt && a.lastVuAt);

  await put(cookie, 'partenaires', 'p1', { nom: 'Karim Benali', type: 'chauffeur', actif: false });
  assert.equal((await call(H.doc, { url: `/api/prestataire/${token}` })).status, 404, 'partenaire inactif : lien suspendu');
});

test('confirmation : par le prestataire (formulaire) ou par l’équipe ; invalide si les dates changent', async () => {
  const { db, cookie } = await base();
  const { json: { token } } = await call(H.doc, { method: 'POST', url: '/api/partenaires/p1/espace', cookie });
  const r = await call(H.doc, { method: 'POST', url: `/api/prestataire/${token}/missions/m1/confirmer`, raw: '', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://amane.test' } });
  assert.equal(r.status, 303);
  assert.equal(r.headers.location, `/api/prestataire/${token}?confirme=m1#m-m1`);
  const page = await call(H.doc, { url: r.headers.location.replace(/#.*/, '') });
  assert.match(page.text, /Merci, la mission est confirmée/);
  assert.match(page.text, /Confirmée le/);
  assert.equal((page.text.match(/Je confirme cette mission/g) || []).length, 1);
  assert.deepEqual(db.dump('confirmations').map((c) => [c._id, c.via, c.debut]), [['m1:p1', 'espace', '2026-11-10T10:00']]);
  assert.ok(db.dump('activity').some((a) => a.docId === 'm1' && /confirmée par Karim Benali depuis son espace/.test(a.resume)));
  const twice = await call(H.doc, { method: 'POST', url: `/api/prestataire/${token}/missions/m1/confirmer`, body: {} });
  assert.deepEqual([twice.status, twice.json.already], [200, true]);

  assert.equal((await call(H.doc, { method: 'POST', url: `/api/prestataire/${token}/missions/m3/confirmer`, body: {} })).status, 404, 'option : pas confiée');
  assert.equal((await call(H.doc, { method: 'POST', url: `/api/prestataire/${token}/missions/m1/confirmer`, body: {}, headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await call(H.doc, { method: 'POST', url: `/api/prestataire/${'x'.repeat(24)}/missions/m1/confirmer`, body: {} })).status, 404);

  let info = await call(H.doc, { url: '/api/partenaires/p1/espace', cookie });
  assert.ok(info.json.missions.find((m) => m.id === 'm1').confirmeeAt);
  await put(cookie, 'missions', 'm1', { titre: 'Urus avec chauffeur — Smith', clientId: 'c1', statut: 'confirmee', service: 'chauffeur', vehiculeId: 'urus', chauffeurId: 'p1', debut: '2026-11-10T14:00', fin: '2026-11-11T18:00' });
  info = await call(H.doc, { url: '/api/partenaires/p1/espace', cookie });
  assert.equal(info.json.missions.find((m) => m.id === 'm1').confirmeeAt, undefined, 'horaire changé : à reconfirmer');

  const team = await call(H.doc, { method: 'POST', url: '/api/missions/m2/confirmation', cookie, body: { partenaireId: 'p2' } });
  assert.deepEqual([team.status, team.json.confirme], [200, true]);
  assert.ok(db.dump('activity').some((a) => a.docId === 'm2' && /noté par l’équipe/.test(a.resume)));
  assert.equal((await call(H.doc, { method: 'POST', url: '/api/missions/m3/confirmation', cookie, body: { partenaireId: 'p2' } })).status, 409);
  const off = await call(H.doc, { method: 'POST', url: '/api/missions/m2/confirmation', cookie, body: { partenaireId: 'p2', confirme: false } });
  assert.equal(off.json.confirme, false);
  assert.equal(db.dump('confirmations').some((c) => c._id === 'm2:p2'), false);
});

test('page prestataire : limite de débit par IP', async () => {
  const { cookie } = await base();
  const { json: { token } } = await call(H.doc, { method: 'POST', url: '/api/partenaires/p1/espace', cookie });
  let last;
  for (let i = 0; i < 240; i++) last = await call(H.doc, { url: `/api/prestataire/${'y'.repeat(24)}?format=json`, ip: '198.51.100.9', noDrain: true });
  assert.equal(last.status, 404);
  assert.equal((await call(H.doc, { url: `/api/prestataire/${token}`, ip: '198.51.100.9' })).status, 429);
  assert.equal((await call(H.doc, { url: `/api/prestataire/${token}`, ip: '198.51.100.10' })).status, 200);
});
