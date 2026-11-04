import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  durDays, overlapDays, clashes, chClashes, vehicleOn, freeVehicles, tplTasks, devisTotals, numeroFormat, numeroKey,
  paiementStatut, nextStatut, prevStatut, statutLabel, telNorm, telPlus, telFmt, waLink, mapsLink, detectLang, langFromPhone,
  docLang, isRtl, guessService, firstName, fillVars, windowOpen, VEHICULES_DEFAUT, TASK_TPL,
} from '../index.js';

const M = (o) => ({ id: 'x', statut: 'confirmee', vehiculeId: 'urus', debut: '2026-11-20T10:00', fin: '2026-11-22T18:00', ...o });

test('durDays et overlapDays', () => {
  assert.equal(durDays(M()), 3);
  assert.equal(durDays(M({ fin: '' })), 1);
  assert.equal(durDays({ debut: '' }), 0);
  assert.equal(durDays(M({ debut: '2026-11-20T23:00', fin: '2026-11-21T01:00' })), 2);
  assert.equal(overlapDays(M(), '2026-11-21', '2026-11-30'), 2);
  assert.equal(overlapDays(M(), '2026-12-01', '2026-12-30'), 0);
});

test('clashes : conflit véhicule sur créneau chevauchant, pas sur créneau contigu ni sur une mission perdue', () => {
  const all = [M({ id: 'a' }), M({ id: 'b', debut: '2026-11-22T18:00', fin: '2026-11-25T10:00' }), M({ id: 'c', statut: 'perdue' }), M({ id: 'd', vehiculeId: 'g63' })];
  const nw = M({ id: 'n', statut: 'nouvelle', debut: '2026-11-21T09:00', fin: '2026-11-21T20:00' });
  assert.deepEqual(clashes(nw, all).map((m) => m.id), ['a']);
  assert.deepEqual(clashes(M({ id: 'a' }), all), [], 'ne se compare pas à elle-même');
  assert.deepEqual(clashes(M({ id: 'z', statut: 'terminee' }), all), [], 'statut fermé : pas de conflit signalé');
  assert.deepEqual(clashes(M({ id: 'z', vehiculeId: '' }), all), []);
  assert.deepEqual(clashes(M({ id: 'z', debut: '2026-11-22T18:00', fin: '2026-11-22T20:00' }), all).map((m) => m.id), ['b'], 'borne : fin = début de b → conflit avec b seulement');
  assert.deepEqual(clashes({ _id: 'a', statut: 'confirmee', vehiculeId: 'urus', debut: '2026-11-20T10:00' }, all), [], 'ids _id (forme serveur)');
});

test('chClashes : conflit chauffeur', () => {
  const all = [M({ id: 'a', chauffeurId: 'p1' }), M({ id: 'b', chauffeurId: 'p2' })];
  assert.deepEqual(chClashes(M({ id: 'n', statut: 'proposition', chauffeurId: 'p1' }), all).map((m) => m.id), ['a']);
  assert.deepEqual(chClashes(M({ id: 'n', chauffeurId: 'p3' }), all), []);
});

test('vehicleOn et freeVehicles : « Qui est libre ? »', () => {
  const vs = Object.entries(VEHICULES_DEFAUT).map(([id, v]) => ({ id, ...v }));
  const ms = [M({ id: 'a', vehiculeId: 'urus' }), M({ id: 'o', vehiculeId: 'g63', statut: 'proposition' }), M({ id: 'old', vehiculeId: 'f296', debut: '2026-10-01T10:00', fin: '2026-10-02T10:00' })];
  assert.equal(vehicleOn(vs[0], ms, '2026-11-21', '2026-11-21T23:00').k, 'b');
  assert.equal(vehicleOn(vs[2], ms, '2026-11-21', '2026-11-21T23:00').k, 'o');
  assert.equal(vehicleOn(vs[1], ms, '2026-11-21', '2026-11-21T23:00').k, 'f');
  assert.equal(vehicleOn({ ...vs[1], statut: 'entretien' }, ms, '2026-11-21').k, 'off');
  assert.equal(vehicleOn(vs[0], ms, '2026-11-21', '2026-11-22', 'a').k, 'f', 'mission exclue (en cours d’édition)');
  assert.deepEqual(freeVehicles(vs, ms, '2026-11-21', '2026-11-21T23:00').map((v) => v.id), ['f296', 'g63', 'm5', 'classev']);
  assert.deepEqual(freeVehicles(vs, ms, '2026-11-21', '2026-11-21T23:00', { strict: true }).map((v) => v.id), ['f296', 'm5', 'classev']);
  assert.deepEqual(freeVehicles(vs, ms, '2026-12-01', '2026-12-02').map((v) => v.id), ['urus', 'f296', 'g63', 'm5', 'classev']);
});

