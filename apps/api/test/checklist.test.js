// « WhatsApp — tout ce qui doit marcher » (docs/architecture-v2.md), points 1 à 20, un test au moins par point.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { t } from '@amane/shared';
import { fresh, call, H, login, at, postWebhook, inboundPayload, statusPayload, claudeResponse, jpeg, BASE } from './helpers.js';

const DAY = '2026-11-03T10:00:00Z';
const quiet = async (fn) => { const e = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = e; } };
const send = (cookie, body) => call(H.whatsapp, { method: 'POST', url: '/api/whatsapp/send', body, cookie });
const put = (cookie, col, id, body) => call(H.doc, { method: 'PUT', url: `/api/doc/${col}/${id}`, body, cookie });

test('1. Réception : image, vidéo, document, vocal, position, contact, réaction, réponse citée → tout est stocké', async () => {
  const { db } = fresh();
  at(DAY);
  const from = '33612345678';
  await postWebhook(inboundPayload({ from, id: 'w.txt', text: 'Bonjour' }));
  await postWebhook(inboundPayload({ from, id: 'w.img', type: 'image', extra: { image: { id: 'MEDIA1', mime_type: 'image/jpeg', caption: 'Mon permis' } } }));
  await postWebhook(inboundPayload({ from, id: 'w.vid', type: 'video', extra: { video: { id: 'MEDIA2', mime_type: 'video/mp4' } } }));
  await postWebhook(inboundPayload({ from, id: 'w.doc', type: 'document', extra: { document: { id: 'MEDIA3', mime_type: 'application/pdf', filename: 'passeport.pdf' } } }));
  await postWebhook(inboundPayload({ from, id: 'w.voc', type: 'audio', extra: { audio: { id: 'MEDIAVOC', mime_type: 'audio/ogg; codecs=opus', voice: true } } }));
  await postWebhook(inboundPayload({ from, id: 'w.loc', type: 'location', extra: { location: { latitude: 48.8698, longitude: 2.3075, name: 'Four Seasons George V', address: '31 av. George V' } } }));
  await postWebhook(inboundPayload({ from, id: 'w.ct', type: 'contacts', extra: { contacts: [{ name: { formatted_name: 'Karim Benali', first_name: 'Karim' }, phones: [{ phone: '+33 6 00 00 00 99', wa_id: '33600000099', type: 'MOBILE' }] }] } }));
  await postWebhook(inboundPayload({ from, id: 'w.re', type: 'reaction', extra: { reaction: { message_id: 'w.img', emoji: '❤️' } } }));
  await postWebhook(inboundPayload({ from, id: 'w.rep', text: 'Oui celui-là', extra: { context: { from: '33187654321', id: 'wamid.OUT1' } } }));
  const ms = Object.fromEntries(db.dump('messages').map((m) => [m._id, m]));
  assert.equal(ms['w.img'].text, '[Photo] Mon permis');
  assert.deepEqual({ ...ms['w.img'].media, photoId: undefined }, { id: 'MEDIA1', mime: 'image/jpeg', caption: 'Mon permis', photoId: undefined });
  assert.ok(ms['w.img'].media.photoId, 'média téléchargé');
  assert.equal(ms['w.vid'].text, '[Vidéo]');
  assert.deepEqual({ ...ms['w.doc'].media, photoId: undefined }, { id: 'MEDIA3', mime: 'application/pdf', filename: 'passeport.pdf', photoId: undefined });
  assert.equal(ms['w.doc'].text, '[Document] passeport.pdf');
  assert.equal(ms['w.voc'].type, 'audio');
  assert.equal(ms['w.voc'].media.voice, true);
  assert.deepEqual(ms['w.loc'].location, { lat: 48.8698, lng: 2.3075, name: 'Four Seasons George V', address: '31 av. George V' });
  assert.deepEqual(ms['w.ct'].contacts, [{ nom: 'Karim Benali', tel: '+33600000099' }]);
  assert.equal(ms['w.ct'].text, '[Contact partagé] Karim Benali');
  assert.deepEqual([ms['w.re'].type, ms['w.re'].reactionTo, ms['w.re'].emoji], ['reaction', 'w.img', '❤️']);
  assert.equal(ms['w.rep'].replyTo, 'wamid.OUT1');
  const conv = db.dump('conversations')[0];
  assert.equal(conv.unread, 8, 'la réaction ne compte pas');
  assert.equal(db.dump('missions').length, 1, 'une seule demande pour la rafale');
});

