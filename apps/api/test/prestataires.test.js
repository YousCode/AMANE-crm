// Prestataires (loueurs) : inscription publique, validation, portail par jeton, jours déclarés, véhicules proposés,
// demandes de disponibilité (portail et WhatsApp), protection du jeton, rentabilité. Contrat : docs/prestataires.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, call, H, login, at, postWebhook, inboundPayload } from './helpers.js';

const DAY = '2026-11-03T10:00:00Z';
const TEL = '33611223344';
const put = (cookie, col, id, body) => call(H.doc, { method: 'PUT', url: `/api/doc/${col}/${id}`, body, cookie });
const post = (url, body, opts = {}) => call(H.doc, { method: 'POST', url, body, ...opts });
const get = (url, opts = {}) => call(H.doc, { url, ...opts });
const form = (url, fields, opts = {}) => call(H.doc, { method: 'POST', url, raw: new URLSearchParams(fields).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' }, ...opts });
const quiet = async (fn) => { const e = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = e; } };
const one = (db, col, id) => db.dump(col).find((d) => d._id === id);
const texts = (net, to) => net.graphCalls.filter((c) => c.body.to === to);

/** Loueur validé avec son portail ; renvoie le jeton. */
async function loueur(cookie, id = 'p1', extra = {}) {
  await put(cookie, 'partenaires', id, { nom: 'Luxe Cars', type: 'loueur', contact: 'Karim Benali', tel: '+' + TEL, ...extra });
  const r = await post(`/api/partenaires/${id}/portail`, {}, { cookie });
  assert.equal(r.status, 200, r.text);
  return r.json.token;
}
/** Un loueur, son Classe V, une cliente et une demande ouverte du 20 au 22 novembre. */
async function decor(cookie, mission = {}) {
  const token = await loueur(cookie);
  await put(cookie, 'vehicules', 'v1', { nom: 'Classe V', categorie: 'Van 7 places', plaque: 'AB-123-CD', partenaireId: 'p1', prixAchatJour: 250, tarifJour: 7654321, statut: 'disponible' });
  await put(cookie, 'clients', 'c1', { nom: 'Sophie Laurent', tel: '+33698765432', email: 'sophie@example.fr' });
  await put(cookie, 'missions', 'm1', { titre: 'Site — Sophie Laurent', clientId: 'c1', statut: 'proposition', service: 'van', responsable: 'amel', vehiculeId: 'v1', debut: '2026-11-20T10:00', fin: '2026-11-22T18:00', lieu: 'Plaza Athénée', montant: 4321987, ...mission });
  return token;
}

test('cycle complet : inscription publique → partenaire à valider → validation → portail accessible', async () => {
  const { db, net } = fresh({ TEAM_ALERT_NUMBERS: 'amel:33600000001' });
  at(DAY);
  const page = await get('/prestataires');
  assert.equal(page.status, 200);
  assert.match(page.headers['content-type'], /^text\/html/);
  assert.equal(page.headers['cache-control'], 'no-store');
  assert.equal(page.headers['x-robots-tag'], 'noindex, nofollow');
  assert.ok(page.text.includes('<html lang="fr"') && page.text.includes('action="/api/prestataires/inscription"') && page.text.includes('name="website"'));
  assert.ok(page.text.includes('Arrive as a <em>Guest</em>') && page.text.includes('M452 -6 L560 -6'), 'charte de la maison');
  assert.ok(page.text.includes('sous 48 h') && !/accès immédiat|tout de suite/i.test(page.text), 'aucune promesse d’accès immédiat');
  const r = await post('/api/prestataires/inscription', { societe: 'Luxe Cars', nom: 'Karim Benali', tel: '06 11 22 33 44', email: 'Karim@Luxe.example', siren: '123 456 789', vehicules: '2 Classe V, 1 Range Rover', message: 'Disponibles toute l’année', website: '' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true });
  const [p] = db.dump('partenaires');
  assert.deepEqual(
    { nom: p.nom, type: p.type, societe: p.societe, contact: p.contact, tel: p.tel, telNorm: p.telNorm, email: p.email, siren: p.siren, aValider: p.aValider, inscription: p.inscription, updatedBy: p.updatedBy, portailToken: p.portailToken },
    { nom: 'Luxe Cars', type: 'loueur', societe: 'Luxe Cars', contact: 'Karim Benali', tel: '+' + TEL, telNorm: TEL, email: 'karim@luxe.example', siren: '123456789', aValider: true, inscription: { at: '2026-11-03T10:00:00.000Z', vehicules: '2 Classe V, 1 Range Rover', message: 'Disponibles toute l’année' }, updatedBy: 'site', portailToken: undefined },
  );
  assert.ok(db.dump('activity').some((a) => a.action === 'inscription' && a.user === 'site' && a.resume === 'Inscription prestataire à valider : Luxe Cars'));
  const alerte = texts(net, '33600000001');
  assert.equal(alerte.length, 1, 'alerte à l’équipe');
  assert.deepEqual(alerte[0].body.template.components[0].parameters.map((x) => x.text), ['Luxe Cars', 'Inscription prestataire à valider']);
  assert.equal(db.dump('clients').length + db.dump('missions').length, 0, 'ni client ni demande');
  // Une inscription ne donne aucun accès : pas de portail avant la validation par l'équipe.
  const cookie = await login();
  assert.equal((await post(`/api/partenaires/${p._id}/valider`, {})).status, 401, 'session requise');
  const tot = await post(`/api/partenaires/${p._id}/portail`, {}, { cookie });
  assert.equal(tot.status, 409);
  assert.equal(tot.json.error, 'a_valider');
  const v = await post(`/api/partenaires/${p._id}/valider`, {}, { cookie });
  assert.equal(v.status, 200, v.text);
  assert.match(v.json.token, /^[A-Za-z0-9_-]{24}$/);
  assert.equal(v.json.created, true);
  assert.equal(v.json.url, `https://amane.test/p/${v.json.token}`);
  assert.equal(v.json.message, `Bonjour Karim, voici votre espace prestataire Amane : vous y déclarez vos jours disponibles et répondez à nos demandes. ${v.json.url}`);
  assert.equal(v.json.waLink, `https://wa.me/${TEL}?text=${encodeURIComponent(v.json.message)}`);
  const stored = one(db, 'partenaires', p._id);
  assert.equal('aValider' in stored, false, '« aValider » retiré');
  assert.equal(stored.portailToken, v.json.token);
  assert.ok(db.dump('activity').some((a) => a.resume === 'Prestataire validé : Luxe Cars' && a.user === 'amel'));
  const again = await post(`/api/partenaires/${p._id}/valider`, {}, { cookie });
  assert.deepEqual([again.json.token, again.json.created], [v.json.token, false], 'valider deux fois : même lien');
  const same = await post(`/api/partenaires/${p._id}/portail`, {}, { cookie });
  assert.deepEqual([same.json.token, same.json.created], [v.json.token, false]);
  const html = await get(`/p/${v.json.token}`);
  assert.equal(html.status, 200);
  assert.ok(html.text.includes('Bonjour, <em>Luxe Cars</em>') && html.text.includes('Proposer un véhicule'));
  const json = await get(`/api/portail/${v.json.token}`);
  assert.deepEqual(json.json, { partenaire: { nom: 'Luxe Cars' }, vehicules: [], demandes: [] });
  const s = await call(H.sync, { url: '/api/sync', cookie });
  assert.equal(s.json.changes.partenaires[0].portailToken, v.json.token, 'l’équipe lit le jeton dans la synchro pour copier le lien');
});

test('jeton inconnu, mal formé, partenaire remis « à valider » ou supprimé → 404 identique ; en-têtes des routes publiques', async () => {
  const { db } = fresh();
  at(DAY);
  const cookie = await login();
  const token = await loueur(cookie);
  await put(cookie, 'vehicules', 'v1', { nom: 'Classe V', partenaireId: 'p1' });
  const ok = await get(`/api/portail/${token}`);
  assert.equal(ok.status, 200);
  for (const r of [ok, await get(`/p/${token}`)]) {
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.equal(r.headers['x-robots-tag'], 'noindex, nofollow');
    assert.equal(r.headers['x-frame-options'], 'DENY');
  }
  const csp = (await get(`/p/${token}`)).headers['content-security-policy'];
  assert.match(csp, /default-src 'none'; script-src 'nonce-[A-Za-z0-9+/=]+';/);
  assert.match(csp, /frame-ancestors 'none'/);
  const probe = async (t) => {
    const j = await get(`/api/portail/${t}`);
    const h = await get(`/p/${t}`);
    const w = await post(`/api/portail/${t}/dispos`, { vehiculeId: 'v1', dispos: [{ du: '2026-11-10', au: '2026-11-11' }] });
    const w2 = await post(`/api/portail/${t}/dispos`, { nimporte: 'quoi' });
    const f = await form(`/api/portail/${t}/demandes/m1`, { vehiculeId: 'v1', reponse: 'oui' });
    assert.equal(h.headers['x-robots-tag'], 'noindex, nofollow');
    assert.equal(j.headers['cache-control'], 'no-store');
    return JSON.stringify([j.status, j.text, h.status, h.text, w.status, w.text, w2.status, w2.text, f.status, f.text]);
  };
  const inconnu = await probe('x'.repeat(24));
  assert.deepEqual(JSON.parse(inconnu).filter((x) => typeof x === 'number'), [404, 404, 404, 404, 404]);
  assert.deepEqual(JSON.parse(JSON.parse(inconnu)[1]), { error: 'introuvable', message: 'Ce lien n’est plus valable.' });
  assert.ok(JSON.parse(inconnu)[3].includes('Ce lien n’est plus valable.') && !JSON.parse(inconnu)[3].includes('<script'));
  assert.equal(JSON.parse(inconnu)[9], JSON.parse(inconnu)[3], 'formulaire sans JavaScript : la même page');
  for (const t of ['court', token.slice(0, 23), token + 'a', token.slice(0, 23) + '.', '%24ne', encodeURIComponent('{"$ne":""}')]) assert.equal(await probe(t), inconnu, 'mal formé : ' + t);
  // Une fiche enregistrée depuis un écran en retard ne peut pas remettre le partenaire « à valider » (champ posé par le serveur seulement).
  await put(cookie, 'partenaires', 'p1', { nom: 'Luxe Cars', type: 'loueur', tel: '+' + TEL, aValider: true });
  assert.equal(one(db, 'partenaires', 'p1').aValider, undefined, 'aValider ignoré à l’écriture de la fiche');
  assert.equal((await get(`/api/portail/${token}`)).status, 200, 'le lien marche toujours');
  // Partenaire « à valider » (état posé côté serveur) : le lien s'éteint (le jeton stocké, lui, ne bouge pas).
  await db.collection('partenaires').updateOne({ _id: 'p1' }, { $set: { aValider: true } });
  assert.equal(one(db, 'partenaires', 'p1').portailToken, token);
  assert.equal((await probe(token)).replaceAll(token, 'x'.repeat(24)), inconnu, 'partenaire à valider');
  assert.equal(one(db, 'vehicules', 'v1').dispos, undefined, 'aucune écriture');
  await db.collection('partenaires').updateOne({ _id: 'p1' }, { $unset: { aValider: '' } });
  assert.equal((await get(`/api/portail/${token}`)).status, 200, 'revalidé : le lien revit');
  // Type changé : plus un loueur, plus de portail.
  await put(cookie, 'partenaires', 'p1', { nom: 'Luxe Cars', type: 'garage', tel: '+' + TEL });
  assert.equal((await probe(token)).replaceAll(token, 'x'.repeat(24)), inconnu, 'plus un loueur');
  await put(cookie, 'partenaires', 'p1', { nom: 'Luxe Cars', type: 'loueur', tel: '+' + TEL });
  // Supprimé (inscription refusée, partenaire retiré) : 404, et le jeton est détruit pour de bon.
  assert.equal((await call(H.doc, { method: 'DELETE', url: '/api/doc/partenaires/p1', cookie })).status, 200);
  assert.equal((await probe(token)).replaceAll(token, 'x'.repeat(24)), inconnu, 'partenaire supprimé');
  assert.equal(one(db, 'partenaires', 'p1').portailToken, undefined);
  await put(cookie, 'partenaires', 'p1', { nom: 'Luxe Cars', type: 'loueur', tel: '+' + TEL, portailToken: token });
  assert.equal((await get(`/api/portail/${token}`)).status, 404, 'recréer la fiche ne ranime pas l’ancien lien');
});

test('PUT /api/doc/partenaires/:id ne crée ni ne change le jeton ; reset: true révoque l’ancien lien', async () => {
  const { db } = fresh();
  at(DAY);
  const cookie = await login();
  // Création par PUT avec un jeton choisi : ignoré.
  const forge = 'A'.repeat(24);
  await put(cookie, 'partenaires', 'p1', { nom: 'Luxe Cars', type: 'loueur', tel: '+' + TEL, portailToken: forge, portailAt: '2020-01-01T00:00:00.000Z' });
  assert.equal(one(db, 'partenaires', 'p1').portailToken, undefined);
  assert.equal(one(db, 'partenaires', 'p1').portailAt, undefined);
  assert.equal((await get(`/api/portail/${forge}`)).status, 404);
  const r1 = await post('/api/partenaires/p1/portail', {}, { cookie });
  const token = r1.json.token;
  assert.equal(r1.json.created, true);
  at('2026-11-04T10:00:00Z');
  // PUT avec un autre jeton, puis sans le champ (le PUT du CRM remplace la fiche) : la valeur stockée est conservée.
  assert.equal((await put(cookie, 'partenaires', 'p1', { nom: 'Luxe Cars Paris', type: 'loueur', tel: '+' + TEL, portailToken: forge, portailAt: 'x' })).status, 200);
  assert.equal((await put(cookie, 'partenaires', 'p1', { nom: 'Luxe Cars Paris', type: 'loueur', tel: '+' + TEL, notes: 'Très sérieux' })).status, 200);
  const p = one(db, 'partenaires', 'p1');
  assert.deepEqual([p.nom, p.notes, p.portailToken, p.portailAt], ['Luxe Cars Paris', 'Très sérieux', token, '2026-11-03T10:00:00.000Z']);
  assert.equal((await get(`/api/portail/${forge}`)).status, 404);
  assert.equal((await get(`/api/portail/${token}`)).json.partenaire.nom, 'Luxe Cars Paris');
  assert.ok(!db.dump('activity').some((a) => /portailToken|portailAt/.test(a.resume)), 'le journal ne parle pas du jeton');
  // Régénération : nouveau lien, l'ancien répond 404.
  const r2 = await post('/api/partenaires/p1/portail', { reset: true }, { cookie });
  assert.equal(r2.status, 200);
  assert.equal(r2.json.created, true);
  assert.notEqual(r2.json.token, token);
  assert.match(r2.json.token, /^[A-Za-z0-9_-]{24}$/);
  assert.equal((await get(`/api/portail/${token}`)).status, 404, 'ancien lien révoqué');
  assert.equal((await get(`/p/${token}`)).status, 404);
  assert.equal((await get(`/api/portail/${r2.json.token}`)).status, 200);
  assert.ok(db.dump('activity').some((a) => a.resume === 'Lien du portail prestataire régénéré : Luxe Cars Paris'));
  const r3 = await post('/api/partenaires/p1/portail', { reset: 'oui' }, { cookie });
  assert.deepEqual([r3.json.token, r3.json.created], [r2.json.token, false], 'reset doit valoir true, pas une chaîne');
  // Garde-fous de la route d'équipe.
  await put(cookie, 'partenaires', 'ch1', { nom: 'Karim', type: 'chauffeur' });
  const pas = await post('/api/partenaires/ch1/portail', {}, { cookie });
  assert.deepEqual([pas.status, pas.json.error], [409, 'pas_loueur']);
  assert.equal((await post('/api/partenaires/ch1/valider', {}, { cookie })).json.error, 'pas_loueur');
  assert.equal((await post('/api/partenaires/inconnu/portail', {}, { cookie })).status, 404);
  assert.equal((await post('/api/partenaires/a%20b/portail', {}, { cookie })).status, 400);
  assert.equal((await post('/api/partenaires/p1/portail', {})).status, 401);
  assert.equal((await post('/api/partenaires/p1/portail', { reset: true }, { cookie, headers: { origin: 'https://evil.example' } })).status, 403);
  await put(cookie, 'partenaires', 'p2', { nom: 'Sans téléphone', type: 'loueur' });
  assert.equal((await post('/api/partenaires/p2/portail', {}, { cookie })).json.waLink, '', 'pas de lien WhatsApp sans téléphone');
});

test('le portail ne montre ni montant, ni prix de vente, ni téléphone, e-mail ou nom complet du client', async () => {
  fresh({ WHATSAPP_PUBLIC_NUMBER: '+33 1 00 00 00 00' });
  at(DAY);
  const cookie = await login();
  const token = await decor(cookie, { statut: 'confirmee', acompte: 1234567, notes: 'Cliente VIP, appeler Mme Laurent au 06 98 76 54 32', devis: { numero: 'D-2026-0042', lignes: [{ d: 'Classe V', q: 3, u: 'jour', pu: 9876543 }] } });
  await put(cookie, 'vehicules', 'v2', { nom: 'Range Rover', partenaireId: 'p1', statut: 'disponible', dispos: [{ du: '2026-12-01', au: '2026-12-05' }] });
  await put(cookie, 'missions', 'm2', { titre: 'WhatsApp — Bonjour, c’est Sophie Laurent (06 98 76 54 32)', clientId: 'c1', statut: 'proposition', service: 'location', debut: '2026-12-02T09:00', fin: '2026-12-03T19:00', lieu: 'Aéroport CDG, terminal 2E', montant: 2468135 });
  await put(cookie, 'missions', 'm3', { titre: 'Passée', clientId: 'c1', statut: 'terminee', service: 'van', vehiculeId: 'v1', debut: '2026-10-01T10:00', fin: '2026-10-02T10:00', montant: 1357924 });
  await put(cookie, 'missions', 'm4', { titre: 'Simple option', clientId: 'c1', statut: 'nouvelle', service: 'van', vehiculeId: 'v1', debut: '2026-12-20T10:00', montant: 8642097 });
  assert.equal((await post('/api/missions/m2/dispo', { vehiculeId: 'v2' }, { cookie })).status, 200);
  const j = await get(`/api/portail/${token}`);
  assert.equal(j.status, 200);
  assert.deepEqual(j.json, {
    partenaire: { nom: 'Luxe Cars' },
    vehicules: [
      { id: 'v1', nom: 'Classe V', categorie: 'Van 7 places', plaque: 'AB-123-CD', aValider: false, dispos: [], reservations: [{ du: '2026-11-20T10:00', au: '2026-11-22T18:00', lieu: 'Plaza Athénée', prenom: 'Sophie', titre: 'Van VIP' }] },
      { id: 'v2', nom: 'Range Rover', categorie: '', plaque: '', aValider: false, dispos: [{ du: '2026-12-01', au: '2026-12-05' }], reservations: [] },
    ],
    demandes: [{ missionId: 'm2', vehiculeId: 'v2', vehicule: 'Range Rover', du: '2026-12-02T09:00', au: '2026-12-03T19:00', lieu: 'Aéroport CDG, terminal 2E', prenom: 'Sophie', statut: 'envoyee' }],
  });
  const page = await get(`/p/${token}`);
  assert.equal(page.status, 200);
  for (const [nom, t] of [['JSON', j.text], ['page', page.text]]) {
    for (const interdit of ['Laurent', '4321987', '1234567', '9876543', '2468135', '1357924', '8642097', '7654321', '33698765432', '698765432', '06 98', 'sophie@example.fr', 'D-2026-0042', 'VIP, appeler', 'montant', 'tarifJour', 'prixAchatJour', 'Site —', 'WhatsApp —']) {
      assert.ok(!t.includes(interdit), `${nom} : « ${interdit} » ne doit pas apparaître`);
    }
    assert.ok(t.includes('Sophie') && t.includes('Plaza Athénée') && t.includes('Aéroport CDG'), `${nom} : prénom, lieu de remise`);
  }
  const html = page.text;
  assert.ok(html.includes('<html lang="fr" dir="ltr">') && html.includes('name="viewport" content="width=device-width,initial-scale=1'));
  assert.ok(html.includes('#FAF8F4') && html.includes('#B8955C') && html.includes('Bodoni+Moda') && html.includes('M452 -6 L560 -6') && html.includes('Arrive as a <em>Guest</em>'), 'charte de pages/shell.js');
  assert.ok(html.indexOf('Demande en attente') > 0 && html.indexOf('Demande en attente') < html.indexOf('<span class="label">Vos véhicules</span>'), 'les demandes en attente en tête');
  assert.ok(html.includes(`<form class="rep" method="post" action="/api/portail/${token}/demandes/m2">`) && html.includes('name="reponse" value="oui">Disponible</button>') && html.includes('name="reponse" value="non">Pas disponible</button>'));
  assert.ok(html.includes('du mer. 2 décembre à 9 h 00 au jeu. 3 décembre 2026 à 19 h 00'), 'dates de la demande');
  assert.ok(html.includes('du 1 décembre 2026 au 5 décembre 2026') && html.includes('type="date" name="du"') && html.includes('type="date" name="au"'), 'jours déclarés et ajout « du / au »');
  assert.ok(html.includes('du ven. 20 novembre à 10 h 00 au dim. 22 novembre 2026 à 18 h 00') && html.includes('pour Sophie'), 'réservation à venir');
  assert.ok(html.includes('https://wa.me/33100000000'), 'contact de la maison');
  assert.ok(/input,textarea\{[^}]*font-size:16px[^}]*min-height:48px/.test(html) && /\.x\{[^}]*min-height:44px;min-width:44px/.test(html), 'champs ≥ 16 px, cibles ≥ 44 px');
  const nonce = /script-src 'nonce-([^']+)'/.exec(page.headers['content-security-policy'])[1];
  assert.equal(html.match(/<script/g).length, 1);
  assert.ok(html.includes(`<script nonce="${nonce}">`), 'un seul script, celui de la page');
});