test('tplTasks : échéances relatives au début ou à la fin', () => {
  const tasks = tplTasks({ service: 'location', debut: '2026-11-20T10:00', fin: '2026-11-22T18:00' });
  assert.equal(tasks.length, TASK_TPL.location.length);
  assert.deepEqual(tasks[0], { t: 'Préparation et lavage du véhicule', resp: 'youssouf', due: '2026-11-19', fait: false });
  assert.equal(tasks.find((t) => t.t === 'Restitution de la caution').due, '2026-11-24');
  assert.equal(tasks.find((t) => t.t === 'Retour du véhicule').due, '2026-11-22');
  assert.deepEqual(tplTasks({ service: 'inconnu' }), []);
  assert.equal(tplTasks({ service: 'clip', debut: '2026-11-20' }).at(-1).due, '2026-11-25');
});

test('devisTotals : HT, remise, TVA 20 %, TTC, réglé, solde', () => {
  const dv = { lignes: [{ d: 'Urus', q: 3, u: 'jour', pu: 1000 }, { d: 'Chauffeur', q: 2, u: 'jour', pu: '450' }], remise: 10, paiements: [{ montant: 1000 }, { montant: '500.5' }] };
  const t = devisTotals(dv);
  assert.deepEqual(t, { ht: 3900, rem: 390, base: 3510, tva: 702, rate: 20, ttc: 4212, paid: 1500.5, solde: 2711.5 });
  assert.equal(devisTotals({ lignes: [{ q: 1, pu: 100 }], tva: 0 }).ttc, 100);
  assert.equal(devisTotals({ lignes: [{ q: 1, pu: 100 }], tva: '' }).ttc, 120);
  assert.equal(devisTotals({ lignes: [{ q: 1, pu: 33.333 }] }).ht, 33.33);
  assert.deepEqual(devisTotals(null), { ht: 0, rem: 0, base: 0, tva: 0, rate: 20, ttc: 0, paid: 0, solde: 0 });
});

test('numérotation', () => {
  assert.equal(numeroFormat('devis', 2026, 1), 'D-2026-0001');
  assert.equal(numeroFormat('facture', 2026, 123), 'F-2026-0123');
  assert.equal(numeroFormat('facture', '2027', 12345), 'F-2027-12345');
  assert.equal(numeroKey('devis', 2026), 'devis-2026');
  assert.equal(numeroKey('facture', 2026), 'facture-2026');
});

test('paiementStatut, nextStatut, prevStatut', () => {
  assert.equal(paiementStatut({ devis: { lignes: [{ q: 1, pu: 100 }], paiements: [{ montant: 120 }] } }), 'solde');
  assert.equal(paiementStatut({ devis: { lignes: [{ q: 1, pu: 100 }], paiements: [{ montant: 20 }] } }), 'acompte');
  assert.equal(paiementStatut({ devis: { lignes: [{ q: 1, pu: 100 }] } }), 'non');
  assert.equal(paiementStatut({ montant: 1000, acompte: 1000 }), 'solde');
  assert.equal(paiementStatut({ montant: 1000, acompte: 300 }), 'acompte');
  assert.equal(paiementStatut({ montant: 1000, paiement: 'acompte' }), 'acompte');
  assert.equal(paiementStatut({}), 'non');
  assert.equal(paiementStatut(null), 'non');
  assert.equal(nextStatut('nouvelle'), 'proposition');
  assert.equal(nextStatut('encours'), 'terminee');
  assert.equal(nextStatut('terminee'), null);
  assert.equal(nextStatut('perdue'), null);
  assert.equal(prevStatut('confirmee'), 'proposition');
  assert.equal(prevStatut('nouvelle'), null);
  assert.equal(prevStatut('perdue'), 'proposition');
  assert.equal(statutLabel('encours'), 'En cours');
  assert.equal(statutLabel(''), '—');
});

