// Relances : vue unique, envoi en un geste (fenêtre de 24 h ou modèle), jamais deux fois, historique par fiche.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, call, H, login, at } from './helpers.js';

const NOW = '2026-11-08T09:00:00Z';
const put = (cookie, col, id, body) => call(H.doc, { method: 'PUT', url: `/api/doc/${col}/${id}`, body, cookie });
const list = async (cookie) => Object.fromEntries((await call(H.sync, { url: '/api/relances', cookie })).json.items.map((x) => [x.key, x]));
const envoyer = (cookie, key, extra = {}) => call(H.sync, { method: 'POST', url: '/api/relances/envoyer', cookie, body: { key, ...extra } });
const openConv = (db, phone, extra = {}) => db.collection('conversations').insertOne({ _id: phone, phone, nom: 'x', windowUntil: new Date(Date.parse(NOW) + 3600000).toISOString(), lastInAt: '2026-11-01T10:00:00Z', ...extra });

async function base(env) {
  const ctx = fresh(env);
  at('2026-11-01T10:00:00Z');
  const cookie = await login('amel');
  await put(cookie, 'clients', 'c1', { nom: 'John Smith', tel: '+447700900123', langue: 'EN' });
  await put(cookie, 'clients', 'c2', { nom: 'Jean Dupont', tel: '+33612345678', langue: 'FR' });
  await put(cookie, 'partenaires', 'p1', { nom: 'Karim Benali', contact: 'Karim', type: 'chauffeur', tel: '+33611223344', langues: 'FR' });
  await put(cookie, 'vehicules', 'urus', { nom: 'Urus SE', ordre: 1 });
  // Devis envoyé par lien le 1er novembre, demande restée « nouvelle ».
  await put(cookie, 'missions', 'm1', { titre: 'Urus week-end', clientId: 'c1', statut: 'nouvelle', service: 'location', debut: '2026-11-28T10:00', devis: { numero: 'D-2026-0004', statut: 'envoye', sentAt: '2026-11-01T10:00:00Z', lignes: [{ d: 'Urus', q: 2, u: 'jour', pu: 1000 }] } });
  at(NOW);
  // Mission terminée avec un solde ; mission dans 3 jours avec chauffeur non confirmé.
  await put(cookie, 'missions', 'm2', { titre: 'Van aéroport', clientId: 'c2', statut: 'terminee', service: 'van', debut: '2026-11-04T08:00', fin: '2026-11-05T20:00', montant: 900, acompte: 300 });
  await put(cookie, 'missions', 'm3', { titre: 'Chauffeur mardi', clientId: 'c2', statut: 'confirmee', service: 'chauffeur', vehiculeId: 'urus', chauffeurId: 'p1', debut: '2026-11-11T10:00', fin: '2026-11-11T18:00', montant: 1200, acompte: 400 });
  return { ...ctx, cookie };
}