test('un prestataire ne voit ni ne modifie le véhicule d’un autre ; jours déclarés : normalisation et limites', async () => {
  const { db } = fresh();
  at(DAY);
  const cookie = await login();
  const t1 = await loueur(cookie, 'p1');
  const t2 = await loueur(cookie, 'p2', { nom: 'Prestige Vans', contact: 'Nadia', tel: '+33622334455' });
  await put(cookie, 'vehicules', 'v1', { nom: 'Classe V', partenaireId: 'p1' });
  await put(cookie, 'vehicules', 'v2', { nom: 'Sprinter secret', partenaireId: 'p2', dispos: [{ du: '2026-11-10', au: '2026-11-12' }] });
  await put(cookie, 'clients', 'c1', { nom: 'Paul Martin' });
  await put(cookie, 'missions', 'm2', { titre: 'Sprinter', clientId: 'c1', statut: 'proposition', service: 'van', debut: '2026-11-20T10:00', fin: '2026-11-21T10:00' });
  assert.equal((await post('/api/missions/m2/dispo', { vehiculeId: 'v2' }, { cookie })).status, 200);
  const j1 = await get(`/api/portail/${t1}`);
  assert.deepEqual(j1.json.vehicules.map((v) => v.id), ['v1']);
  assert.deepEqual(j1.json.demandes, []);
  const p1 = await get(`/p/${t1}`);
  assert.ok(!j1.text.includes('Sprinter') && !p1.text.includes('Sprinter') && !p1.text.includes('Prestige'));
  assert.deepEqual((await get(`/api/portail/${t2}`)).json.demandes.map((d) => d.missionId), ['m2']);
  // Écritures sur le véhicule d'un autre, de la maison, ou inconnu : même 404, rien ne bouge.
  const refus = [];
  for (const vid of ['v2', 'urus', 'inconnu']) {
    const r = await post(`/api/portail/${t1}/dispos`, { vehiculeId: vid, dispos: [] });
    refus.push([r.status, r.text]);
    const d = await post(`/api/portail/${t1}/demandes/m2`, { vehiculeId: vid, reponse: 'oui' });
    assert.deepEqual([d.status, d.json.error], [404, 'introuvable'], vid);
  }
  assert.deepEqual(refus, Array(3).fill([404, JSON.stringify({ error: 'introuvable', message: 'Véhicule introuvable.' })]));
  assert.deepEqual(one(db, 'vehicules', 'v2').dispos, [{ du: '2026-11-10', au: '2026-11-12' }]);
  assert.equal(one(db, 'missions', 'm2').dispoDemandes[0].statut, 'envoyee');
  assert.equal((await post(`/api/portail/${t1}/demandes/m2`, { vehiculeId: 'v1', reponse: 'oui' })).status, 404, 'son véhicule, mais pas sa demande');
  // Ses propres jours : périodes triées et fusionnées (normDispos), remplacées à chaque envoi.
  const ok = await post(`/api/portail/${t1}/dispos`, { vehiculeId: 'v1', dispos: [{ du: '2026-12-10', au: '2026-12-12', nom: 'x' }, { du: '2026-11-15', au: '2026-11-10' }, { du: '2026-12-13', au: '2026-12-14' }] });
  assert.equal(ok.status, 200, ok.text);
  assert.deepEqual(ok.json, { ok: true, dispos: [{ du: '2026-11-10', au: '2026-11-15' }, { du: '2026-12-10', au: '2026-12-14' }] });
  const v1 = one(db, 'vehicules', 'v1');
  assert.deepEqual(v1.dispos, ok.json.dispos);
  assert.deepEqual([v1.nom, v1.partenaireId, v1.updatedBy], ['Classe V', 'p1', 'prestataire'], 'rien d’autre n’est touché');
  assert.ok(db.dump('activity').some((a) => a.user === 'prestataire' && a.resume === 'Jours disponibles déclarés par Luxe Cars : Classe V (2 périodes)'));
  assert.deepEqual((await post(`/api/portail/${t1}/dispos`, { vehiculeId: 'v1', dispos: [{ du: '2026-11-10', au: '2026-11-15' }] })).json.dispos, [{ du: '2026-11-10', au: '2026-11-15' }], 'suppression d’une période');
  // Limites : 60 périodes, 2 ans, dates réelles, tailles bornées, même origine.
  const bad = async (dispos) => { const r = await post(`/api/portail/${t1}/dispos`, { vehiculeId: 'v1', dispos }); return [r.status, r.json.error]; };
  assert.deepEqual(await bad(Array.from({ length: 61 }, (_, i) => ({ du: `2027-0${1 + (i % 9)}-${String(1 + (i % 28)).padStart(2, '0')}`, au: `2027-0${1 + (i % 9)}-${String(1 + (i % 28)).padStart(2, '0')}` }))), [400, 'trop_de_periodes']);
  assert.deepEqual(await bad([{ du: '2028-11-03', au: '2028-11-04' }]), [400, 'date_trop_lointaine']);
  assert.deepEqual((await post(`/api/portail/${t1}/dispos`, { vehiculeId: 'v1', dispos: [{ du: '2028-11-01', au: '2028-11-03' }] })).status, 200, 'deux ans jour pour jour : accepté');
  for (const p of [{ du: '2026-02-31', au: '2026-03-01' }, { du: '2026-11-10' }, { du: '10/11/2026', au: '11/11/2026' }, { du: 20261110, au: 20261111 }, null, 'x']) assert.deepEqual(await bad([p]), [400, 'periode_invalide'], JSON.stringify(p));
  assert.deepEqual(await bad('2026-11-10'), [400, 'dispos_invalides']);
  assert.equal((await post(`/api/portail/${t1}/dispos`, { vehiculeId: { $ne: '' }, dispos: [] })).status, 400);
  assert.equal((await call(H.doc, { method: 'POST', url: `/api/portail/${t1}/dispos`, raw: JSON.stringify({ vehiculeId: 'v1', dispos: [], x: 'y'.repeat(9000) }) })).status, 413);
  assert.equal((await post(`/api/portail/${t1}/dispos`, { vehiculeId: 'v1', dispos: [] }, { headers: { origin: 'https://autre-site.example' } })).status, 403);
  assert.deepEqual(one(db, 'vehicules', 'v1').dispos, [{ du: '2028-11-01', au: '2028-11-03' }]);
  // Le véhicule change de propriétaire : la demande envoyée à l'ancien ne devient pas celle du nouveau.
  await put(cookie, 'vehicules', 'v2', { nom: 'Sprinter secret', partenaireId: 'p1' });
  assert.deepEqual((await get(`/api/portail/${t1}`)).json.demandes, []);
  assert.equal((await post(`/api/portail/${t1}/demandes/m2`, { vehiculeId: 'v2', reponse: 'oui' })).status, 404);
  assert.deepEqual((await get(`/api/portail/${t2}`)).json, { partenaire: { nom: 'Prestige Vans' }, vehicules: [], demandes: [] });
  assert.equal((await post(`/api/portail/${t2}/demandes/m2`, { vehiculeId: 'v2', reponse: 'oui' })).status, 404, 'l’ancien propriétaire non plus');
  assert.equal(one(db, 'missions', 'm2').dispoDemandes[0].statut, 'envoyee');
});