test('2. Médias téléchargés depuis Meta et stockés (≤ 16 Mo), servis par /api/media/:id ; vocal transcrit et traduit', async () => {
  const { db, net } = fresh({ WHISPER_API_KEY: 'sk-whisper', ANTHROPIC_API_KEY: 'sk-ant' });
  at(DAY);
  net.anthropic((c) => {
    const p = c.body.output_config.format.schema.properties;
    if (p.from) return claudeResponse(JSON.stringify({ text: 'Bonjour, une voiture pour samedi. (traduit)', from: 'EN' }));
    return claudeResponse(JSON.stringify({ service: 'location', vehicule: '', debut: '', fin: '', lieu: '', passagers: 0, budget: 0, langue: 'EN', urgence: 'normale', resume: 'Vocal : voiture samedi', brouillon: 'Hello, with pleasure. Amel — Amane' }));
  });
  net.openai(() => ({ status: 200, json: { text: 'Hello, I would like a car for Saturday.', language: 'english' } }));
  const cookie = await login();
  await postWebhook(inboundPayload({ from: '447700900123', name: 'John', id: 'w.img', type: 'image', extra: { image: { id: 'MEDIAIMG', mime_type: 'image/jpeg' } } }));
  await postWebhook(inboundPayload({ from: '447700900123', name: 'John', id: 'w.voc', type: 'audio', extra: { audio: { id: 'MEDIAVOC', mime_type: 'audio/ogg; codecs=opus', voice: true } } }));
  const img = db.dump('messages').find((m) => m._id === 'w.img');
  assert.ok(img.media.photoId, 'photo téléchargée');
  const stored = db.dump('photos').find((p) => p._id === img.media.photoId);
  assert.equal(stored.type, 'image/jpeg');
  assert.equal(stored.mediaId, 'MEDIAIMG');
  assert.equal(stored.by, 'whatsapp');
  const metaGet = net.graphAll.filter((c) => c.url.endsWith('/MEDIAIMG'));
  assert.equal(metaGet.length, 1);
  assert.equal(metaGet[0].headers.Authorization, 'Bearer EAAtest');
  const served = await call(H.photo, { url: `/api/media/${img.media.photoId}`, cookie });
  assert.equal(served.status, 200);
  assert.equal(served.headers['content-type'], 'image/jpeg');
  assert.ok(served.body.equals(jpeg(1000)));
  assert.equal((await call(H.photo, { url: `/api/media/${img.media.photoId}` })).status, 401, 'session requise');
  const voc = db.dump('messages').find((m) => m._id === 'w.voc');
  assert.equal(voc.transcript, 'Hello, I would like a car for Saturday.');
  assert.equal(voc.transcriptLang, 'EN');
  assert.equal(voc.translation, 'Bonjour, une voiture pour samedi. (traduit)');
  assert.equal(net.openaiCalls.length, 1);
  assert.equal(net.openaiCalls[0].headers.Authorization, 'Bearer sk-whisper');
  // /api/transcribe à la demande : idempotent (déjà transcrit)
  const again = await call(H.ai, { method: 'POST', url: '/api/transcribe', body: { mediaId: 'w.voc' }, cookie });
  assert.equal(again.status, 200);
  assert.equal(again.json.cached, true);
  assert.equal(net.openaiCalls.length, 1);
  // sans clé Whisper : 503
  fresh({ ANTHROPIC_API_KEY: 'sk-ant' });
  const c2 = await login();
  const off = await call(H.ai, { method: 'POST', url: '/api/transcribe', body: { mediaId: 'x' }, cookie: c2 });
  assert.equal(off.status, 503);
  assert.equal(off.json.error, 'transcribe_off');
});

test('3. Traduction automatique vers le français à la réception, cache Mongo ; rattrapage par /api/translate', async () => {
  const { db, net } = fresh({ ANTHROPIC_API_KEY: 'sk-ant' });
  at(DAY);
  net.anthropic((c) => {
    const p = c.body.output_config.format.schema.properties;
    if (p.from) return claudeResponse(JSON.stringify({ text: 'Bonjour, je voudrais une Urus demain.', from: 'EN' }));
    return claudeResponse(JSON.stringify({ service: 'location', vehicule: 'Urus', debut: '', fin: '', lieu: '', passagers: 0, budget: 0, langue: 'EN', urgence: 'normale', resume: 'Urus demain', brouillon: 'Hello. Amel — Amane' }));
  });
  await postWebhook(inboundPayload({ from: '447700900123', name: 'John', id: 'w1', text: 'Hello, I would like an Urus tomorrow.' }));
  const m = db.dump('messages').find((x) => x._id === 'w1');
  assert.equal(m.translation, 'Bonjour, je voudrais une Urus demain.');
  assert.equal(m.translationLang, 'FR');
  assert.equal(m.sourceLang, 'EN');
  const tr = net.anthropicCalls.find((c) => c.body.output_config.format.schema.properties.from);
  assert.match(tr.body.system, /Amane » \(jamais traduit\)/);
  assert.match(tr.body.messages[0].content, /Langue cible : français \(FR\)/);
  assert.equal(db.dump('translations').length, 1);
  const n = net.anthropicCalls.length;
  const cookie = await login();
  const r = await call(H.ai, { method: 'POST', url: '/api/translate', body: { text: 'Hello, I would like an Urus tomorrow.', to: 'FR', from: 'EN' }, cookie });
  assert.deepEqual(r.json, { text: 'Bonjour, je voudrais une Urus demain.', from: 'EN', cached: true });
  assert.equal(net.anthropicCalls.length, n, 'servi par le cache');
  const fr = await call(H.ai, { method: 'POST', url: '/api/translate', body: { text: 'Bonjour, une voiture svp', to: 'FR' }, cookie });
  assert.equal(fr.json.text, 'Bonjour, une voiture svp', 'déjà en français : renvoyé tel quel');
  assert.equal((await call(H.ai, { method: 'POST', url: '/api/translate', body: { text: 'x', to: 'KL' }, cookie })).status, 400);
  // message français reçu : pas de traduction demandée
  await postWebhook(inboundPayload({ from: '33611111111', name: 'Paul', id: 'w2', text: 'Bonjour, je voudrais une voiture demain' }));
  assert.equal(db.dump('messages').find((x) => x._id === 'w2').translation, undefined);
  // IA absente : 503 ia_off, rien ne casse
  fresh();
  at(DAY);
  await postWebhook(inboundPayload({ from: '447700900123', name: 'John', id: 'w3', text: 'Hello there, I need a car' }));
  const c2 = await login();
  const off = await call(H.ai, { method: 'POST', url: '/api/translate', body: { text: 'Hello there, I need a car', to: 'FR' }, cookie: c2 });
  assert.equal(off.status, 503);
  assert.equal(off.json.error, 'ia_off');
});

test('4. Langue détectée mémorisée sur le client si vide', async () => {
  const { db } = fresh();
  at(DAY);
  const cookie = await login();
  await put(cookie, 'clients', 'c1', { nom: 'Olga', tel: '+79161234567' });
  await postWebhook(inboundPayload({ from: '79161234567', id: 'w1', text: 'Здравствуйте, нужна машина' }));
  assert.equal(db.dump('clients')[0].langue, 'RU');
  assert.equal(db.dump('conversations')[0].lang, 'RU');
  await put(cookie, 'clients', 'c2', { nom: 'Jean', tel: '+33699999999', langue: 'FR' });
  await postWebhook(inboundPayload({ from: '33699999999', id: 'w2', text: 'Hello, I need a car please' }));
  assert.equal(db.dump('clients').find((c) => c._id === 'c2').langue, 'FR', 'langue déjà renseignée : conservée');
});