test('telNorm', () => {
  const cases = {
    '06 12 34 56 78': '33612345678', '0612345678': '33612345678', '+33612345678': '33612345678', '+33 6 12 34 56 78': '33612345678',
    '+33 (0)6 12 34 56 78': '33612345678', '0033612345678': '33612345678', '06.12.34.56.78': '33612345678', '+971 50 123 4567': '971501234567',
    '00971501234567': '971501234567', '+44 7700 900123': '447700900123', '33612345678': '33612345678', '': '', 'abc': '', '12': '',
  };
  for (const [i, o] of Object.entries(cases)) assert.equal(telNorm(i), o, i);
  assert.equal(telNorm(null), '');
  assert.equal(telPlus('06 12 34 56 78'), '+33612345678');
  assert.equal(telFmt('0612345678'), '+33 6 12 34 56 78');
  assert.equal(telFmt('+971501234567'), '+971 501 234 567');
});

test('liens', () => {
  assert.equal(waLink('06 12 34 56 78', 'Bonjour à vous'), 'https://wa.me/33612345678?text=Bonjour%20%C3%A0%20vous');
  assert.equal(waLink('', 'x'), 'https://wa.me/?text=x');
  assert.equal(waLink('+33612345678'), 'https://wa.me/33612345678');
  assert.equal(mapsLink('Hôtel Ritz'), 'https://www.google.com/maps/dir/?api=1&destination=H%C3%B4tel%20Ritz%2C%20Paris');
  assert.equal(mapsLink('CDG, 95700 Roissy'), 'https://www.google.com/maps/dir/?api=1&destination=CDG%2C%2095700%20Roissy');
  assert.match(mapsLink('Le Bourget', { apple: true }), /^https:\/\/maps\.apple\.com\/\?daddr=/);
  assert.equal(mapsLink(''), '');
});

test('detectLang, langFromPhone, docLang', () => {
  assert.equal(detectLang('مرحبا، أريد سيارة'), 'AR');
  assert.equal(detectLang('Здравствуйте, нужна машина'), 'RU');
  assert.equal(detectLang('Bonjour, je voudrais une voiture demain'), 'FR');
  assert.equal(detectLang('Hello, I need a car tomorrow please'), 'EN');
  assert.equal(detectLang('Hola, necesito un coche para mañana'), 'ES');
  assert.equal(detectLang('Urus'), null);
  assert.equal(detectLang(''), null);
  assert.equal(langFromPhone('33612345678'), 'FR');
  assert.equal(langFromPhone('+971 50 123 4567'), 'AR');
  assert.equal(langFromPhone('79161234567'), 'RU');
  assert.equal(langFromPhone('34600123456'), 'ES');
  assert.equal(langFromPhone('447700900123'), 'EN');
  assert.equal(langFromPhone('86123456789'), null);
  assert.equal(docLang({ langue: 'ar' }), 'AR');
  assert.equal(docLang({ langue: 'RU' }), 'EN');
  assert.equal(docLang(null), 'EN');
  assert.equal(isRtl('AR'), true);
  assert.equal(isRtl('fr'), false);
});

test('guessService, firstName, fillVars, windowOpen', () => {
  assert.equal(guessService('Un transfert depuis CDG'), 'transfert');
  assert.equal(guessService('Van pour 7 personnes'), 'van');
  assert.equal(guessService('Je cherche une vanne'), 'location');
  assert.equal(guessService('أريد سائق'), 'chauffeur');
  assert.equal(firstName('jean dupont'), 'Jean');
  assert.equal(firstName('Marie-Claire Dubois'), 'Marie-Claire');
  assert.equal(firstName('🚗'), '');
  assert.equal(fillVars('Bonjour {prenom}, votre {voiture} à {heure}.', { prenom: 'Jean', voiture: 'Urus', heure: '10 h' }), 'Bonjour Jean, votre Urus à 10 h.');
  assert.equal(fillVars('Bonjour {prenom}, merci.', {}), 'Bonjour, merci.');
  assert.equal(fillVars('مرحباً {prenom}، شكراً', {}), 'مرحباً، شكراً');
  assert.equal(windowOpen({ windowUntil: new Date(Date.now() + 1000).toISOString() }), true);
  assert.equal(windowOpen({ windowUntil: new Date(Date.now() - 1000).toISOString() }), false);
  assert.equal(windowOpen(null), false);
});