test('proposer un véhicule : toujours « à valider », rattaché au prestataire, texte échappé, 20 au plus, alerte équipe', async () => {
  const { db, net } = fresh({ TEAM_ALERT_NUMBERS: 'amel:33600000001,youssouf:33600000003' });
  at(DAY);
  const cookie = await login();
  const token = await loueur(cookie);
  const r = await post(`/api/portail/${token}/vehicules`, { nom: '<img src=x onerror=alert(1)> Ferrari', categorie: 'Supercar "rare"', plaque: 'ab-123-cd', prixJour: '1200,50', notes: '</script><script>alert(2)</script>', partenaireId: 'p2', aValider: false, tarifJour: 1, statut: 'entretien', id: 'urus', dispos: [{ du: '2026-01-01', au: '2027-01-01' }] });
  assert.equal(r.status, 200, r.text);
  assert.match(r.json.id, /^v[A-Za-z0-9]+$/);
  const v = one(db, 'vehicules', r.json.id);
  assert.deepEqual(
    { nom: v.nom, categorie: v.categorie, plaque: v.plaque, partenaireId: v.partenaireId, aValider: v.aValider, prixAchatJour: v.prixAchatJour, notes: v.notes, statut: v.statut, tarifJour: v.tarifJour, dispos: v.dispos, updatedBy: v.updatedBy },
    { nom: '<img src=x onerror=alert(1)> Ferrari', categorie: 'Supercar "rare"', plaque: 'AB-123-CD', partenaireId: 'p1', aValider: true, prixAchatJour: 1200.5, notes: '</script><script>alert(2)</script>', statut: 'disponible', tarifJour: undefined, dispos: [], updatedBy: 'prestataire' },
  );
  assert.equal(one(db, 'vehicules', 'urus').nom, 'Urus SE', 'aucun véhicule existant écrasé');
  const alerte = texts(net, '33600000003');
  assert.equal(alerte.length, 1, 'alerte à Youssouf (flotte)');
  assert.deepEqual(alerte[0].body.template.components[0].parameters.map((x) => x.text), ['Luxe Cars', 'Véhicule proposé : <img src=x onerror=alert(1)> Ferrari'.slice(0, 60)]);
  assert.ok(db.dump('activity').some((a) => a.user === 'prestataire' && /^Véhicule proposé par Luxe Cars : .* \(à valider\)$/.test(a.resume)));
  const page = await get(`/p/${token}`);
  assert.ok(page.text.includes('&lt;img src=x onerror=alert(1)&gt; Ferrari') && page.text.includes('À valider'));
  assert.ok(!page.text.includes('<img') && !page.text.includes('alert(2)') && page.text.match(/<script/g).length === 1, 'aucun HTML du prestataire exécuté');
  const j = await get(`/api/portail/${token}`);
  assert.deepEqual(j.json.vehicules.map((x) => [x.nom, x.aValider, x.plaque]), [['<img src=x onerror=alert(1)> Ferrari', true, 'AB-123-CD']]);
  // Nom de partenaire hostile : échappé lui aussi.
  await put(cookie, 'partenaires', 'p1', { nom: 'Luxe <script>alert(3)</script> "Cars"', type: 'loueur', tel: '+' + TEL });
  const page2 = await get(`/p/${token}`);
  assert.ok(page2.text.includes('Luxe &lt;script&gt;alert(3)&lt;/script&gt; &quot;Cars&quot;') && !page2.text.includes('alert(3)</script>'));
  // Validation des champs.
  for (const [body, code] of [[{ nom: '   ' }, 'nom_requis'], [{ categorie: 'Van' }, 'nom_requis'], [{ nom: 'X', prixJour: '-5' }, 'prix_invalide'], [{ nom: 'X', prixJour: 'cher' }, 'prix_invalide'], [{ nom: 'X', prixJour: 1e9 }, 'prix_invalide'], [{ nom: 'X', prixJour: '1e5' }, 'prix_invalide']]) {
    const b = await post(`/api/portail/${token}/vehicules`, body);
    assert.deepEqual([b.status, b.json.error], [400, code], JSON.stringify(body));
  }
  const long = await post(`/api/portail/${token}/vehicules`, { nom: 'N'.repeat(300), notes: 'n'.repeat(3000) });
  assert.equal(one(db, 'vehicules', long.json.id).nom.length, 80);
  assert.equal(one(db, 'vehicules', long.json.id).notes.length, 1000);
  assert.equal(one(db, 'vehicules', long.json.id).prixAchatJour, undefined);
  // Formulaire classique (sans JavaScript) : 303 vers le portail.
  const f = await form(`/api/portail/${token}/vehicules`, { nom: 'Vito', categorie: 'Van', plaque: '', prixJour: '180', notes: '' });
  assert.deepEqual([f.status, f.headers.location], [303, `/p/${token}`]);
  const ferr = await form(`/api/portail/${token}/vehicules`, { nom: '' });
  assert.equal(ferr.status, 400);
  assert.match(ferr.headers['content-type'], /^text\/html/);
  assert.ok(ferr.text.includes('Indiquez le modèle du véhicule.') && ferr.text.includes(`href="/p/${token}"`));
  // 20 véhicules au plus par prestataire.
  for (let i = db.dump('vehicules').filter((x) => x.partenaireId === 'p1').length; i < 20; i++) assert.equal((await post(`/api/portail/${token}/vehicules`, { nom: 'V' + i })).status, 200);
  const trop = await post(`/api/portail/${token}/vehicules`, { nom: 'Le 21e' });
  assert.deepEqual([trop.status, trop.json.error], [409, 'trop_de_vehicules']);
  assert.equal(db.dump('vehicules').filter((x) => x.partenaireId === 'p1').length, 20);
  assert.ok(db.dump('vehicules').filter((x) => x.partenaireId === 'p1').every((x) => x.aValider === true));
});