test('5. Idempotence wamid, signature vérifiée, rafale sérialisée (voir aussi whatsapp.test.js)', async () => {
  const { db, net } = fresh();
  at(DAY);
  const p = inboundPayload({ text: 'Bonjour' });
  assert.equal((await postWebhook(p, { secret: 'faux' })).status, 401);
  const rs = await Promise.all([postWebhook(p), postWebhook(p), postWebhook(inboundPayload({ id: 'w2', text: 'Suite' }))]);
  assert.ok(rs.every((r) => r.status === 200));
  assert.equal(db.dump('messages').filter((m) => m.dir === 'in').length, 2);
  assert.equal(db.dump('clients').length, 1);
  assert.equal(db.dump('missions').length, 1);
  assert.equal(net.graphCalls.length, 1);
});

test('6. Client par numéro, demande ouverte, IA remplit les champs vides et pose aiSummary/aiDraft (voir whatsapp.test.js) ; 7. équipe jamais cliente', async () => {
  const { db } = fresh({ TEAM_ALERT_NUMBERS: 'youssouf:33600000003' });
  at(DAY);
  await postWebhook(inboundPayload({ from: '33600000003', name: 'Youssouf', id: 'w1', text: 'test interne' }));
  assert.equal(db.dump('clients').length, 0);
  assert.equal(db.dump('missions').length, 0);
  const conv = db.dump('conversations')[0];
  assert.equal(conv.equipe, 'youssouf');
  assert.equal(conv.nom, 'Équipe — youssouf');
});

test('8. Réponse automatique jour/nuit par langue, une fois par 12 h, désactivable (voir whatsapp.test.js) : RU et ES', async () => {
  const { net } = fresh();
  at('2026-11-03T22:30:00Z');
  await postWebhook(inboundPayload({ from: '79161234567', id: 'w1', name: 'Ольга', text: 'Здравствуйте' }));
  assert.match(net.graphCalls[0].body.text.body, /^Здравствуйте, Ольга! Благодарим вас за сообщение\. Мы лично ответим вам завтра/);
  await postWebhook(inboundPayload({ from: '34600123456', id: 'w2', name: 'Lucía', text: 'Hola, buenas noches' }));
  assert.match(net.graphCalls[1].body.text.body, /^Hola Lucía, gracias por su mensaje\. Le responderemos personalmente mañana/);
});

test('9. Envoi image (photo stockée → upload Meta), document par URL, position, contact chauffeur', async () => {
  const { db, net } = fresh();
  at(DAY);
  const cookie = await login();
  await postWebhook(inboundPayload({ text: 'Bonjour' }));
  const up = await call(H.photo, { method: 'POST', url: '/api/photo', body: { dataUrl: 'data:image/jpeg;base64,' + jpeg(2000).toString('base64') }, cookie });
  const img = await send(cookie, { convId: '33612345678', media: { type: 'image', photoId: up.json.id, caption: 'Votre Urus' } });
  assert.equal(img.status, 200, img.text);
  const upload = net.graphAll.find((c) => c.url.endsWith('/media'));
  assert.ok(upload, 'upload multipart vers Meta');
  assert.equal(upload.headers.Authorization, 'Bearer EAAtest');
  const sentImg = net.graphCalls.at(-1).body;
  assert.match(sentImg.image.id, /^media\.UP\d+$/);
  assert.deepEqual({ ...sentImg, image: { ...sentImg.image, id: 'x' } }, { messaging_product: 'whatsapp', recipient_type: 'individual', to: '33612345678', type: 'image', image: { id: 'x', caption: 'Votre Urus' } });
  const mImg = db.dump('messages').find((m) => m._id === img.json.id);
  assert.equal(mImg.type, 'image');
  assert.equal(mImg.media.photoId, up.json.id);
  assert.equal(mImg.text, '[Photo] Votre Urus');
  const doc = await send(cookie, { convId: '33612345678', media: { type: 'document', url: 'https://amane.test/devis.pdf', filename: 'Devis D-2026-0001.pdf' } });
  assert.equal(doc.status, 200);
  assert.deepEqual(net.graphCalls.at(-1).body.document, { link: 'https://amane.test/devis.pdf', filename: 'Devis D-2026-0001.pdf' });
  const loc = await send(cookie, { convId: '33612345678', location: { lat: 48.8698, lng: 2.3075, name: 'George V', address: '31 avenue George V' } });
  assert.equal(loc.status, 200);
  assert.deepEqual(net.graphCalls.at(-1).body.location, { latitude: 48.8698, longitude: 2.3075, name: 'George V', address: '31 avenue George V' });
  assert.equal(db.dump('messages').find((m) => m._id === loc.json.id).text, '[Position] George V, 31 avenue George V');
  await put(cookie, 'partenaires', 'p1', { nom: 'Karim Benali', type: 'chauffeur', tel: '06 00 00 00 99' });
  const ct = await send(cookie, { convId: '33612345678', contact: { partenaireId: 'p1' } });
  assert.equal(ct.status, 200);
  const cb = net.graphCalls.at(-1).body;
  assert.equal(cb.type, 'contacts');
  assert.equal(cb.contacts[0].name.formatted_name, 'Karim Benali');
  assert.deepEqual(cb.contacts[0].phones, [{ phone: '+33600000099', type: 'WORK', wa_id: '33600000099' }]);
  assert.deepEqual(db.dump('messages').find((m) => m._id === ct.json.id).contacts, [{ nom: 'Karim Benali', tel: '+33600000099', org: 'Amane' }]);
  assert.equal((await send(cookie, { convId: '33612345678', media: { type: 'image', url: 'http://pas-https' } })).status, 400);
  assert.equal((await send(cookie, { convId: '33612345678', location: { lat: 100, lng: 0 } })).status, 400);
  assert.equal((await send(cookie, { convId: '33612345678', contact: { partenaireId: 'inconnu' } })).status, 404);
});