test('vue unique : devis sans réponse, solde, confirmation de prestataire, avec clé stable et fenêtre de 24 h', async () => {
  const { db, cookie } = await base();
  await openConv(db, '33612345678');
  const by = await list(cookie);
  assert.deepEqual(Object.keys(by).sort(), ['prestataire:m3:p1', 'proposition:m1', 'solde:m2']);
  const dv = by['proposition:m1'];
  assert.equal(dv.cible, 'client');
  assert.match(dv.raison, /^Devis D-2026-0004 « Urus week-end » sans réponse depuis 6 j$/);
  assert.equal(dv.fenetre, false);
  assert.equal(dv.derniere, null);
  const so = by['solde:m2'];
  assert.match(so.raison.replace(/[  ]/g, ' '), /^Solde de 600,00 € à régler, mission terminée depuis 2 j$/);
  assert.equal(so.fenetre, true);
  assert.match(so.messageSuggere.replace(/[  ]/g, ' '), /^Bonjour Jean, merci encore pour Van aéroport\. Sauf erreur de notre part, un solde de 600,00 € reste à régler/);
  const pr = by['prestataire:m3:p1'];
  assert.deepEqual([pr.cible, pr.partenaireId, pr.clientId, pr.nom, pr.tel], ['prestataire', 'p1', 'c2', 'Karim Benali', '+33611223344']);
  assert.match(pr.raison, /^Chauffeur non confirmé — Chauffeur mardi, dans 3 j$/);
  assert.match(pr.messageSuggere, /^Bonjour Karim, pouvez-vous nous confirmer la mission du mercredi 11 novembre, 10:00 \(Chauffeur VIP — Urus SE\) \?/);
  assert.ok(!/api\/prestataire/.test(pr.messageSuggere), 'pas de lien tant que l’espace n’existe pas');

  await call(H.doc, { method: 'POST', url: '/api/partenaires/p1/espace', cookie });
  assert.match((await list(cookie))['prestataire:m3:p1'].messageSuggere, /\nVos missions et nos disponibilités : https:\/\/amane\.test\/api\/prestataire\/[A-Za-z0-9_-]{24}$/);

  // Prestataire sur une seule étape d'un séjour : son créneau à lui, pas le début du séjour.
  await put(cookie, 'partenaires', 'p2', { nom: 'Lasserre', contact: 'Maître d’hôtel', type: 'restaurant', tel: '+33143590213' });
  await put(cookie, 'missions', 'm6', { titre: 'Séjour Smith', clientId: 'c1', statut: 'encours', service: 'sejour', debut: '2026-11-07T10:00', fin: '2026-11-14T10:00', programme: [{ dt: '2026-11-07T20:00', type: 'restaurant', partenaireId: 'p2', lieu: 'Lasserre' }, { dt: '2026-11-09T20:30', type: 'restaurant', partenaireId: 'p2', lieu: 'Lasserre' }] });
  const step = (await list(cookie))['prestataire:m6:p2'];
  assert.match(step.raison, /^Prestation non confirmée — Séjour Smith, dans 2 j$/);
  assert.match(step.messageSuggere, /la mission du lundi 9 novembre, 20:30 \(Restaurant — Lasserre\)/);

  // Le client a écrit après l'envoi du devis : plus de relance « devis ».
  await db.collection('conversations').insertOne({ _id: '447700900123', phone: '447700900123', lastInAt: '2026-11-05T10:00:00Z' });
  assert.equal((await list(cookie))['proposition:m1'], undefined);
  // Le chauffeur confirme : plus de relance prestataire.
  await call(H.doc, { method: 'POST', url: '/api/missions/m3/confirmation', cookie, body: { partenaireId: 'p1' } });
  assert.equal((await list(cookie))['prestataire:m3:p1'], undefined);
  assert.equal((await call(H.sync, { url: '/api/relances?type=solde', cookie })).json.items.length, 1);
});

