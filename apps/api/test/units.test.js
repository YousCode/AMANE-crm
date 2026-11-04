import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normPhone } from '../src/lib/phone.js';
import { detectLang, guessService } from '../src/lib/lang.js';
import { firstName, fillTemplate, isDaytime, effectiveReglages, localHM, DEFAULT_TEXTES } from '../src/lib/autoreply.js';
import { verifySignature } from '../src/lib/whatsapp.js';
import { validateExtraction } from '../src/lib/ai.js';
import { summarize } from '../src/lib/docs.js';
import { FakeDb } from '../src/lib/fakedb.js';
import { createHmac } from 'node:crypto';

test('normPhone', () => {
  const cases = {
    '06 12 34 56 78': '33612345678',
    '0612345678': '33612345678',
    '+33612345678': '33612345678',
    '+33 6 12 34 56 78': '33612345678',
    '+33 (0)6 12 34 56 78': '33612345678',
    '0033612345678': '33612345678',
    '06.12.34.56.78': '33612345678',
    '+971 50 123 4567': '971501234567',
    '00971501234567': '971501234567',
    '+44 7700 900123': '447700900123',
    '33612345678': '33612345678',
    '': '',
    'abc': '',
    '12': '',
  };
  for (const [i, o] of Object.entries(cases)) assert.equal(normPhone(i), o, i);
});

test('detectLang', () => {
  assert.equal(detectLang('مرحبا، أريد سيارة'), 'AR');
  assert.equal(detectLang('Здравствуйте, нужна машина'), 'RU');
  assert.equal(detectLang('Bonjour, je voudrais une voiture demain'), 'FR');
  assert.equal(detectLang('Hello, I need a car tomorrow please'), 'EN');
  assert.equal(detectLang('Hola, necesito un coche para mañana'), 'ES');
  assert.equal(detectLang('Urus'), null);
  assert.equal(detectLang(''), null);
});

test('guessService', () => {
  assert.equal(guessService('Une Urus pour le week-end'), 'location');
  assert.equal(guessService('Ferrari 296 svp'), 'location');
  assert.equal(guessService('Un transfert depuis CDG'), 'transfert');
  assert.equal(guessService('pick-up at Le Bourget airport'), 'transfert');
  assert.equal(guessService('Un chauffeur toute la journée'), 'chauffeur');
  assert.equal(guessService('Van pour 7 personnes'), 'van');
  assert.equal(guessService('personal shopping avenue Montaigne'), 'shopping');
  assert.equal(guessService('Un séjour à Paris avec hôtel'), 'sejour');
  assert.equal(guessService('أريد سائق'), 'chauffeur');
  assert.equal(guessService('Bonjour'), 'location');
  assert.equal(guessService('Je cherche une vanne'), 'location', 'pas de faux positif sur « van »');
});

test('prénom et gabarit', () => {
  assert.equal(firstName('jean dupont'), 'Jean');
  assert.equal(firstName('JEAN-PIERRE'), 'Jean-pierre');
  assert.equal(firstName('Marie-Claire Dubois'), 'Marie-Claire');
  assert.equal(firstName('🚗'), '');
  assert.equal(firstName('خالد المنصوري'), 'خالد');
  assert.equal(firstName(''), '');
  assert.equal(fillTemplate(DEFAULT_TEXTES.FR.jour, ''), 'Bonjour, merci pour votre message. Amel, de la maison Amane, vous répond personnellement dans quelques minutes.');
  assert.equal(fillTemplate(DEFAULT_TEXTES.RU.jour, '').startsWith('Здравствуйте! Благодарим'), true);
  assert.equal(fillTemplate(DEFAULT_TEXTES.AR.nuit, '').startsWith('مرحباً، شكراً'), true);
  for (const L of Object.keys(DEFAULT_TEXTES)) {
    for (const k of ['jour', 'nuit']) {
      const t = DEFAULT_TEXTES[L][k];
      assert.ok(t.includes('{prenom}'), `${L} ${k}`);
      assert.ok(!/\d+\s?(€|eur|\$)/i.test(t), 'jamais de prix');
    }
  }
});

test('horaires en heure de Paris, indépendants du fuseau du serveur', () => {
  const r = effectiveReglages(null);
  assert.equal(localHM(Date.parse('2026-11-03T07:59:00Z')), '08:59'); // hiver UTC+1
  assert.equal(localHM(Date.parse('2026-07-03T07:59:00Z')), '09:59'); // été UTC+2
  assert.equal(isDaytime(Date.parse('2026-11-03T07:59:00Z'), r), false);
  assert.equal(isDaytime(Date.parse('2026-11-03T08:00:00Z'), r), true);
  assert.equal(isDaytime(Date.parse('2026-11-03T19:59:00Z'), r), true);
  assert.equal(isDaytime(Date.parse('2026-11-03T20:00:00Z'), r), false);
  const late = effectiveReglages({ horaires: { debut: '20:00', fin: '02:00' } });
  assert.equal(isDaytime(Date.parse('2026-11-03T23:30:00Z'), late), true);
  assert.equal(effectiveReglages({ horaires: { debut: 'n’importe quoi' } }).horaires.debut, '09:00');
});