test('10. Rédaction en français → traduction avant envoi, original conservé ; « envoyer en français quand même »', async () => {
  const { db, net } = fresh({ ANTHROPIC_API_KEY: 'sk-ant' });
  at(DAY);
  net.anthropic((c) => {
    const p = c.body.output_config && c.body.output_config.format && c.body.output_config.format.schema.properties;
    if (p && p.from) return claudeResponse(JSON.stringify({ text: 'Hello John, the Urus is yours this weekend.', from: 'FR' }));
    return claudeResponse(JSON.stringify({ service: '', vehicule: '', debut: '', fin: '', lieu: '', passagers: 0, budget: 0, langue: 'EN', urgence: 'normale', resume: 'r', brouillon: 'b' }));
  });
  const cookie = await login();
  await postWebhook(inboundPayload({ from: '447700900123', name: 'John', text: 'Hello, I need the Urus this weekend' }));
  const tr = await call(H.ai, { method: 'POST', url: '/api/translate', body: { text: 'Bonjour John, la Urus est à vous ce week-end.', to: 'EN', from: 'FR' }, cookie });
  assert.equal(tr.json.text, 'Hello John, the Urus is yours this weekend.');
  const r = await send(cookie, { convId: '447700900123', text: tr.json.text, originalText: 'Bonjour John, la Urus est à vous ce week-end.' });
  assert.equal(r.status, 200);
  const m = db.dump('messages').find((x) => x._id === r.json.id);
  assert.equal(m.text, 'Hello John, the Urus is yours this weekend.');
  assert.equal(m.originalText, 'Bonjour John, la Urus est à vous ce week-end.');
  assert.equal(net.graphCalls.at(-1).body.text.body, 'Hello John, the Urus is yours this weekend.');
  const fr = await send(cookie, { convId: '447700900123', text: 'Bonjour John, à tout à l’heure.' });
  assert.equal(net.graphCalls.at(-1).body.text.body, 'Bonjour John, à tout à l’heure.', 'en français quand même');
  assert.equal(db.dump('messages').find((x) => x._id === fr.json.id).originalText, undefined);
});

test('11. Réponses rapides par langue avec variables (@amane/shared)', () => {
  assert.equal(t('EN', 'quick.chauffeur_en_route', { prenom: 'John', chauffeur: 'Karim', heure: '10:00', lieu: 'George V' }), 'Hello John, your chauffeur Karim is on the way and will be waiting for you at 10:00, George V.');
  assert.equal(t('AR', 'quick.confirmation', { prenom: 'خالد', voiture: 'Urus SE', date: '20 نوفمبر', heure: '10:00', lieu: 'جورج الخامس' }), 'مرحباً خالد، تم تأكيد حجزكم: Urus SE، يوم 20 نوفمبر الساعة 10:00، جورج الخامس. يسعدنا استقبالكم.');
  for (const L of ['FR', 'EN', 'ES', 'AR', 'RU']) for (const k of ['accuse', 'dates', 'caution', 'confirmation', 'remerciement', 'itineraire', 'chauffeur_en_route']) assert.ok(t(L, 'quick.' + k, { prenom: 'X' }).includes('X'), `${L} ${k}`);
});

test('12. Brouillon IA posé sur la conversation, jamais envoyé seul', async () => {
  const { db, net } = fresh({ ANTHROPIC_API_KEY: 'sk-ant' });
  at(DAY);
  net.anthropic(() => claudeResponse(JSON.stringify({ service: 'location', vehicule: '', debut: '', fin: '', lieu: '', passagers: 0, budget: 0, langue: 'FR', urgence: 'normale', resume: 'Urus ce week-end', brouillon: 'Bonjour Jean, avec grand plaisir, je reviens vers vous très vite. Amel — Amane' })));
  await postWebhook(inboundPayload({ text: 'Bonjour, une Urus ce week-end svp' }));
  const conv = db.dump('conversations')[0];
  assert.match(conv.aiDraft, /^Bonjour Jean, avec grand plaisir/);
  assert.equal(net.graphCalls.length, 1);
  assert.ok(!JSON.stringify(net.graphCalls.map((c) => c.body)).includes('avec grand plaisir'));
  assert.equal(db.dump('messages').filter((m) => m.dir === 'out').length, 1, 'seule la réponse automatique est partie');
});

test('13. Fenêtre de 24 h : 409 window_closed, modèle approuvé avec paramètres, liste des modèles dans reglages/templates', async () => {
  const { db, net } = fresh();
  const t0 = at(DAY);
  const cookie = await login();
  await postWebhook(inboundPayload({ text: 'Bonjour' }));
  const list = await call(H.whatsapp, { url: '/api/whatsapp/templates', cookie });
  assert.equal(list.status, 200);
  assert.deepEqual(list.json.modeles.map((m) => m.name), ['amane_relance', 'amane_rappel', 'amane_devis', 'amane_alerte']);
  assert.deepEqual(list.json.modeles[1].vars, ['prenom', 'service', 'date', 'heure', 'lieu']);
  assert.match(list.json.modeles[1].body, /\{\{5\}\}/);
  assert.ok(db.dump('reglages').some((r) => r._id === 'templates'), 'modèles posés dans reglages/templates au démarrage');
  at(new Date(t0 + 25 * 3600 * 1000).toISOString());
  const closed = await send(cookie, { convId: '33612345678', text: 'Toujours là ?' });
  assert.equal(closed.status, 409);
  assert.equal(closed.json.error, 'window_closed');
  const closedMedia = await send(cookie, { convId: '33612345678', location: { lat: 1, lng: 1 } });
  assert.equal(closedMedia.status, 409);
  const tpl = await send(cookie, { convId: '33612345678', template: { name: 'amane_devis', lang: 'fr', params: ['Jean', 'D-2026-0001', 'https://amane.test/d/x'] } });
  assert.equal(tpl.status, 200);
  assert.deepEqual(net.graphCalls.at(-1).body.template, { name: 'amane_devis', language: { code: 'fr' }, components: [{ type: 'body', parameters: [{ type: 'text', text: 'Jean' }, { type: 'text', text: 'D-2026-0001' }, { type: 'text', text: 'https://amane.test/d/x' }] }] });
  assert.equal(db.dump('messages').find((m) => m._id === tpl.json.id).text, '[Modèle amane_devis] Jean · D-2026-0001 · https://amane.test/d/x');
  await put(cookie, 'reglages', 'templates', { modeles: [{ name: 'amane_relance', label: 'Relance maison', body: 'Bonjour {{1}}, {{2}}' }, { name: 'amane_bienvenue', label: 'Bienvenue', vars: ['prenom'], langs: ['fr', 'en'], body: 'Bienvenue {{1}}' }] });
  const list2 = (await call(H.whatsapp, { url: '/api/whatsapp/templates', cookie })).json.modeles;
  assert.equal(list2.find((m) => m.name === 'amane_relance').label, 'Relance maison');
  assert.equal(list2.length, 5);
  assert.equal(list2.at(-1).name, 'amane_bienvenue');
});