test('envoi en un geste : texte dans la fenêtre, puis bloqué pendant le délai (jamais deux fois), à nouveau possible ensuite', async () => {
  const { db, net, cookie } = await base();
  await openConv(db, '33612345678');
  const r = await envoyer(cookie, 'solde:m2');
  assert.equal(r.status, 200);
  assert.equal(r.json.canal, 'texte');
  assert.equal(net.graphCalls.length, 1);
  assert.equal(net.graphCalls[0].body.type, 'text');
  assert.match(net.graphCalls[0].body.text.body, /^Bonjour Jean, merci encore pour Van aéroport/);
  assert.deepEqual([r.json.relance.id, r.json.relance.statut, r.json.relance.by, r.json.relance.missionId, r.json.relance.clientId], ['solde:m2#1', 'envoye', 'amel', 'm2', 'c2']);
  const msg = db.dump('messages').find((m) => m.dir === 'out');
  assert.deepEqual([msg.relance, msg.relanceKey, msg.missionId], ['solde', 'solde:m2', 'm2']);
  assert.ok(db.dump('activity').some((a) => a.docId === 'm2' && a.action === 'relance' && a.resume === 'Relance envoyée par WhatsApp — Solde à régler'));

  const again = await envoyer(cookie, 'solde:m2');
  assert.equal(again.status, 409);
  assert.equal(again.json.error, 'deja_relance');
  assert.match(again.json.message, /^Déjà relancé dimanche 8 novembre par Amel\./);
  assert.equal(net.graphCalls.length, 1, 'aucun second envoi');
  const it = (await list(cookie))['solde:m2'];
  assert.equal(it.derniere.id, 'solde:m2#1');
  assert.equal(it.bloqueeJusqua, '2026-11-13T09:00:00.000Z', 'délai de 5 jours pour un solde');
  assert.equal((await call(H.sync, { method: 'POST', url: '/api/relances/marquer', cookie, body: { key: 'solde:m2' } })).status, 409);

  at('2026-11-13T09:01:00Z');
  await db.collection('conversations').updateOne({ _id: '33612345678' }, { $set: { windowUntil: '2026-11-13T12:00:00.000Z' } });
  const r2 = await envoyer(cookie, 'solde:m2', { texte: 'Bonjour Jean, petit rappel pour le solde. Amel' });
  assert.equal(r2.status, 200);
  assert.equal(r2.json.relance.id, 'solde:m2#2');
  assert.equal(net.graphCalls.at(-1).body.text.body, 'Bonjour Jean, petit rappel pour le solde. Amel', 'texte modifié par l’équipe');
});

test('hors fenêtre : modèle approuvé amane_relance dans la langue du client ; conversation créée si besoin', async () => {
  const { db, net, cookie } = await base();
  const r = await envoyer(cookie, 'proposition:m1');
  assert.equal(r.status, 200);
  assert.equal(r.json.canal, 'modele');
  const b = net.graphCalls[0].body;
  assert.equal(b.type, 'template');
  assert.equal(b.template.name, 'amane_relance');
  assert.equal(b.template.language.code, 'en');
  assert.deepEqual(b.template.components[0].parameters.map((p) => p.text), ['John', 'Urus week-end']);
  const conv = db.dump('conversations').find((c) => c._id === '447700900123');
  assert.deepEqual([conv.clientId, conv.nom], ['c1', 'John Smith']);
  assert.ok(db.dump('activity').some((a) => a.docId === 'm1' && /modèle approuvé, hors fenêtre de 24 h/.test(a.resume)));
});