test('signature Meta à temps constant', () => {
  const raw = Buffer.from('{"a":1}');
  const good = 'sha256=' + createHmac('sha256', 's').update(raw).digest('hex');
  assert.equal(verifySignature(raw, good, 's'), true);
  assert.equal(verifySignature(raw, good.toUpperCase().replace('SHA256', 'sha256'), 's'), true);
  assert.equal(verifySignature(raw, good, 'autre'), false);
  assert.equal(verifySignature(raw, 'sha1=abc', 's'), false);
  assert.equal(verifySignature(raw, undefined, 's'), false);
  assert.equal(verifySignature(raw, good, ''), false);
});

test('validation de l’extraction IA', () => {
  const ok = validateExtraction({ service: 'van', vehicule: 'Classe V', debut: '2026-11-12T10:00', fin: 'demain', lieu: 'CDG', passagers: 5, budget: 3000.4, langue: 'AR', urgence: 'haute', resume: 'Van', brouillon: 'مرحباً' });
  assert.equal(ok.fin, '', 'date mal formée écartée');
  assert.equal(ok.budget, 3000);
  assert.throws(() => validateExtraction(null));
  assert.throws(() => validateExtraction({ service: 'x' }));
  assert.equal(validateExtraction({ service: 'avion', resume: 'r', passagers: -1, urgence: 'x' }).service, '');
});

test('résumés d’activité', () => {
  assert.equal(summarize('missions', { statut: 'nouvelle' }, { statut: 'confirmee' }), 'statut : Nouvelle → Confirmée');
  assert.equal(summarize('missions', { montant: 1, debut: 'a' }, { montant: 2, debut: 'b', fin: 'c' }), 'modifié : montant, dates');
  assert.equal(summarize('missions', { statut: 'encours' }, { statut: 'terminee', montant: 3 }), 'statut : En cours → Terminée ; modifié : montant');
  assert.equal(summarize('missions', { statut: 'proposition' }, { statut: 'perdue' }), 'statut : Proposition → Perdue');
  assert.equal(summarize('clients', { nom: 'A' }, { nom: 'A', updatedAt: 'x' }), null);
});

test('FakeDb : sous-ensemble fidèle du pilote', async () => {
  const db = new FakeDb();
  const c = db.collection('t');
  await c.insertOne({ _id: 'a', n: 1, tags: ['x'], d: new Date(1000) });
  await assert.rejects(c.insertOne({ _id: 'a' }), (e) => e.code === 11000);
  await c.insertOne({ _id: 'b', n: 5, del: true });
  assert.deepEqual((await c.find({ n: { $gt: 1 } }).toArray()).map((d) => d._id), ['b']);
  assert.deepEqual((await c.find({ del: { $ne: true } }).toArray()).map((d) => d._id), ['a']);
  assert.deepEqual((await c.find({ tags: 'x' }).toArray()).map((d) => d._id), ['a']);
  assert.deepEqual((await c.find({ _id: { $in: ['a', 'z'] } }).toArray()).map((d) => d._id), ['a']);
  assert.deepEqual((await c.find({}, { sort: { n: -1 }, limit: 1, projection: { n: 1 } }).toArray()), [{ _id: 'b', n: 5 }]);
  assert.equal((await c.findOne({ _id: 'a' })).d instanceof Date, true);
  const r = await c.findOneAndUpdate({ _id: 'z' }, { $inc: { k: 2 }, $setOnInsert: { s: 1 } }, { upsert: true, returnDocument: 'after' });
  assert.deepEqual(r, { _id: 'z', k: 2, s: 1 });
  const r2 = await c.findOneAndUpdate({ _id: 'z' }, { $inc: { k: 2 }, $setOnInsert: { s: 9 } }, { upsert: true, returnDocument: 'after' });
  assert.deepEqual(r2, { _id: 'z', k: 4, s: 1 });
  assert.equal(await c.findOneAndUpdate({ _id: 'nope' }, { $set: { a: 1 } }), null);
  await c.updateOne({ _id: 'a' }, { $unset: { tags: '' }, $set: { 'p.q': 1 } });
  assert.deepEqual(await c.findOne({ _id: 'a' }, { projection: { d: 0 } }), { _id: 'a', n: 1, p: { q: 1 } });
  assert.equal(await c.countDocuments({ n: { $gte: 1 } }), 2);
  assert.equal((await c.deleteOne({ _id: 'b' })).deletedCount, 1);
  await assert.rejects(c.updateOne({ _id: 'a' }, { n: 2 }));
  await assert.rejects(c.updateOne({ _id: 'a' }, { $set: { n: 2 }, $inc: { n: 1 } }));
  // l'objet renvoyé est une copie
  const copy = await c.findOne({ _id: 'a' });
  copy.n = 99;
  assert.equal((await c.findOne({ _id: 'a' })).n, 1);
});