test('14. Accusés envoyé → distribué → lu, échec avec code Meta lisible', async () => {
  const { db } = fresh();
  at(DAY);
  await postWebhook(inboundPayload({ text: 'Bonjour' }));
  const out = db.dump('messages').find((m) => m.dir === 'out');
  await postWebhook(statusPayload({ id: out._id, status: 'sent' }));
  await postWebhook(statusPayload({ id: out._id, status: 'delivered' }));
  assert.equal(db.dump('messages').find((m) => m._id === out._id).status, 'distribue');
  await postWebhook(statusPayload({ id: out._id, status: 'failed', errors: [{ code: 131026, title: 'Message undeliverable', message: 'Message undeliverable', error_data: { details: 'Message Undeliverable.' } }] }));
  const failed = db.dump('messages').find((m) => m._id === out._id);
  assert.equal(failed.status, 'echec');
  assert.equal(failed.erreurCode, 131026);
  assert.equal(failed.erreur, 'Ce numéro n’est pas joignable sur WhatsApp.');
  // Meta refuse un envoi : message lisible dans la réponse de /send
  const cookie = await login();
  const { net } = { net: null };
  void net;
  const n2 = fresh();
  at(DAY);
  await postWebhook(inboundPayload({ text: 'Bonjour' }));
  const c2 = await login();
  n2.net.graph(() => ({ status: 400, json: { error: { message: 'Recipient phone number not in allowed list', code: 131030 } } }));
  const r = await send(c2, { convId: '33612345678', text: 'x' });
  assert.equal(r.status, 502);
  assert.equal(r.json.error, 'whatsapp_erreur');
  assert.match(r.json.message, /liste de test Meta/);
  void cookie;
});

test('15. Marquer lu côté Meta à l’ouverture du fil ; compteur non lus ; WS en temps réel', async () => {
  const { db, net } = fresh();
  at(DAY);
  const cookie = await login();
  // WebSocket : refusé sans cookie, accepté avec
  const bad = new WebSocket(BASE.replace('http', 'ws') + '/ws');
  const badCode = await new Promise((resolve) => { bad.on('error', () => resolve('error')); bad.on('unexpected-response', (_, res) => resolve(res.statusCode)); });
  assert.equal(badCode, 401);
  const ws = new WebSocket(BASE.replace('http', 'ws') + '/ws', { headers: { cookie } });
  const events = [];
  ws.on('message', (d) => events.push(JSON.parse(String(d))));
  await new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });
  try {
  const waitFor = (pred, ms = 2000) => new Promise((resolve, reject) => { const t0 = Date.now(); const i = setInterval(() => { const e = events.find(pred); if (e) { clearInterval(i); resolve(e); } else if (Date.now() - t0 > ms) { clearInterval(i); reject(new Error('WS : événement non reçu')); } }, 10); });
  const hello = await waitFor((e) => e.type === 'hello');
  assert.equal(hello.user.id, 'amel');
  await postWebhook(inboundPayload({ id: 'w1', text: 'Bonjour' }));
  const msgEvt = await waitFor((e) => e.type === 'message' && e.message.id === 'w1');
  assert.equal(msgEvt.message.dir, 'in');
  const convEvt = await waitFor((e) => e.type === 'conversation' && e.conversation.unread === 1);
  assert.equal(convEvt.conversation.id, '33612345678');
  await postWebhook(inboundPayload({ id: 'w2', text: 'Encore' }));
  assert.equal(db.dump('conversations')[0].unread, 2);
  const read = await call(H.whatsapp, { method: 'POST', url: '/api/whatsapp/read', body: { convId: '33612345678' }, cookie });
  assert.deepEqual(read.json, { ok: true });
  assert.equal(db.dump('conversations')[0].unread, 0);
  const rr = net.graphCalls.find((c) => c.body.status === 'read');
  assert.deepEqual(rr.body, { messaging_product: 'whatsapp', status: 'read', message_id: 'w2' });
  assert.equal(db.dump('conversations')[0].lastReadId, 'w2');
  await waitFor((e) => e.type === 'conversation' && e.conversation.unread === 0);
  await call(H.whatsapp, { method: 'POST', url: '/api/whatsapp/read', body: { convId: '33612345678' }, cookie });
  assert.equal(net.graphCalls.filter((c) => c.body.status === 'read').length, 1, 'pas de second accusé pour le même message');
  await put(cookie, 'clients', 'c9', { nom: 'Via WS' });
  const ch = await waitFor((e) => e.type === 'change' && e.col === 'clients' && e.doc.id === 'c9');
  assert.equal(ch.doc.id, 'c9');
  assert.equal(ch.doc.nom, 'Via WS');
  await call(H.doc, { method: 'DELETE', url: '/api/doc/clients/c9', cookie });
  await waitFor((e) => e.type === 'deleted' && e.id === 'c9');
  } finally { ws.terminate(); }
});