test('relance prestataire : lien de l’espace dans le texte, trace sur la mission et la fiche du partenaire', async () => {
  const { db, net, cookie } = await base();
  await call(H.doc, { method: 'POST', url: '/api/partenaires/p1/espace', cookie });
  await openConv(db, '33611223344');
  const r = await envoyer(cookie, 'prestataire:m3:p1');
  assert.equal(r.status, 200);
  assert.match(net.graphCalls[0].body.text.body, /\nVos missions et nos disponibilités : https:\/\/amane\.test\/api\/prestataire\//);
  assert.equal(r.json.relance.partenaireId, 'p1');
  const acts = db.dump('activity').filter((a) => a.action === 'relance');
  assert.deepEqual(acts.map((a) => a.docId).sort(), ['m3', 'p1']);
  assert.equal((await envoyer(cookie, 'prestataire:m3:p1')).status, 409);
  const h = await call(H.sync, { url: '/api/relances/historique?partenaireId=p1', cookie });
  assert.deepEqual(h.json.items.map((x) => [x.id, x.canal]), [['prestataire:m3:p1#1', 'texte']]);
});

test('deux personnes appuient en même temps : un seul message part', async () => {
  const { db, net, cookie } = await base();
  await openConv(db, '33612345678');
  const yc = await login('youssouf');
  const [a, b] = await Promise.all([envoyer(cookie, 'solde:m2'), envoyer(yc, 'solde:m2')]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(net.graphCalls.length, 1);
  assert.equal(db.dump('relances').length, 1);
});

test('échec d’envoi : trace « echec », nouvel essai possible sur la même relance', async () => {
  const { db, net, cookie } = await base();
  await openConv(db, '33612345678');
  net.graph(() => ({ status: 500, json: { error: { message: 'Service temporarily unavailable', code: 2 } } }));
  const r = await envoyer(cookie, 'solde:m2');
  assert.equal(r.status, 502);
  assert.equal(db.dump('relances')[0].statut, 'echec');
  assert.equal((await list(cookie))['solde:m2'].bloqueeJusqua, undefined, 'un échec ne bloque pas');
  net.graph(() => ({ status: 200, json: { messages: [{ id: 'wamid.retry' }] } }));
  const ok = await envoyer(cookie, 'solde:m2');
  assert.equal(ok.status, 200);
  assert.equal(ok.json.relance.id, 'solde:m2#1', 'même trace reprise');
  assert.equal(ok.json.relance.erreur, undefined);
  assert.equal(db.dump('relances').length, 1);
});

test('relance faite hors CRM, WhatsApp non relié, erreurs de saisie, historique par fiche', async () => {
  const { db, cookie } = await base({ WHATSAPP_TOKEN: undefined });
  assert.equal((await envoyer(cookie, 'solde:m2')).json.error, 'whatsapp_off');
  const m = await call(H.sync, { method: 'POST', url: '/api/relances/marquer', cookie, body: { key: 'solde:m2', note: 'Appelé, virement demain' } });
  assert.equal(m.status, 200);
  assert.deepEqual([m.json.relance.statut, m.json.relance.canal, m.json.relance.texte], ['manuel', 'manuel', 'Appelé, virement demain']);
  assert.ok(db.dump('activity').some((a) => a.docId === 'm2' && a.resume === 'Relance notée (faite hors CRM) — Solde à régler : Appelé, virement demain'));
  assert.ok((await list(cookie))['solde:m2'].bloqueeJusqua);
  assert.equal((await envoyer(cookie, 'inconnue:zz')).status, 503, 'WhatsApp vérifié d’abord');
  assert.equal((await call(H.sync, { method: 'POST', url: '/api/relances/marquer', cookie, body: { key: 'solde:m404' } })).status, 404);
  assert.equal((await call(H.sync, { method: 'POST', url: '/api/relances/marquer', cookie, body: { key: '../x' } })).status, 400);
  assert.equal((await call(H.sync, { method: 'POST', url: '/api/relances/marquer', body: { key: 'solde:m2' } })).status, 401);

  const hc = await call(H.sync, { url: '/api/relances/historique?clientId=c2', cookie });
  assert.deepEqual(hc.json.items.map((x) => x.id), ['solde:m2#1']);
  assert.deepEqual((await call(H.sync, { url: '/api/relances/historique?missionId=m2', cookie })).json.items.map((x) => x.statut), ['manuel']);
  assert.equal((await call(H.sync, { url: '/api/relances/historique', cookie })).status, 400);
});

test('rappel automatique d’acompte : pas envoyé si l’équipe vient de relancer l’acompte', async () => {
  const { db, net, cookie } = await base({ INTERNAL_KEY: 'cle-interne-longue' });
  await put(cookie, 'missions', 'm5', { titre: 'G 63 jeudi', clientId: 'c2', statut: 'confirmee', service: 'location', debut: '2026-11-10T10:00', montant: 1000 });
  await openConv(db, '33612345678');
  const by = await list(cookie);
  assert.ok(by['acompte:m5']);
  assert.equal((await envoyer(cookie, 'acompte:m5')).status, 200);
  const run = await call(H.sync, { method: 'POST', url: '/api/rappels/run', headers: { 'x-internal-key': 'cle-interne-longue' } });
  assert.equal(run.status, 200);
  assert.ok(!db.dump('messages').some((x) => x.rappel === 'acompte'), 'aucun doublon automatique');
  assert.ok(net.graphCalls.length >= 1);
  const rp = db.dump('rappels').find((r) => r._id === 'acompte:m5');
  assert.deepEqual([rp.statut, rp.erreur], ['ignore', 'Acompte déjà relancé par l’équipe.']);
});