test('demande de dispo avec WhatsApp : modèle amane_dispo hors fenêtre, texte libre dans la fenêtre de 24 h', async () => {
  const { db, net } = fresh();
  at(DAY);
  const cookie = await login();
  const token = await decor(cookie);
  const url = `https://amane.test/p/${token}`;
  const message = `Bonjour Karim, Amane a une demande pour votre Classe V, du 20 novembre au 22 novembre 2026. Est-il disponible ? Répondez OUI ou NON, ou ouvrez votre espace : ${url}`;
  const r = await post('/api/missions/m1/dispo', { vehiculeId: 'v1' }, { cookie });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json, { ok: true, canal: 'whatsapp', url, message, waLink: `https://wa.me/${TEL}?text=${encodeURIComponent(message)}` });
  assert.equal(net.graphCalls.length, 1);
  assert.deepEqual(net.graphCalls[0].body, {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: TEL, type: 'template',
    template: { name: 'amane_dispo', language: { code: 'fr' }, components: [{ type: 'body', parameters: ['Karim', 'Classe V', 'du 20 novembre au 22 novembre 2026', url].map((text) => ({ type: 'text', text })) }] },
  });
  assert.deepEqual(one(db, 'missions', 'm1').dispoDemandes, [{ vehiculeId: 'v1', partenaireId: 'p1', statut: 'envoyee', envoyeAt: '2026-11-03T10:00:00.000Z', canal: 'whatsapp', par: 'amel' }]);
  assert.equal(one(db, 'missions', 'm1').titre, 'Site — Sophie Laurent', 'le reste de la demande est intact');
  const conv = one(db, 'conversations', TEL);
  assert.deepEqual([conv.partenaireId, conv.nom, conv.lastDir, conv.clientId, conv.missionId], ['p1', 'Luxe Cars', 'out', undefined, undefined]);
  assert.ok(db.dump('activity').some((a) => a.action === 'dispo' && a.user === 'amel' && a.resume === 'Disponibilité demandée à Luxe Cars : Classe V du 20 novembre au 22 novembre 2026'));
  for (const t of [message, JSON.stringify(net.graphCalls[0].body)]) assert.ok(!/Sophie|Laurent|4321987|Plaza/.test(t), 'rien sur le client dans le message');
  // Le prestataire écrit : sa fenêtre de 24 h s'ouvre, la demande suivante part en texte libre.
  at('2026-11-03T11:00:00Z');
  await postWebhook(inboundPayload({ from: TEL, name: 'Karim', id: 'wamid.k1', text: 'Bonjour, bien reçu, je regarde' }));
  assert.equal(one(db, 'missions', 'm1').dispoDemandes[0].statut, 'envoyee', 'un texte libre n’est pas une réponse');
  net.calls.length = 0;
  const r2 = await post('/api/missions/m1/dispo', { vehiculeId: 'v1' }, { cookie });
  assert.equal(r2.json.canal, 'whatsapp');
  assert.deepEqual(net.graphCalls.map((c) => [c.body.to, c.body.type, c.body.text && c.body.text.body]), [[TEL, 'text', message]]);
  assert.equal(one(db, 'missions', 'm1').dispoDemandes.length, 1, 'une entrée par véhicule');
  assert.equal(one(db, 'missions', 'm1').dispoDemandes[0].envoyeAt, '2026-11-03T11:00:00.000Z');
  // Fenêtre refermée : de nouveau le modèle.
  at('2026-11-04T11:00:01Z');
  net.calls.length = 0;
  await post('/api/missions/m1/dispo', { vehiculeId: 'v1' }, { cookie });
  assert.deepEqual(net.graphCalls.map((c) => [c.body.type, c.body.template && c.body.template.name]), [['template', 'amane_dispo']]);
  // Garde-fous.
  assert.equal((await post('/api/missions/m1/dispo', { vehiculeId: 'v1' })).status, 401);
  assert.equal((await post('/api/missions/m1/dispo', { vehiculeId: 'v1' }, { cookie, headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await post('/api/missions/m1/dispo', {}, { cookie })).status, 400);
  assert.equal((await post('/api/missions/inconnue/dispo', { vehiculeId: 'v1' }, { cookie })).status, 404);
  assert.equal((await post('/api/missions/m1/dispo', { vehiculeId: 'inconnu' }, { cookie })).status, 404);
  const maison = await post('/api/missions/m1/dispo', { vehiculeId: 'urus' }, { cookie });
  assert.deepEqual([maison.status, maison.json.error], [409, 'pas_prestataire']);
  await put(cookie, 'partenaires', 'p9', { nom: 'Pas encore validé', type: 'loueur' });
  await db.collection('partenaires').updateOne({ _id: 'p9' }, { $set: { aValider: true } });
  await put(cookie, 'vehicules', 'v9', { nom: 'Vito', partenaireId: 'p9' });
  assert.equal((await post('/api/missions/m1/dispo', { vehiculeId: 'v9' }, { cookie })).json.error, 'pas_prestataire');
  await put(cookie, 'missions', 'mf', { titre: 'Close', clientId: 'c1', statut: 'terminee', debut: '2026-10-01T10:00' });
  const close = await post('/api/missions/mf/dispo', { vehiculeId: 'v1' }, { cookie });
  assert.deepEqual([close.status, close.json.error], [409, 'mission_fermee']);
  assert.equal(one(db, 'missions', 'mf').dispoDemandes, undefined);
});

test('demande de dispo sans WhatsApp (ou refusée par Meta, ou sans téléphone) : canal « lien », message et waLink pour l’équipe', async () => {
  const { db, net } = fresh({ WHATSAPP_TOKEN: undefined, WHATSAPP_PHONE_NUMBER_ID: undefined, PUBLIC_URL: 'https://app.amane.example/' });
  at(DAY);
  const cookie = await login();
  await put(cookie, 'partenaires', 'p1', { nom: 'Luxe Cars', type: 'loueur', tel: '+' + TEL });
  await put(cookie, 'vehicules', 'v1', { nom: 'Classe V', partenaireId: 'p1' });
  await put(cookie, 'clients', 'c1', { nom: 'Sophie Laurent' });
  await put(cookie, 'missions', 'm1', { titre: 'Journée', clientId: 'c1', statut: 'nouvelle', debut: '2026-11-20T10:00' });
  const r = await post('/api/missions/m1/dispo', { vehiculeId: 'v1' }, { cookie });
  assert.equal(r.status, 200, r.text);
  const token = one(db, 'partenaires', 'p1').portailToken;
  assert.match(token, /^[A-Za-z0-9_-]{24}$/, 'le portail est créé au passage');
  const message = `Bonjour Luxe, Amane a une demande pour votre Classe V, le 20 novembre 2026. Est-il disponible ? Répondez OUI ou NON, ou ouvrez votre espace : https://app.amane.example/p/${token}`;
  assert.deepEqual(r.json, { ok: true, canal: 'lien', url: `https://app.amane.example/p/${token}`, message, waLink: `https://wa.me/${TEL}?text=${encodeURIComponent(message)}` });
  assert.equal(net.graphCalls.length, 0);
  assert.deepEqual(one(db, 'missions', 'm1').dispoDemandes.map((d) => [d.vehiculeId, d.statut, d.canal]), [['v1', 'envoyee', 'lien']]);
  assert.equal(db.dump('conversations').length, 0, 'pas de conversation fantôme');
  // WhatsApp configuré mais Meta refuse l'envoi : même repli, la demande est tout de même posée.
  const b = fresh();
  at(DAY);
  const cookie2 = await login();
  await decor(cookie2);
  b.net.graph(() => ({ status: 400, json: { error: { message: 'Recipient not on WhatsApp', code: 131026 } } }));
  const r2 = await quiet(() => post('/api/missions/m1/dispo', { vehiculeId: 'v1' }, { cookie: cookie2 }));
  assert.deepEqual([r2.status, r2.json.canal], [200, 'lien']);
  assert.ok(r2.json.message.startsWith('Bonjour Karim, Amane a une demande') && r2.json.waLink.startsWith(`https://wa.me/${TEL}?text=`));
  assert.equal(one(b.db, 'missions', 'm1').dispoDemandes[0].canal, 'lien');
  assert.equal(b.db.dump('conversations').length, 0);
  // Prestataire sans téléphone : lien à transmettre autrement, pas de waLink.
  await put(cookie2, 'partenaires', 'p1', { nom: 'Luxe Cars', type: 'loueur' });
  b.net.graph(() => { throw new Error('aucun envoi attendu'); });
  const r3 = await post('/api/missions/m1/dispo', { vehiculeId: 'v1' }, { cookie: cookie2 });
  assert.deepEqual([r3.json.canal, r3.json.waLink], ['lien', '']);
});

test('réponse « oui » sur le portail : statut, jours étendus, alerte au responsable, journal, idempotence', async () => {
  const { db, net } = fresh({ TEAM_ALERT_NUMBERS: 'amel:33600000001,aziz:33600000002' });
  at(DAY);
  const cookie = await login();
  const token = await decor(cookie, { responsable: 'aziz' });
  await post(`/api/portail/${token}/dispos`, { vehiculeId: 'v1', dispos: [{ du: '2026-11-10', au: '2026-11-19' }] });
  await post('/api/missions/m1/dispo', { vehiculeId: 'v1' }, { cookie });
  for (const [body, code] of [[{ vehiculeId: 'v1', reponse: 'peut-être' }, 400], [{ vehiculeId: 'v1' }, 400], [{ reponse: 'oui' }, 400], [{ vehiculeId: 'v1', reponse: ['oui'] }, 400]]) assert.equal((await post(`/api/portail/${token}/demandes/m1`, body)).status, code, JSON.stringify(body));
  assert.equal((await post(`/api/portail/${token}/demandes/m%201`, { vehiculeId: 'v1', reponse: 'oui' })).status, 400);
  assert.equal((await post(`/api/portail/${token}/demandes/m1`, { vehiculeId: 'v1', reponse: 'oui' }, { headers: { origin: 'https://autre-site.example' } })).status, 403);
  assert.equal(one(db, 'missions', 'm1').dispoDemandes[0].statut, 'envoyee');
  net.calls.length = 0;
  at('2026-11-03T12:00:00Z');
  const r = await post(`/api/portail/${token}/demandes/m1`, { vehiculeId: 'v1', reponse: 'oui' });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json, { ok: true, statut: 'oui', deja: false });
  const m = one(db, 'missions', 'm1');
  assert.deepEqual(m.dispoDemandes, [{ vehiculeId: 'v1', partenaireId: 'p1', statut: 'oui', envoyeAt: '2026-11-03T10:00:00.000Z', canal: 'portail', par: 'amel', reponduAt: '2026-11-03T12:00:00.000Z' }]);
  // L'équipe enregistre la fiche depuis un écran qui n'a pas encore reçu la réponse : la réponse du prestataire reste.
  const { _id: _i, updatedAt: _u, updatedBy: _b, createdAt: _c, ...fiche } = m;
  assert.equal((await put(cookie, 'missions', 'm1', { ...fiche, lieu: 'Ritz Paris', dispoDemandes: [{ vehiculeId: 'v1', partenaireId: 'p1', statut: 'envoyee' }] })).status, 200);
  assert.equal(one(db, 'missions', 'm1').lieu, 'Ritz Paris');
  assert.equal(one(db, 'missions', 'm1').dispoDemandes[0].statut, 'oui', 'réponse du prestataire conservée');
  assert.equal((await put(cookie, 'missions', 'm1', { ...fiche })).status, 200);
  assert.deepEqual([m.statut, m.montant, m.vehiculeId, m.updatedBy], ['proposition', 4321987, 'v1', 'prestataire'], 'rien d’autre ne change sur la demande');
  assert.deepEqual(one(db, 'vehicules', 'v1').dispos, [{ du: '2026-11-10', au: '2026-11-22' }], 'période de la mission ajoutée et fusionnée (addDispo)');
  const alertes = net.graphCalls.filter((c) => c.body.to !== TEL);
  assert.deepEqual(alertes.map((c) => c.body.to), ['33600000002'], 'alerte au responsable de la mission');
  assert.deepEqual(alertes[0].body.template.components[0].parameters.map((x) => x.text), ['Luxe Cars', 'Classe V : disponible']);
  assert.ok(db.dump('activity').some((a) => a.action === 'dispo' && a.docId === 'm1' && a.user === 'prestataire' && a.resume === 'Luxe Cars : Classe V disponible du 20 novembre au 22 novembre 2026 (réponse sur le portail)'));
  // Idempotent : la même réponse ne réécrit rien et n'alerte pas deux fois.
  const acts = db.dump('activity').length;
  net.calls.length = 0;
  at('2026-11-03T13:00:00Z');
  const again = await post(`/api/portail/${token}/demandes/m1`, { vehiculeId: 'v1', reponse: 'oui' });
  assert.deepEqual([again.status, again.json], [200, { ok: true, statut: 'oui', deja: true }]);
  assert.equal(one(db, 'missions', 'm1').dispoDemandes[0].reponduAt, '2026-11-03T12:00:00.000Z');
  assert.equal(db.dump('activity').length, acts);
  assert.equal(net.graphCalls.length, 0);
  const flip = await post(`/api/portail/${token}/demandes/m1`, { vehiculeId: 'v1', reponse: 'non' });
  assert.deepEqual([flip.status, flip.json.error], [409, 'deja_repondu']);
  const page = await get(`/p/${token}`);
  assert.ok(!page.text.includes('Demande en attente') && page.text.includes('Vos réponses') && page.text.includes('<span class="rep-ok">Disponible</span>'));
  // L'équipe redemande : l'entrée repart à « envoyee » ; réponse « non » par le formulaire sans JavaScript.
  await post('/api/missions/m1/dispo', { vehiculeId: 'v1' }, { cookie });
  assert.deepEqual(Object.keys(one(db, 'missions', 'm1').dispoDemandes[0]).sort(), ['canal', 'envoyeAt', 'par', 'partenaireId', 'statut', 'vehiculeId']);
  net.calls.length = 0;
  const f = await form(`/api/portail/${token}/demandes/m1`, { vehiculeId: 'v1', reponse: 'non' });
  assert.deepEqual([f.status, f.headers.location, f.text], [303, `/p/${token}`, '']);
  assert.deepEqual([one(db, 'missions', 'm1').dispoDemandes[0].statut, one(db, 'missions', 'm1').dispoDemandes[0].canal], ['non', 'portail']);
  assert.deepEqual(one(db, 'vehicules', 'v1').dispos, [{ du: '2026-11-10', au: '2026-11-22' }], '« non » ne touche pas aux jours déclarés');
  assert.deepEqual(net.graphCalls.filter((c) => c.body.to === '33600000002')[0].body.template.components[0].parameters[1].text, 'Classe V : pas disponible');
  // Sans responsable : Amel. Demande close entre-temps : plus de réponse possible.
  await put(cookie, 'missions', 'm5', { titre: 'Sans responsable', clientId: 'c1', statut: 'nouvelle', debut: '2026-12-10T10:00', fin: '2026-12-11T10:00' });
  await post('/api/missions/m5/dispo', { vehiculeId: 'v1' }, { cookie });
  net.calls.length = 0;
  await post(`/api/portail/${token}/demandes/m5`, { vehiculeId: 'v1', reponse: 'oui' });
  assert.deepEqual(net.graphCalls.map((c) => c.body.to), ['33600000001']);
  await put(cookie, 'missions', 'm6', { titre: 'Perdue', clientId: 'c1', statut: 'nouvelle', debut: '2026-12-15T10:00' });
  await post('/api/missions/m6/dispo', { vehiculeId: 'v1' }, { cookie });
  await put(cookie, 'missions', 'm6', { ...Object.fromEntries(Object.entries(one(db, 'missions', 'm6')).filter(([k]) => !k.startsWith('_'))), statut: 'perdue' });
  assert.equal((await post(`/api/portail/${token}/demandes/m6`, { vehiculeId: 'v1', reponse: 'oui' })).status, 404);
  assert.ok(!(await get(`/api/portail/${token}`)).json.demandes.some((d) => d.missionId === 'm6'));
});

