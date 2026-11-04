import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, call, H, login, at, postWebhook, inboundPayload, statusPayload, claudeResponse, BASE_ENV, sign } from './helpers.js';
import { AI_MODEL } from '../src/lib/ai.js';

const DAY = '2026-11-03T10:00:00Z'; // 11 h à Paris
const NIGHT = '2026-11-03T22:30:00Z'; // 23 h 30 à Paris
const GRAPH_URL = `https://graph.facebook.com/v21.0/${BASE_ENV.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const quiet = async (fn) => { const e = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = e; } };

test('GET : vérification du webhook par Meta', async () => {
  fresh();
  const ok = await call(H.whatsapp, { url: '/api/whatsapp?hub.mode=subscribe&hub.verify_token=verif-amane&hub.challenge=1158201444' });
  assert.equal(ok.status, 200);
  assert.equal(ok.text, '1158201444');
  assert.match(ok.headers['content-type'], /^text\/plain/);
  const bad = await call(H.whatsapp, { url: '/api/whatsapp?hub.mode=subscribe&hub.verify_token=faux&hub.challenge=1' });
  assert.equal(bad.status, 403);
});

test('POST : signature absente ou fausse → 401, rien n’est écrit', async () => {
  const { db, net } = fresh();
  const p = inboundPayload({ text: 'Bonjour' });
  assert.equal((await postWebhook(p, { secret: 'mauvais-secret' })).status, 401);
  assert.equal((await postWebhook(p, { signature: '' })).status, 401);
  assert.equal((await postWebhook(p, { signature: 'sha256=zz' })).status, 401);
  const raw = JSON.stringify(p);
  const tampered = await call(H.whatsapp, { method: 'POST', url: '/api/whatsapp', raw: raw.replace('Bonjour', 'Bonsoir'), headers: { 'x-hub-signature-256': sign(raw) } });
  assert.equal(tampered.status, 401);
  assert.equal(db.dump('messages').length, 0);
  assert.equal(net.calls.length, 0);
});

test('message réel entrant → conversation, client, demande, réponse automatique exacte', async () => {
  const { db, net } = fresh();
  const t = at(DAY);
  const r = await postWebhook(inboundPayload({ name: 'Jean Dupont', text: 'Bonjour, je voudrais une Urus pour ce week-end, livrée au George V.', ts: t - 3000 }));
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);

  const conv = db.dump('conversations')[0];
  assert.equal(conv._id, '33612345678');
  assert.equal(conv.phone, '33612345678');
  assert.equal(conv.nom, 'Jean Dupont');
  assert.equal(conv.lang, 'FR');
  assert.equal(conv.lastDir, 'out', 'la réponse automatique est le dernier message');
  assert.equal(conv.unread, 1);
  assert.equal(conv.windowUntil, new Date(t - 3000 + 24 * 3600 * 1000).toISOString());

  const [client] = db.dump('clients');
  assert.deepEqual(
    { nom: client.nom, tel: client.tel, telNorm: client.telNorm, canal: client.canal, statut: client.statut, langue: client.langue, responsable: client.responsable, updatedBy: client.updatedBy },
    { nom: 'Jean Dupont', tel: '+33612345678', telNorm: '33612345678', canal: 'WhatsApp', statut: 'prospect', langue: 'FR', responsable: 'amel', updatedBy: 'whatsapp' },
  );
  assert.equal(conv.clientId, client._id);

  const [mission] = db.dump('missions');
  assert.equal(mission.titre, 'WhatsApp — Bonjour, je voudrais une Urus pour ce week-end,…');
  assert.equal(mission.statut, 'nouvelle');
  assert.equal(mission.service, 'location');
  assert.equal(mission.responsable, 'amel');
  assert.equal(mission.source, 'whatsapp');
  assert.equal(mission.convId, '33612345678');
  assert.equal(mission.clientId, client._id);
  assert.equal(conv.missionId, mission._id);

  assert.equal(net.graphCalls.length, 1);
  const g = net.graphCalls[0];
  assert.equal(g.url, GRAPH_URL);
  assert.equal(g.method, 'POST');
  assert.equal(g.headers.Authorization, 'Bearer EAAtest');
  assert.deepEqual(g.body, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: '33612345678',
    type: 'text',
    text: { preview_url: false, body: 'Bonjour Jean, merci pour votre message. Amel, de la maison Amane, vous répond personnellement dans quelques minutes.' },
  });

  const msgs = db.dump('messages').sort((a, b) => a.at.localeCompare(b.at));
  assert.equal(msgs.length, 2);
  assert.deepEqual([msgs[0].dir, msgs[0].status, msgs[0].convId], ['in', 'recu', '33612345678']);
  assert.equal(msgs[0]._id, 'wamid.HBgLMzM2MTIzNDU2NzgVAgASGBQzQTRGQjE1RkI4RjA5NjU4M0E1MAA=');
  assert.deepEqual([msgs[1].dir, msgs[1].status, msgs[1].by, msgs[1]._id], ['out', 'envoye', 'auto', 'wamid.OUT1']);

  const act = db.dump('activity');
  assert.ok(act.some((a) => a.action === 'whatsapp' && a.resume === 'Nouvelle demande WhatsApp : Jean Dupont (nouveau client)'));

  // Visible dans la synchro du CRM
  const cookie = await login();
  const s = await call(H.sync, { url: '/api/sync', cookie });
  assert.equal(s.json.changes.conversations[0].id, '33612345678');
  assert.equal(s.json.changes.messages.length, 2);
});

test('wamid en double ignoré ; second message dans les 12 h → pas de seconde réponse', async () => {
  const { db, net } = fresh();
  const t = at(DAY);
  const p = inboundPayload({ text: 'Bonjour' });
  await postWebhook(p);
  const again = await postWebhook(p);
  assert.equal(again.status, 200);
  assert.equal(again.json.duplicates, 1);
  assert.equal(db.dump('messages').filter((m) => m.dir === 'in').length, 1);
  assert.equal(db.dump('conversations')[0].unread, 1);
  assert.equal(net.graphCalls.length, 1);

  at(new Date(t + 2 * 3600 * 1000).toISOString());
  await postWebhook(inboundPayload({ id: 'wamid.second', text: 'Pour samedi, 4 personnes' }));
  assert.equal(net.graphCalls.length, 1, 'pas de seconde réponse automatique');
  assert.equal(db.dump('conversations')[0].unread, 2);
  assert.equal(db.dump('missions').length, 1, 'même demande ouverte');

  at(new Date(t + 13 * 3600 * 1000).toISOString());
  await postWebhook(inboundPayload({ id: 'wamid.third', text: 'Vous êtes là ?' }));
  assert.equal(net.graphCalls.length, 2, 'plus de 12 h : nouvelle réponse automatique');
});

test('rafale de 3 messages simultanés d’un nouveau numéro → 1 client, 1 demande, 1 réponse', async () => {
  const { db, net } = fresh();
  at(DAY);
  const rs = await Promise.all(['Bonjour', 'Je cherche un chauffeur', 'Demain 10 h'].map((text, i) =>
    postWebhook(inboundPayload({ id: 'wamid.burst' + i, text, from: '971501234567', name: 'Khalid' }))));
  assert.ok(rs.every((r) => r.status === 200));
  assert.equal(db.dump('clients').length, 1);
  assert.equal(db.dump('missions').length, 1);
  assert.equal(db.dump('conversations')[0].unread, 3);
  assert.equal(net.graphCalls.length, 1);
});

test('nuit (heure de Paris) → texte « nuit »', async () => {
  const { net } = fresh();
  at(NIGHT);
  await postWebhook(inboundPayload({ text: 'Bonsoir, une voiture pour demain ?', name: 'claire martin' }));
  assert.equal(net.graphCalls[0].body.text.body, 'Bonjour Claire, merci pour votre message. Nous vous répondons personnellement dès 9 h demain matin. Pour une urgence, appelez-nous.');
});

test('arabe → réponse en arabe ; prénom absent omis proprement', async () => {
  const { db, net } = fresh();
  at(DAY);
  await postWebhook(inboundPayload({ from: '971501234567', name: '', text: 'مرحبا، أريد سيارة مع سائق من المطار غداً' }));
  assert.equal(net.graphCalls[0].body.to, '971501234567');
  assert.equal(net.graphCalls[0].body.text.body, 'مرحباً، شكراً لرسالتكم. ستردّ عليكم أمل من دار Amane شخصياً خلال دقائق.');
  assert.equal(db.dump('conversations')[0].lang, 'AR');
  assert.equal(db.dump('missions')[0].service, 'transfert');
  assert.equal(db.dump('clients')[0].langue, 'AR');
});

test('anglais, espagnol, russe → bonne langue', async () => {
  const { net } = fresh();
  at(DAY);
  await postWebhook(inboundPayload({ from: '447700900123', id: 'w1', name: 'John Smith', text: 'Hello, I would like to rent a car with a driver please' }));
  await postWebhook(inboundPayload({ from: '34600123456', id: 'w2', name: 'Lucía', text: 'Hola, quisiera alquilar un coche para mañana, gracias' }));
  await postWebhook(inboundPayload({ from: '79161234567', id: 'w3', name: 'Ольга', text: 'Здравствуйте, нужна машина с водителем' }));
  const bodies = net.graphCalls.map((c) => c.body.text.body);
  assert.equal(bodies[0], 'Hello John, thank you for your message. Amel, from the house of Amane, will reply to you personally within a few minutes.');
  assert.match(bodies[1], /^Hola Lucía, gracias por su mensaje\./);
  assert.match(bodies[2], /^Здравствуйте, Ольга! Благодарим вас/);
});

test('client existant retrouvé : « 06 12 34 56 78 » = +33612345678', async () => {
  const { db, net } = fresh();
  at(DAY);
  const cookie = await login();
  await call(H.doc, { method: 'PUT', url: '/api/doc/clients/cli42', body: { nom: 'M. Jean Dupont', tel: '06 12 34 56 78', statut: 'vip' }, cookie });
  await postWebhook(inboundPayload({ from: '33612345678', name: 'JD', text: 'Bonjour Amel' }));
  assert.equal(db.dump('clients').length, 1);
  const conv = db.dump('conversations')[0];
  assert.equal(conv.clientId, 'cli42');
  assert.equal(conv.nom, 'M. Jean Dupont');
  assert.equal(db.dump('missions')[0].clientId, 'cli42');
  assert.equal(net.graphCalls.length, 1);
});

test('demande ouverte réutilisée ; demande fermée ou trop ancienne → nouvelle demande', async () => {
  const { db } = fresh();
  const t = at(DAY);
  const cookie = await login();
  await call(H.doc, { method: 'PUT', url: '/api/doc/clients/c1', body: { nom: 'A', tel: '+33611111111' }, cookie });
  await call(H.doc, { method: 'PUT', url: '/api/doc/missions/m-open', body: { clientId: 'c1', statut: 'proposition', titre: 'x' }, cookie });
  await postWebhook(inboundPayload({ from: '33611111111', id: 'a1', text: 'Alors ?' }));
  assert.equal(db.dump('missions').length, 1);
  assert.equal(db.dump('conversations')[0].missionId, 'm-open');
  await call(H.doc, { method: 'PUT', url: '/api/doc/missions/m-open', body: { statut: 'terminee' }, cookie });
  at(new Date(t + 60_000).toISOString());
  await postWebhook(inboundPayload({ from: '33611111111', id: 'a2', text: 'Encore une fois, un van pour CDG' }));
  assert.equal(db.dump('missions').length, 2);
  const created = db.dump('missions').find((m) => m._id !== 'm-open');
  assert.equal(created.service, 'transfert');
});

test('statuts : envoyé → distribué → lu, jamais de retour en arrière', async () => {
  const { db } = fresh();
  at(DAY);
  await postWebhook(inboundPayload({ text: 'Bonjour' }));
  const out = db.dump('messages').find((m) => m.dir === 'out');
  assert.equal(out.status, 'envoye');
  await postWebhook(statusPayload({ id: out._id, status: 'delivered' }));
  assert.equal(db.dump('messages').find((m) => m._id === out._id).status, 'distribue');
  await postWebhook(statusPayload({ id: out._id, status: 'read' }));
  await postWebhook(statusPayload({ id: out._id, status: 'delivered' }));
  const m = db.dump('messages').find((x) => x._id === out._id);
  assert.equal(m.status, 'lu');
  assert.equal(m.updatedBy, 'whatsapp');
  const unknown = await postWebhook(statusPayload({ id: 'wamid.inconnu', status: 'read' }));
  assert.equal(unknown.status, 200);
});

test('réglages : réponse automatique désactivée, horaires et textes personnalisés', async () => {
  const { net } = fresh();
  at(DAY);
  const cookie = await login();
  await call(H.doc, { method: 'PUT', url: '/api/doc/reglages/general', body: { autoReply: false }, cookie });
  await postWebhook(inboundPayload({ id: 'r1', from: '33622222222', text: 'Bonjour' }));
  assert.equal(net.graphCalls.length, 0);
  await call(H.doc, { method: 'PUT', url: '/api/doc/reglages/general', body: { autoReply: true, horaires: { debut: '12:00', fin: '20:00' }, textes: { FR: { nuit: 'Bonsoir {prenom}, à demain.' } } }, cookie });
  await postWebhook(inboundPayload({ id: 'r2', from: '33633333333', name: 'Léa', text: 'Bonjour' }));
  assert.equal(net.graphCalls[0].body.text.body, 'Bonsoir Léa, à demain.');
});

test('IA : extraction en JSON strict, ne remplit que les champs vides, brouillon jamais envoyé', async () => {
  const { db, net } = fresh({ ANTHROPIC_API_KEY: 'sk-ant-test' });
  at(DAY);
  const cookie = await login();
  await call(H.doc, { method: 'PUT', url: '/api/doc/clients/c7', body: { nom: 'Mme Ivanova', tel: '+79161234567' }, cookie });
  await call(H.doc, { method: 'PUT', url: '/api/doc/missions/m7', body: { clientId: 'c7', statut: 'nouvelle', titre: 'Séjour', service: 'sejour', lieu: 'Plaza Athénée' }, cookie });
  const extraction = {
    service: 'location', vehicule: 'Lamborghini Urus', debut: '2026-11-07T10:00', fin: '2026-11-09T18:00', lieu: 'Hôtel Ritz',
    passagers: 3, budget: 4000, langue: 'RU', urgence: 'haute',
    resume: 'Urus du 7 au 9 novembre, 3 personnes, budget 4 000 €.',
    brouillon: 'Здравствуйте! Благодарим вас. Мы вернёмся к вам с предложением в ближайшее время. Amel — Amane',
  };
  net.anthropic(() => claudeResponse(JSON.stringify(extraction)));
  const r = await postWebhook(inboundPayload({ from: '79161234567', name: 'Olga', text: 'Здравствуйте, нужен Urus с 7 по 9 ноября, нас трое, бюджет 4000' }));
  assert.equal(r.status, 200);

  // v2 : la réception déclenche aussi la traduction vers le français (point 3) : deux appels Claude.
  assert.equal(net.anthropicCalls.length, 2);
  const a = net.anthropicCalls.find((c) => c.body.output_config.format.schema.properties.brouillon);
  assert.equal(a.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(a.headers['x-api-key'], 'sk-ant-test');
  assert.equal(a.headers['anthropic-version'], '2026-10-21');
  assert.equal(a.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.equal(a.body.model, AI_MODEL);
  assert.equal(a.body.model, 'claude-sonnet-5-5');
  assert.ok(a.body.max_tokens <= 1024);
  assert.equal(a.body.fallbacks, 'default');
  assert.equal(a.body.output_config.effort, 'low');
  assert.equal(a.body.output_config.format.type, 'json_schema');
  assert.equal(a.body.output_config.format.schema.additionalProperties, false);
  assert.equal(a.body.thinking, undefined);
  assert.equal(a.body.temperature, undefined);
  assert.match(a.body.system, /jamais de prix/i);
  assert.equal(a.body.messages.length, 1);
  assert.match(a.body.messages[0].content, /Client : Здравствуйте, нужен Urus/);

  const m = db.dump('missions').find((x) => x._id === 'm7');
  assert.equal(m.service, 'sejour', 'champ déjà rempli : conservé');
  assert.equal(m.lieu, 'Plaza Athénée', 'champ déjà rempli : conservé');
  assert.equal(m.debut, '2026-11-07T10:00');
  assert.equal(m.fin, '2026-11-09T18:00');
  assert.equal(m.passagers, 3);
  assert.equal(m.budget, 4000);
  assert.equal(m.vehiculeId, 'urus');
  assert.equal(m.priorite, 'haute');
  assert.equal(m.updatedBy, 'ia');
  const conv = db.dump('conversations')[0];
  assert.equal(conv.aiSummary, extraction.resume);
  assert.equal(conv.aiDraft, extraction.brouillon);
  assert.equal(conv.aiFields.vehicule, 'Lamborghini Urus');
  // Le brouillon n'est jamais envoyé : seule la réponse automatique part.
  assert.equal(net.graphCalls.length, 1);
  assert.ok(!net.graphCalls.some((c) => JSON.stringify(c.body).includes('Amel — Amane')));
  assert.ok(db.dump('activity').some((x) => x.user === 'ia' && x.resume.startsWith('IA : complété')));
});

test('IA en échec (erreur, JSON invalide, délai, refus) : webhook réussi, sans champs IA', async () => {
  const failures = [
    () => ({ status: 529, json: { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } } }),
    () => claudeResponse('ceci n’est pas du JSON'),
    () => claudeResponse(JSON.stringify({ resume: 42 })),
    () => claudeResponse('', { stop_reason: 'refusal', content: [] }),
    () => { throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }); },
  ];
  for (const [i, f] of failures.entries()) {
    const { db, net } = fresh({ ANTHROPIC_API_KEY: 'sk-ant-test' });
    at(DAY);
    net.anthropic(f);
    const r = await quiet(() => postWebhook(inboundPayload({ id: 'wamid.f' + i, text: 'Bonjour, une G63 demain' })));
    assert.equal(r.status, 200, 'cas ' + i);
    assert.ok(net.anthropicCalls.length >= 1);
    const conv = db.dump('conversations')[0];
    assert.equal(conv.aiSummary, undefined);
    assert.equal(conv.aiDraft, undefined);
    assert.equal(db.dump('missions').length, 1);
    assert.equal(db.dump('missions')[0].debut, undefined);
    assert.equal(net.graphCalls.length, 1, 'la réponse automatique part quand même');
  }
});

test('Meta indisponible pour la réponse automatique : webhook réussi, nouvel essai possible plus tard', async () => {
  const { db, net } = fresh();
  at(DAY);
  net.graph(() => ({ status: 500, json: { error: { message: 'Service temporarily unavailable', code: 2 } } }));
  const r = await quiet(() => postWebhook(inboundPayload({ text: 'Bonjour' })));
  assert.equal(r.status, 200);
  assert.equal(db.dump('messages').filter((m) => m.dir === 'out').length, 0);
  assert.equal(db.dump('conversations')[0].lastOutAt, '', 'réservation annulée');
  net.graph(() => ({ status: 200, json: { messages: [{ id: 'wamid.retry' }] } }));
  await postWebhook(inboundPayload({ id: 'wamid.next', text: 'Allô ?' }));
  assert.equal(db.dump('messages').filter((m) => m.dir === 'out').length, 1);
});

test('alerte équipe : modèle hors fenêtre, texte dans la fenêtre ; message d’un membre de l’équipe ignoré', async () => {
  const { db, net } = fresh({ TEAM_ALERT_NUMBERS: 'amel:33600000001,aziz:+33600000002' });
  at(DAY);
  await postWebhook(inboundPayload({ id: 'c1', from: '33612345678', name: 'Jean', text: 'Bonjour, besoin d’un van pour Orly' }));
  const alert1 = net.graphCalls.find((c) => c.body.to === '33600000001');
  assert.deepEqual(alert1.body, {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: '33600000001', type: 'template',
    template: { name: 'amane_alerte', language: { code: 'fr' }, components: [{ type: 'body', parameters: [{ type: 'text', text: 'Jean' }, { type: 'text', text: 'Bonjour, besoin d’un van pour Orly' }] }] },
  });
  // Amel répond au numéro professionnel : sa fenêtre s'ouvre, pas de client ni de demande pour elle.
  await postWebhook(inboundPayload({ id: 'c2', from: '33600000001', name: 'Amel', text: 'ok je prends' }));
  assert.equal(db.dump('clients').length, 1);
  assert.equal(db.dump('missions').length, 1);
  const n = net.graphCalls.length;
  assert.equal(net.graphCalls.filter((c) => c.body.to === '33600000001').length, 1, 'pas de réponse automatique à l’équipe');
  await postWebhook(inboundPayload({ id: 'c3', from: '33698765432', name: 'Paul', text: 'Bonjour' }));
  const alert2 = net.graphCalls.slice(n).find((c) => c.body.to === '33600000001');
  assert.equal(alert2.body.type, 'text');
  assert.match(alert2.body.text.body, /^Amane — nouvelle demande WhatsApp de Paul \(\+33698765432\)/);
});

test('/api/whatsapp/send : texte dans la fenêtre, 409 hors fenêtre, modèle, 503 sans WhatsApp ; /read', async () => {
  const { db, net } = fresh();
  const t = at(DAY);
  const cookie = await login('amel');
  await postWebhook(inboundPayload({ text: 'Bonjour' }));
  const before = net.graphCalls.length;

  const ok = await call(H.whatsapp, { method: 'POST', url: '/api/whatsapp/send', body: { convId: '33612345678', text: 'Bonjour Jean, la Urus est à vous ce week-end.' }, cookie });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.id, 'wamid.OUT2');
  assert.deepEqual(net.graphCalls[before].body, { messaging_product: 'whatsapp', recipient_type: 'individual', to: '33612345678', type: 'text', text: { preview_url: false, body: 'Bonjour Jean, la Urus est à vous ce week-end.' } });
  const stored = db.dump('messages').find((m) => m._id === 'wamid.OUT2');
  assert.deepEqual([stored.dir, stored.by, stored.status, stored.type], ['out', 'amel', 'envoye', 'text']);
  const conv = db.dump('conversations')[0];
  assert.equal(conv.unread, 0);
  assert.equal(conv.lastDir, 'out');

  const rewritten = await call(H.whatsapp, { method: 'POST', url: '/api/whatsapp?action=send', body: { convId: '33612345678', text: 'Encore' }, cookie });
  assert.equal(rewritten.status, 200);

  at(new Date(t + 25 * 3600 * 1000).toISOString());
  const closed = await call(H.whatsapp, { method: 'POST', url: '/api/whatsapp/send', body: { convId: '33612345678', text: 'Toujours là ?' }, cookie });
  assert.equal(closed.status, 409);
  assert.equal(closed.json.error, 'window_closed');

  const tpl = await call(H.whatsapp, { method: 'POST', url: '/api/whatsapp/send', body: { convId: '33612345678', template: { name: 'amane_relance', lang: 'fr', params: ['Jean', 'samedi'] } }, cookie });
  assert.equal(tpl.status, 200);
  assert.deepEqual(net.graphCalls.at(-1).body, {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: '33612345678', type: 'template',
    template: { name: 'amane_relance', language: { code: 'fr' }, components: [{ type: 'body', parameters: [{ type: 'text', text: 'Jean' }, { type: 'text', text: 'samedi' }] }] },
  });
  assert.equal(db.dump('messages').find((m) => m._id === tpl.json.id).type, 'template');

  assert.equal((await call(H.whatsapp, { method: 'POST', url: '/api/whatsapp/send', body: { convId: '33699999999', text: 'x' }, cookie })).status, 404);
  assert.equal((await call(H.whatsapp, { method: 'POST', url: '/api/whatsapp/send', body: { convId: '../x', text: 'x' }, cookie })).status, 400);

  net.graph(() => ({ status: 400, json: { error: { message: 'Re-engagement message', code: 131047 } } }));
  at(DAY);
  const meta409 = await call(H.whatsapp, { method: 'POST', url: '/api/whatsapp/send', body: { convId: '33612345678', text: 'x' }, cookie });
  assert.equal(meta409.status, 409);

  await postWebhook(inboundPayload({ id: 'wamid.unread', text: 'Merci' }));
  assert.ok(db.dump('conversations')[0].unread > 0);
  const read = await call(H.whatsapp, { method: 'POST', url: '/api/whatsapp/read', body: { convId: '33612345678' }, cookie });
  assert.deepEqual(read.json, { ok: true });
  assert.equal(db.dump('conversations')[0].unread, 0);

  fresh({ WHATSAPP_TOKEN: undefined });
  const cookie2 = await login('amel');
  const off = await call(H.whatsapp, { method: 'POST', url: '/api/whatsapp/send', body: { convId: '33612345678', text: 'x' }, cookie: cookie2 });
  assert.equal(off.status, 503);
  assert.equal(off.json.error, 'whatsapp_off');
});

test('/api/ai : 503 sans clé, appel Claude côté serveur avec la clé', async () => {
  const { net } = fresh();
  const cookie = await login();
  const off = await call(H.ai, { method: 'POST', url: '/api/ai', body: { messages: [{ role: 'user', content: 'Bonjour' }] }, cookie });
  assert.equal(off.status, 503);
  assert.equal(off.json.error, 'ia_off');

  const on = fresh({ ANTHROPIC_API_KEY: 'sk-ant-test' });
  const cookie2 = await login();
  on.net.anthropic(() => claudeResponse('Bonjour Madame, avec plaisir.'));
  const r = await call(H.ai, { method: 'POST', url: '/api/ai', body: { system: 'Tu es le Majordome.', messages: [{ role: 'user', content: 'Rédige une réponse' }], max_tokens: 99999 }, cookie: cookie2 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { text: 'Bonjour Madame, avec plaisir.' });
  const a = on.net.anthropicCalls[0];
  assert.equal(a.body.model, 'claude-sonnet-5-5');
  assert.equal(a.body.system, 'Tu es le Majordome.');
  assert.equal(a.body.max_tokens, 4096);
  assert.deepEqual(a.body.messages, [{ role: 'user', content: 'Rédige une réponse' }]);
  const bad = await call(H.ai, { method: 'POST', url: '/api/ai', body: { messages: [{ role: 'system', content: 'x' }] }, cookie: cookie2 });
  assert.equal(bad.status, 400);
  on.net.anthropic(() => ({ status: 500, json: { type: 'error', error: { type: 'api_error' } } }));
  const fail = await call(H.ai, { method: 'POST', url: '/api/ai', body: { messages: [{ role: 'user', content: 'x' }] }, cookie: cookie2 });
  assert.equal(fail.status, 502);
  assert.equal(net.calls.length, 0);
});