test('16. Rappels automatiques J-1 / J+1 / J-3 : idempotents, désactivables, langue du client, modèle hors fenêtre', async () => {
  const { db, net } = fresh();
  at(DAY);
  const cookie = await login();
  await put(cookie, 'clients', 'c1', { nom: 'John Smith', tel: '+447700900123', langue: 'EN' });
  await put(cookie, 'missions', 'm1', { titre: 'Urus week-end', clientId: 'c1', statut: 'confirmee', service: 'location', vehiculeId: 'urus', debut: '2026-11-20T10:00', fin: '2026-11-22T18:00', lieu: 'George V', montant: 3000 });
  await put(cookie, 'missions', 'm2', { titre: 'Van', clientId: 'c1', statut: 'proposition', service: 'van', debut: '2026-11-21T09:00', montant: 900 });
  // Avant 18 h Paris : la veille n'est pas due (les acomptes J-3, sans conversation, sont ignorés proprement).
  at('2026-11-19T16:30:00Z'); // 17 h 30 Paris
  let r = await call(H.whatsapp, { method: 'POST', url: '/api/rappels/run', cookie });
  assert.equal(r.json.envoyes, 0);
  assert.equal(db.dump('rappels').find((x) => x._id === 'veille:m1'), undefined);
  assert.equal(db.dump('rappels').find((x) => x._id === 'acompte:m2').statut, 'ignore');
  // J-1 18 h Paris passé, aucune conversation → ignoré proprement.
  at('2026-11-19T17:30:00Z');
  r = await call(H.whatsapp, { method: 'POST', url: '/api/rappels/run', cookie });
  assert.equal(r.json.envoyes, 0);
  assert.equal(db.dump('rappels').find((x) => x._id === 'veille:m1').statut, 'ignore');
  // Nouveau client avec conversation (fenêtre fermée) → modèle amane_rappel en anglais.
  await put(cookie, 'clients', 'c2', { nom: 'Olga Ivanova', tel: '+79161234567', langue: 'RU' });
  await put(cookie, 'missions', 'm3', { titre: 'G63', clientId: 'c2', statut: 'confirmee', service: 'location', vehiculeId: 'g63', debut: '2026-11-20T15:00', fin: '2026-11-21T15:00', lieu: 'Ritz', montant: 1300, acompte: 400 });
  const t1 = at('2026-11-10T10:00:00Z');
  await postWebhook(inboundPayload({ from: '79161234567', name: 'Olga', id: 'w.olga', text: 'Здравствуйте', ts: t1 }));
  net.calls.length = 0;
  at('2026-11-19T17:30:00Z');
  r = await call(H.whatsapp, { method: 'POST', url: '/api/rappels/run', cookie });
  assert.equal(r.json.envoyes, 1, JSON.stringify(r.json));
  const tpl = net.graphCalls.at(-1).body;
  assert.equal(tpl.type, 'template');
  assert.equal(tpl.template.name, 'amane_rappel');
  assert.equal(tpl.template.language.code, 'ru');
  assert.equal(tpl.template.components[0].parameters[0].text, 'Olga');
  assert.match(tpl.template.components[0].parameters[2].text, /20 ноября/);
  const rp = db.dump('rappels').find((x) => x._id === 'veille:m3');
  assert.equal(rp.statut, 'envoye');
  assert.equal(rp.lang, 'RU');
  assert.ok(db.dump('activity').some((a) => a.action === 'rappel' && a.docId === 'm3'));
  // Second passage : jamais deux fois.
  r = await call(H.whatsapp, { method: 'POST', url: '/api/rappels/run', cookie });
  assert.equal(r.json.envoyes, 0);
  assert.equal(net.graphCalls.length, 1);
  // Fenêtre ouverte → texte en russe (shared) ; remerciement J+1 10 h.
  const t2 = at('2026-11-22T09:30:00Z');
  await postWebhook(inboundPayload({ from: '79161234567', name: 'Olga', id: 'w.olga2', text: 'Спасибо', ts: t2 }));
  net.calls.length = 0;
  r = await call(H.whatsapp, { method: 'POST', url: '/api/rappels/run', cookie });
  assert.equal(r.json.envoyes, 1);
  assert.match(net.graphCalls.at(-1).body.text.body, /^Здравствуйте, Olga! Благодарим за время, проведённое с Amane/);
  assert.equal(db.dump('messages').find((m) => m.rappel === 'merci').by, 'rappel');
  // Acompte J-3 : texte personnalisé dans reglages/rappels ; désactivation par type.
  await put(cookie, 'clients', 'c3', { nom: 'Jean Dupont', tel: '+33612345678', langue: 'FR' });
  await put(cookie, 'missions', 'm4', { titre: 'Clip', clientId: 'c3', statut: 'confirmee', service: 'clip', debut: '2026-12-01T06:00', montant: 2000, paiement: 'non' });
  await put(cookie, 'reglages', 'rappels', { actifs: { merci: false }, textes: { FR: { acompte: 'Bonjour {prenom}, acompte de {montant} attendu pour le {date}.' } } });
  const t3 = at('2026-11-28T08:30:00Z');
  await postWebhook(inboundPayload({ from: '33612345678', name: 'Jean', id: 'w.jean', text: 'Bonjour', ts: t3 }));
  net.calls.length = 0;
  r = await call(H.whatsapp, { method: 'POST', url: '/api/rappels/run', cookie });
  assert.equal(r.json.envoyes, 1);
  const txt = net.graphCalls.at(-1).body.text.body.replace(/[\u202f\u00a0]/g, ' ');
  assert.match(txt, /^Bonjour Jean, acompte de 600,00 € attendu pour le (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) 1 décembre\.$/);
  const dus = await call(H.whatsapp, { url: '/api/rappels?dus=1', cookie });
  assert.ok(Array.isArray(dus.json.items) && dus.json.items.length >= 3);
  // Clé interne pour la tâche de fond, sans session.
  process.env.INTERNAL_KEY = 'cle-interne-longue';
  assert.equal((await call(H.whatsapp, { method: 'POST', url: '/api/rappels/run', headers: { 'x-internal-key': 'cle-interne-longue' } })).status, 200);
  assert.equal((await call(H.whatsapp, { method: 'POST', url: '/api/rappels/run', headers: { 'x-internal-key': 'fausse' } })).status, 401);
  // WhatsApp absent : tout reste calme.
  fresh({ WHATSAPP_TOKEN: undefined });
  const c2 = await login();
  assert.equal((await call(H.whatsapp, { method: 'POST', url: '/api/rappels/run', cookie: c2 })).json.skipped, 'whatsapp_off');
});