test('WhatsApp d’un prestataire : « oui » / « non » appliqués à la demande en attente la plus récente, accusé, ni client ni demande créés', async () => {
  const { db, net } = fresh({ TEAM_ALERT_NUMBERS: 'amel:33600000001', ANTHROPIC_API_KEY: 'sk-ant-test' });
  net.anthropic(() => { throw new Error('aucun appel IA attendu pour un prestataire'); });
  at(DAY);
  const cookie = await login();
  await decor(cookie);
  await put(cookie, 'vehicules', 'v2', { nom: 'Range Rover', partenaireId: 'p1', dispos: [{ du: '2026-12-01', au: '2026-12-02' }] });
  await put(cookie, 'missions', 'm2', { titre: 'Range', clientId: 'c1', statut: 'nouvelle', service: 'location', debut: '2026-12-03T09:00', fin: '2026-12-04T19:00' });
  await post('/api/missions/m1/dispo', { vehiculeId: 'v1' }, { cookie });
  at('2026-11-03T10:05:00Z');
  await post('/api/missions/m2/dispo', { vehiculeId: 'v2' }, { cookie });
  const avant = { clients: db.dump('clients').length, missions: db.dump('missions').length };
  // « Oui » → la plus récente (m2 / Range Rover).
  net.calls.length = 0;
  at('2026-11-03T10:10:00Z');
  const r = await postWebhook(inboundPayload({ from: TEL, name: 'Karim B.', id: 'wamid.oui', text: ' OUI 👍' }));
  assert.equal(r.status, 200);
  assert.deepEqual(one(db, 'missions', 'm2').dispoDemandes[0], { vehiculeId: 'v2', partenaireId: 'p1', statut: 'oui', envoyeAt: '2026-11-03T10:05:00.000Z', canal: 'whatsapp', par: 'amel', reponduAt: '2026-11-03T10:10:00.000Z' });
  assert.equal(one(db, 'missions', 'm1').dispoDemandes[0].statut, 'envoyee', 'l’autre demande attend toujours');
  assert.deepEqual(one(db, 'vehicules', 'v2').dispos, [{ du: '2026-12-01', au: '2026-12-04' }]);
  const versLui = texts(net, TEL);
  assert.deepEqual(versLui.map((c) => c.body.text.body), ['Merci, c’est noté : Range Rover disponible du 3 décembre au 4 décembre 2026.'], 'un accusé, pas de réponse automatique jour/nuit');
  assert.match(texts(net, '33600000001')[0].body.template.components[0].parameters[1].text, /^Range Rover : disponible$/);
  assert.equal(net.anthropicCalls.length, 0, 'pas d’extraction IA');
  assert.deepEqual({ clients: db.dump('clients').length, missions: db.dump('missions').length }, avant, 'ni client ni demande créés');
  let conv = one(db, 'conversations', TEL);
  assert.deepEqual([conv.partenaireId, conv.nom, conv.clientId, conv.missionId, conv.equipe, conv.unread, conv.alerte6hFor], ['p1', 'Luxe Cars', undefined, undefined, undefined, 1, 'wamid.oui']);
  const ack = db.dump('messages').find((x) => x.dir === 'out' && x.by === 'auto');
  assert.equal(ack.text, 'Merci, c’est noté : Range Rover disponible du 3 décembre au 4 décembre 2026.');
  assert.ok(db.dump('activity').some((a) => a.resume === 'Luxe Cars : Range Rover disponible du 3 décembre au 4 décembre 2026 (réponse par WhatsApp)'));
  // Webhook rejoué par Meta : rien de plus.
  net.calls.length = 0;
  assert.equal((await postWebhook(inboundPayload({ from: TEL, name: 'Karim B.', id: 'wamid.oui', text: ' OUI 👍' }))).json.duplicates, 1);
  assert.equal(net.graphCalls.length, 0);
  // Bouton « Non » du modèle → la demande restante (m1 / Classe V).
  at('2026-11-03T10:20:00Z');
  await postWebhook(inboundPayload({ from: TEL, name: 'Karim B.', id: 'wamid.non', type: 'button', extra: { button: { text: 'Non', payload: 'Non' }, context: { id: 'wamid.OUT1' } } }));
  assert.deepEqual([one(db, 'missions', 'm1').dispoDemandes[0].statut, one(db, 'missions', 'm1').dispoDemandes[0].canal], ['non', 'whatsapp']);
  assert.equal(one(db, 'vehicules', 'v1').dispos, undefined, '« non » n’ajoute aucun jour');
  assert.equal(texts(net, TEL).at(-1).body.text.body, 'Merci, c’est noté : Classe V pas disponible du 20 novembre au 22 novembre 2026.');
  // Plus rien en attente : « oui » redevient un message normal ; un texte libre aussi. Jamais de client ni de demande.
  net.calls.length = 0;
  at('2026-11-03T10:30:00Z');
  await postWebhook(inboundPayload({ from: TEL, name: 'Karim B.', id: 'wamid.oui2', text: 'oui' }));
  await postWebhook(inboundPayload({ from: TEL, name: 'Karim B.', id: 'wamid.libre', text: 'Oui je peux aussi vous proposer un Vito la semaine prochaine' }));
  assert.equal(texts(net, TEL).length, 0, 'ni accusé ni réponse automatique');
  assert.deepEqual([one(db, 'missions', 'm1').dispoDemandes[0].statut, one(db, 'missions', 'm2').dispoDemandes[0].statut], ['non', 'oui']);
  assert.deepEqual({ clients: db.dump('clients').length, missions: db.dump('missions').length }, avant);
  conv = one(db, 'conversations', TEL);
  assert.deepEqual([conv.unread, conv.lastText, conv.partenaireId], [4, 'Oui je peux aussi vous proposer un Vito la semaine prochaine', 'p1']);
  assert.equal(db.dump('messages').filter((x) => x.convId === TEL && x.dir === 'in').length, 4, 'tous les messages sont gardés, lus par l’équipe');
  // Variantes reconnues, casse et accents indifférents ; le reste n'est pas une réponse.
  const { lireReponse } = await import('../src/lib/portail.js');
  for (const t of ['oui', 'OUI', 'Oui.', 'ok', 'Dispo', 'disponible', 'Oui, disponible', 'OK 👍']) assert.equal(lireReponse(t), 'oui', t);
  for (const t of ['non', 'NON !', 'Pas dispo', 'pas disponible', 'Indisponible', 'indispo']) assert.equal(lireReponse(t), 'non', t);
  for (const t of ['', 'oui mais seulement le matin', 'non pas avant lundi prochain', 'Bonjour', 'disponible à partir du 5', '[Photo] oui']) assert.equal(lireReponse(t), null, t);
});