test('17. Alertes équipe : sans réponse depuis 6 h, révision J-7, PV reçu, devis accepté (responsable sinon Amel)', async () => {
  const { db, net } = fresh({ TEAM_ALERT_NUMBERS: 'amel:33600000001,youssouf:33600000003,aziz:33600000002' });
  const t0 = at(DAY);
  const cookie = await login();
  await postWebhook(inboundPayload({ name: 'Jean', text: 'Bonjour, un van pour samedi' }));
  await put(cookie, 'missions', db.dump('missions')[0]._id, { ...db.dump('missions')[0], responsable: 'aziz' });
  net.calls.length = 0;
  at(new Date(t0 + 7 * 3600 * 1000).toISOString());
  let r = await call(H.whatsapp, { method: 'POST', url: '/api/alertes/run', cookie });
  assert.equal(r.json.sansReponse, 1);
  const a = net.graphCalls.find((c) => c.body.to === '33600000002');
  assert.ok(a, 'alerte au responsable de la fiche (Aziz)');
  assert.equal(a.body.template.name, 'amane_alerte');
  assert.match(a.body.template.components[0].parameters[1].text, /^Sans réponse depuis 6 h/);
  r = await call(H.whatsapp, { method: 'POST', url: '/api/alertes/run', cookie });
  assert.equal(r.json.sansReponse, 0, 'pas deux fois pour le même message');
  // Révision J-7 → Youssouf.
  await put(cookie, 'vehicules', 'urus', { nom: 'Urus SE', revision: '2026-11-09', tarifJour: 1000 });
  net.calls.length = 0;
  r = await call(H.whatsapp, { method: 'POST', url: '/api/alertes/run', cookie });
  assert.equal(r.json.revisions, 1);
  assert.equal(net.graphCalls[0].body.to, '33600000003');
  assert.match(net.graphCalls[0].body.template.components[0].parameters[1].text, /Révision le 2026-11-09/);
  assert.equal((await call(H.whatsapp, { method: 'POST', url: '/api/alertes/run', cookie })).json.revisions, 0);
  // PV reçu via le journal du véhicule.
  net.calls.length = 0;
  await put(cookie, 'vehicules', 'g63', { nom: 'G 63', journal: [{ dt: '2026-11-02', type: 'pv', cout: 135, notes: 'Stationnement av. Montaigne' }] });
  const pv = net.graphCalls.find((c) => c.body.to === '33600000003');
  assert.ok(pv, 'alerte PV à Youssouf');
  assert.match(pv.body.template.components[0].parameters[1].text, /PV reçu 135 €/);
  net.calls.length = 0;
  await put(cookie, 'vehicules', 'g63', { nom: 'G 63', journal: [{ dt: '2026-11-02', type: 'pv', cout: 135, notes: 'Stationnement av. Montaigne' }], km: 1 });
  assert.equal(net.graphCalls.length, 0, 'PV déjà connu : pas de nouvelle alerte');
});

test('18. Tableau du lundi : calcul, texte IA (ou repli), envoi à l’équipe une fois par jour', async () => {
  const { db, net } = fresh({ ANTHROPIC_API_KEY: 'sk-ant', TEAM_ALERT_NUMBERS: 'amel:33600000001,aziz:33600000002' });
  at('2026-11-09T07:30:00Z'); // lundi 9 novembre, 8 h 30 Paris
  const cookie = await login();
  await put(cookie, 'clients', 'c1', { nom: 'Jean Dupont', tel: '+33612345678' });
  await put(cookie, 'missions', 'm1', { titre: 'Urus', clientId: 'c1', statut: 'terminee', service: 'location', vehiculeId: 'urus', debut: '2026-11-05T10:00', fin: '2026-11-06T18:00', montant: 2000 });
  await put(cookie, 'missions', 'm2', { titre: 'G63 mariage', clientId: 'c1', statut: 'confirmee', service: 'location', vehiculeId: 'g63', debut: '2026-11-12T18:00', fin: '2026-11-13T12:00', lieu: 'Paris 16e', montant: 1300 });
  await put(cookie, 'missions', 'm3', { titre: 'Facture ancienne', clientId: 'c1', statut: 'terminee', service: 'chauffeur', debut: '2026-09-01T10:00', devis: { numero: 'D-2026-0003', factureNumero: 'F-2026-0003', factureDate: '2026-09-05', lignes: [{ d: 'Chauffeur', q: 1, u: 'jour', pu: 500 }] } });
  await put(cookie, 'vehicules', 'f296', { nom: 'Ferrari 296 GTB', statut: 'entretien' });
  net.anthropic(() => claudeResponse('Belle semaine : 2 000 € la semaine passée, le G 63 jeudi pour M. Dupont. (IA)'));
  const d = await call(H.ai, { url: '/api/digest', cookie });
  assert.equal(d.status, 200);
  assert.equal(d.json.du, '2026-11-09');
  assert.equal(d.json.au, '2026-11-15');
  assert.equal(d.json.caSemainePassee, 2000);
  assert.deepEqual(d.json.missionsAVenir.map((m) => m.id), ['m2']);
  assert.equal(d.json.missionsAVenir[0].vehicule, 'G 63');
  assert.deepEqual(d.json.vehiculesRevision.map((v) => v.id), ['f296']);
  assert.deepEqual(d.json.facturesRetard.map((f) => f.numero), ['F-2026-0003']);
  assert.ok(d.json.relances.length >= 1);
  assert.equal(d.json.ia, true);
  assert.match(d.json.texte, /\(IA\)$/);
  assert.match(net.anthropicCalls[0].body.system, /tableau du lundi/i);
  const d2 = await call(H.ai, { url: '/api/digest?semaine=2026-W45', cookie });
  assert.equal(d2.json.du, '2026-11-02');
  // Repli sans IA
  delete process.env.ANTHROPIC_API_KEY;
  const d3 = await call(H.ai, { url: '/api/digest', cookie });
  assert.equal(d3.json.ia, false);
  assert.match(d3.json.texte.replace(/[\u202f\u00a0]/g, ' '), /^Tableau du lundi — semaine du 2026-11-09\. Chiffre d'affaires de la semaine passée : 2 000 €/);
  assert.match(d3.json.texte, /2026-11-12 18:00 · Jean Dupont · Voiture d’exception · G 63/);
  // Envoi à l'équipe (modèle hors fenêtre), idempotent par jour
  net.calls.length = 0;
  const s = await call(H.ai, { method: 'POST', url: '/api/digest/send', cookie });
  assert.deepEqual(s.json.sent.sort(), ['amel', 'aziz']);
  assert.equal(net.graphCalls.length, 2);
  assert.equal(net.graphCalls[0].body.template.components[0].parameters[0].text, 'Tableau du lundi');
  const s2 = await call(H.ai, { method: 'POST', url: '/api/digest/send', cookie });
  assert.deepEqual(s2.json.skipped, ['deja_envoye']);
  void db;
});

test('19. Lien de devis et espace client en un geste, message prérempli dans la langue du client', async () => {
  const { net } = fresh({ PUBLIC_URL: 'https://amane.test' });
  at(DAY);
  const cookie = await login();
  await put(cookie, 'clients', 'c1', { nom: 'Khalid Al-Mansoori', tel: '+971501234567', langue: 'AR' });
  await put(cookie, 'missions', 'm1', { titre: 'Urus 3 jours', clientId: 'c1', statut: 'proposition', service: 'location', devis: { numero: 'D-2026-0007', date: '2026-11-03', lignes: [{ d: 'Urus SE', q: 3, u: 'jour', pu: 1000 }] } });
  const none = await call(H.doc, { url: '/api/devis/m1/share', cookie });
  assert.equal(none.status, 404);
  const sh = await call(H.doc, { method: 'POST', url: '/api/devis/m1/share', cookie });
  assert.equal(sh.status, 200);
  assert.match(sh.json.token, /^[A-Za-z0-9_-]{24}$/);
  assert.equal(sh.json.url, `https://amane.test/d/${sh.json.token}`);
  assert.equal(sh.json.lang, 'AR');
  assert.match(sh.json.message, /^مرحباً Khalid، إليكم عرض السعر D-2026-0007: https:\/\/amane\.test\/d\//);
  assert.match(sh.json.waLink, /^https:\/\/wa\.me\/971501234567\?text=/);
  const again = await call(H.doc, { method: 'POST', url: '/api/devis/m1/share', cookie });
  assert.equal(again.json.token, sh.json.token, 'même jeton');
  const es = await call(H.doc, { method: 'POST', url: '/api/missions/m1/espace', cookie });
  assert.equal(es.status, 200);
  assert.match(es.json.url, /^https:\/\/amane\.test\/api\/espace\/[A-Za-z0-9_-]{24}$/);
  assert.match(es.json.message, /^مرحباً Khalid، صفحة إقامتكم جاهزة/);
  assert.equal((await call(H.doc, { method: 'POST', url: '/api/devis/inconnu/share', cookie })).status, 404);
  await put(cookie, 'missions', 'm2', { titre: 'Sans devis', clientId: 'c1', statut: 'nouvelle' });
  assert.equal((await call(H.doc, { method: 'POST', url: '/api/devis/m2/share', cookie })).json.error, 'devis_vide');
  void net;
});

test('20. Attribution d’une conversation et notes internes (jamais envoyées, jamais au client)', async () => {
  const { db, net } = fresh();
  at(DAY);
  const cookie = await login('amel');
  await postWebhook(inboundPayload({ text: 'Bonjour' }));
  const n0 = net.graphCalls.length;
  const as = await call(H.whatsapp, { method: 'POST', url: '/api/whatsapp/assign', body: { convId: '33612345678', assigne: 'youssouf', note: 'Il veut une G63 pour samedi, tu confirmes la dispo ?' }, cookie });
  assert.deepEqual(as.json, { ok: true, assigne: 'youssouf' });
  assert.equal(db.dump('conversations')[0].assigne, 'youssouf');
  const notes = db.dump('messages').filter((m) => m.dir === 'note');
  assert.equal(notes.length, 2, 'note de transfert + note libre');
  assert.equal(notes[0].text, 'Amel a transmis la conversation à Youssouf.');
  assert.equal(notes[1].by, 'amel');
  assert.equal(notes[1].type, 'note');
  assert.equal(net.graphCalls.length, n0, 'rien n’est parti vers Meta');
  const nt = await call(H.whatsapp, { method: 'POST', url: '/api/whatsapp/note', body: { convId: '33612345678', text: 'Client VIP, soigner l’accueil.' }, cookie });
  assert.equal(nt.status, 200);
  assert.equal(nt.json.message.dir, 'note');
  const cookieY = await login('youssouf', '1234');
  const s = await call(H.sync, { url: '/api/sync', cookie: cookieY });
  assert.equal(s.json.changes.messages.filter((m) => m.dir === 'note').length, 3, 'visibles par toute l’équipe dans la synchro');
  assert.equal(s.json.changes.conversations[0].assigne, 'youssouf');
  const un = await call(H.whatsapp, { method: 'POST', url: '/api/whatsapp/assign', body: { convId: '33612345678', assigne: '' }, cookie });
  assert.equal(un.json.assigne, '');
  assert.equal((await call(H.whatsapp, { method: 'POST', url: '/api/whatsapp/assign', body: { convId: '33612345678', assigne: 'bob' }, cookie })).status, 400);
  assert.equal((await call(H.whatsapp, { method: 'POST', url: '/api/whatsapp/note', body: { convId: '33612345678', text: '' }, cookie })).status, 400);
  // L'IA ne lit pas les notes internes.
  void quiet;
});