test('WhatsApp : un partenaire quelconque n’est jamais un client ; une inscription non validée ne détourne pas le numéro d’un client', async () => {
  const { db, net } = fresh({ TEAM_ALERT_NUMBERS: 'amel:33600000001' });
  at(DAY);
  const cookie = await login();
  // Chauffeur du carnet : pas de client, pas de demande, pas de réponse automatique ; l'équipe est prévenue.
  await put(cookie, 'partenaires', 'ch1', { nom: 'Karim Chauffeur', type: 'chauffeur', tel: '+33600000099' });
  await postWebhook(inboundPayload({ from: '33600000099', name: 'Karim', id: 'w1', text: 'oui' }));
  assert.equal(db.dump('clients').length + db.dump('missions').length, 0);
  assert.equal(one(db, 'conversations', '33600000099').partenaireId, 'ch1');
  assert.equal(texts(net, '33600000099').length, 0);
  assert.match(texts(net, '33600000001')[0].body.template.components[0].parameters[0].text, /^Karim Chauffeur$/);
  // Loueur inscrit par le formulaire, pas encore validé, numéro inconnu : traité en partenaire, sans « oui/non ».
  await post('/api/prestataires/inscription', { nom: 'Nadia Vans', tel: '06 22 33 44 55' });
  await postWebhook(inboundPayload({ from: '33622334455', name: 'Nadia', id: 'w2', text: 'Bonjour, avez-vous reçu mon inscription ?' }));
  assert.equal(db.dump('clients').length + db.dump('missions').length, 0);
  assert.equal(texts(net, '33622334455').length, 0);
  // Quelqu'un inscrit le numéro d'un client existant : le client reste un client (demande créée, réponse automatique).
  await put(cookie, 'clients', 'vip', { nom: 'M. Al Thani', tel: '+971501234567' });
  assert.deepEqual((await post('/api/prestataires/inscription', { nom: 'Faux loueur', tel: '+971 50 123 4567' }, { ip: '198.51.100.9' })).json, { ok: true });
  assert.equal(db.dump('partenaires').filter((p) => p.telNorm === '971501234567' && p.aValider).length, 1);
  await postWebhook(inboundPayload({ from: '971501234567', name: 'Al Thani', id: 'w3', text: 'Hello, I need a car tomorrow' }));
  assert.equal(db.dump('missions').length, 1);
  assert.equal(db.dump('missions')[0].clientId, 'vip');
  assert.equal(one(db, 'conversations', '971501234567').partenaireId, undefined);
  assert.equal(texts(net, '971501234567').length, 1, 'réponse automatique au client');
  // Partenaire supprimé : son numéro redevient un numéro ordinaire, la marque de la conversation tombe.
  await call(H.doc, { method: 'DELETE', url: '/api/doc/partenaires/ch1', cookie });
  at('2026-11-03T11:00:00Z');
  await postWebhook(inboundPayload({ from: '33600000099', name: 'Karim', id: 'w4', text: 'Bonjour, une voiture pour samedi' }));
  assert.equal(one(db, 'conversations', '33600000099').partenaireId, undefined);
  assert.equal(db.dump('missions').length, 2);
});

test('inscription publique : champ piège, limite de débit, validations, doublon de numéro sans fuite, même origine', async () => {
  const { db, net } = fresh({ TEAM_ALERT_NUMBERS: 'amel:33600000001' });
  const t = at(DAY);
  const ins = (body, opts = {}) => post('/api/prestataires/inscription', body, opts);
  // Champ piège : réponse normale, rien n'est créé, rien n'est compté.
  const bot = await ins({ nom: 'Bot', tel: '0611111111', website: 'http://spam.example' });
  assert.deepEqual([bot.status, bot.json], [200, { ok: true }]);
  assert.equal(db.dump('partenaires').length, 0);
  assert.equal(net.graphCalls.length, 0);
  // Validations (chacune depuis une autre IP pour ne pas toucher la limite).
  const cas = [
    [{ nom: 'Sans téléphone' }, 'tel_requis'], [{ nom: 'X', tel: '12' }, 'tel_invalide'], [{ nom: 'X', tel: 'abc' }, 'tel_invalide'], [{ nom: 'X', tel: 612345678 }, 'tel_requis'],
    [{ tel: '0612345678' }, 'nom_requis'], [{ nom: 'X', tel: '0612345678', email: 'pas-un-email' }, 'email_invalide'], [{ nom: 'X', tel: '0612345678', siren: '1234' }, 'siren_invalide'],
  ];
  for (const [i, [body, code]] of cas.entries()) {
    const r = await ins(body, { ip: '198.51.100.' + i });
    assert.deepEqual([r.status, r.json.error], [400, code], JSON.stringify(body));
  }
  assert.match((await ins({ nom: 'X', tel: '12' }, { ip: '198.51.100.20' })).json.message, /^Numéro de téléphone invalide\.$/);
  assert.equal((await call(H.doc, { method: 'POST', url: '/api/prestataires/inscription', raw: '{oops', ip: '198.51.100.21' })).status, 400);
  assert.equal((await call(H.doc, { method: 'POST', url: '/api/prestataires/inscription', raw: JSON.stringify({ nom: 'X', tel: '0612345678', message: 'm'.repeat(20000) }), ip: '198.51.100.22' })).status, 413);
  assert.equal((await get('/api/prestataires/inscription')).status, 405);
  assert.equal(db.dump('partenaires').length, 0);
  // Même origine seulement, aucun en-tête CORS.
  const cross = await ins({ nom: 'X', tel: '0612345678' }, { ip: '198.51.100.23', headers: { origin: 'https://autre-site.example' } });
  assert.equal(cross.status, 403);
  const same = await ins({ nom: 'Premier', tel: '06 12 34 56 78', message: 'm'.repeat(5000), vehicules: 'v'.repeat(5000) }, { ip: '198.51.100.24', headers: { origin: 'https://amane.test' } });
  assert.equal(same.status, 200);
  assert.equal(same.headers['access-control-allow-origin'], undefined);
  assert.equal(same.headers['x-robots-tag'], 'noindex, nofollow');
  const [p] = db.dump('partenaires');
  assert.deepEqual([p.nom, p.contact, p.societe, p.siren, p.inscription.message.length, p.inscription.vehicules.length], ['Premier', 'Premier', undefined, undefined, 2000, 1000], 'tailles bornées');
  // Doublon de numéro (autre écriture du même numéro) : même réponse, rien de créé, pas de nouvelle alerte.
  net.calls.length = 0;
  const dup = await ins({ societe: 'Un autre nom', nom: 'Curieux', tel: '+33 (0)6 12 34 56 78' }, { ip: '198.51.100.25' });
  assert.deepEqual([dup.status, dup.text], [same.status, same.text], 'pas de fuite d’existence');
  assert.equal(db.dump('partenaires').length, 1);
  assert.equal(one(db, 'partenaires', p._id).nom, 'Premier', 'la fiche existante n’est pas touchée');
  assert.equal(net.graphCalls.length, 0);
  // Idem si le numéro est celui d'un partenaire du carnet (chauffeur, déjà validé…).
  const cookie = await login();
  await put(cookie, 'partenaires', 'ch1', { nom: 'Karim', type: 'chauffeur', tel: '+33600000099' });
  assert.deepEqual((await ins({ nom: 'Karim loueur', tel: '06 00 00 00 99' }, { ip: '198.51.100.26' })).json, { ok: true });
  assert.equal(db.dump('partenaires').length, 2);
  // Limite : 5 envois par heure et par IP.
  for (let i = 0; i < 5; i++) assert.equal((await ins({ nom: 'N' + i, tel: '06000001' + String(i).padStart(2, '0') }, { ip: '203.0.113.50' })).status, 200);
  const sixieme = await ins({ nom: 'N6', tel: '0600000199' }, { ip: '203.0.113.50' });
  assert.deepEqual([sixieme.status, sixieme.json.error], [429, 'trop_de_tentatives']);
  assert.equal((await ins({ nom: 'Autre IP', tel: '0600000198' }, { ip: '203.0.113.51' })).status, 200);
  at(new Date(t + 61 * 60 * 1000).toISOString());
  assert.equal((await ins({ nom: 'Plus tard', tel: '0600000197' }, { ip: '203.0.113.50' })).status, 200);
  assert.equal(db.dump('partenaires').length, 9);
  assert.ok(db.dump('partenaires').filter((x) => x.type === 'loueur').every((x) => x.aValider === true && !x.portailToken), 'aucun accès sans validation');
  // Formulaire classique (sans JavaScript) : page de confirmation, erreurs lisibles.
  const f = await form('/api/prestataires/inscription', { societe: 'Sans Script SARL', nom: 'Léa', tel: '06 77 88 99 00', email: '', siren: '', vehicules: 'Un Vito', message: '', website: '' }, { ip: '203.0.113.60' });
  assert.equal(f.status, 200);
  assert.match(f.headers['content-type'], /^text\/html/);
  assert.ok(f.text.includes('Merci, nous revenons vers vous sous 48 h.'));
  assert.equal(db.dump('partenaires').find((x) => x.telNorm === '33677889900').nom, 'Sans Script SARL');
  const ferr = await form('/api/prestataires/inscription', { nom: '<b>Léa</b>', tel: '12' }, { ip: '203.0.113.60' });
  assert.equal(ferr.status, 400);
  assert.ok(ferr.text.includes('Numéro de téléphone invalide.') && ferr.text.includes('href="/prestataires"') && !ferr.text.includes('<b>'));
});

test('limite de débit du portail par IP', async () => {
  fresh();
  const t = at(DAY);
  const cookie = await login();
  const token = await loueur(cookie);
  for (let i = 0; i < 240; i++) await call(H.doc, { url: `/api/portail/${'z'.repeat(24)}`, ip: '203.0.113.77', noDrain: true });
  const r = await get(`/api/portail/${token}`, { ip: '203.0.113.77' });
  assert.deepEqual([r.status, r.json.error], [429, 'trop_de_tentatives']);
  assert.equal((await get(`/p/${token}`, { ip: '203.0.113.77' })).status, 429);
  assert.equal((await get(`/api/portail/${token}`, { ip: '203.0.113.78' })).status, 200, 'une autre IP n’est pas touchée');
  at(new Date(t + 61 * 60 * 1000).toISOString());
  assert.equal((await get(`/api/portail/${token}`, { ip: '203.0.113.77' })).status, 200);
});

test('rentabilité : véhicule d’un prestataire → coûts = prix d’achat par jour × jours loués, partenaireId dans la réponse', async () => {
  fresh();
  at(DAY);
  const cookie = await login();
  await loueur(cookie);
  await put(cookie, 'clients', 'c1', { nom: 'A' });
  await put(cookie, 'vehicules', 'v1', { nom: 'Classe V', categorie: 'Van', partenaireId: 'p1', prixAchatJour: 250, tarifJour: 600, loyerMois: 999, chargesMois: 111, ordre: 6 });
  await put(cookie, 'missions', 'm1', { titre: 'Van', clientId: 'c1', statut: 'terminee', service: 'van', vehiculeId: 'v1', debut: '2026-10-30T10:00', fin: '2026-11-03T18:00', montant: 3000 });
  await put(cookie, 'missions', 'm2', { titre: 'Van 2', clientId: 'c1', statut: 'confirmee', service: 'van', vehiculeId: 'v1', debut: '2026-11-20T10:00', fin: '2026-11-21T18:00', montant: 1200 });
  await put(cookie, 'missions', 'm3', { titre: 'Urus', clientId: 'c1', statut: 'confirmee', service: 'location', vehiculeId: 'urus', debut: '2026-11-10T10:00', fin: '2026-11-10T18:00', montant: 1000 });
  const r = await call(H.sync, { url: '/api/flotte/rentabilite?mois=2026-11', cookie });
  assert.equal(r.status, 200);
  const v = r.json.vehicules.find((x) => x.id === 'v1');
  assert.deepEqual(
    { partenaireId: v.partenaireId, joursLoues: v.joursLoues, missions: v.missions, ca: v.ca, loyer: v.loyer, charges: v.charges, couts: v.couts, prixAchatJour: v.prixAchatJour, margeNette: v.margeNette },
    { partenaireId: 'p1', joursLoues: 5, missions: 2, ca: 3000, loyer: 0, charges: 0, couts: 1250, prixAchatJour: 250, margeNette: 1750 },
    '3 jours de m1 en novembre (3 000 × 3/5) + 2 jours de m2 ; 250 € × 5 jours, ni loyer ni charges',
  );
  const u = r.json.vehicules.find((x) => x.id === 'urus');
  assert.deepEqual([u.partenaireId, u.loyer, u.charges, u.couts, u.margeNette], ['', 2430, 500, 2930, 1000 - 2930], 'véhicule de la maison : inchangé');
  assert.equal(r.json.total.couts, r.json.vehicules.reduce((x, l) => x + l.couts, 0));
  assert.equal(r.json.total.margeNette, Math.round(r.json.vehicules.reduce((x, l) => x + l.margeNette, 0) * 100) / 100);
});
