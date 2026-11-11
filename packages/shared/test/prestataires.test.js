import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PART_TYPES, DISPO_ST, vehicleOn, freeVehicles, normDispos, dispoCovers, addDispo, dispoDemandeOf, margePrestataire, validate } from '../index.js';

const M = (o) => ({ id: 'm', titre: 't', statut: 'confirmee', debut: '2026-11-20T10:00', fin: '2026-11-22T18:00', ...o });

test('type de partenaire « Loueur » et statuts de demande', () => {
  assert.ok(PART_TYPES.some((x) => x.id === 'loueur'));
  assert.deepEqual(DISPO_ST.map((x) => x.id), ['envoyee', 'oui', 'non']);
  assert.ok(validate.partenaire({ nom: 'Loueur Test', type: 'loueur', tel: '+33612345678' }).ok);
});

test('normDispos : trie, remet du ≤ au, fusionne les périodes qui se touchent, écarte l’invalide', () => {
  assert.deepEqual(normDispos([{ du: '2026-11-25', au: '2026-11-24' }, { du: '2026-11-20', au: '2026-11-22' }, { du: '2026-11-23', au: '2026-11-23' }, { du: 'x', au: 'y' }, null]),
    [{ du: '2026-11-20', au: '2026-11-25' }]);
  assert.deepEqual(normDispos([{ du: '2026-11-01', au: '2026-11-02' }, { du: '2026-11-10', au: '2026-11-12' }]).length, 2);
  assert.deepEqual(normDispos('rien'), []);
});

test('dispoCovers : chaque jour du créneau doit être déclaré', () => {
  const v = { dispos: [{ du: '2026-11-20', au: '2026-11-21' }, { du: '2026-11-22', au: '2026-11-30' }] };
  assert.equal(dispoCovers(v, '2026-11-20T10:00', '2026-11-22T18:00'), true);
  assert.equal(dispoCovers(v, '2026-11-19T10:00', '2026-11-20T18:00'), false, 'la veille n’est pas déclarée');
  assert.equal(dispoCovers({ dispos: [{ du: '2026-11-20', au: '2026-11-20' }] }, '2026-11-20T10:00', '2026-11-21T09:00'), false, 'trou le lendemain');
  assert.equal(dispoCovers({}, '2026-11-20T10:00'), false);
  assert.equal(dispoCovers(v, '2026-11-25T08:00'), true, 'sans fin : le jour même');
});

test('vehicleOn : véhicule de prestataire libre seulement sur ses jours déclarés ; à valider ; réservation prioritaire', () => {
  const mine = { id: 'urus', nom: 'Urus', statut: 'disponible' };
  const ext = { id: 'van1', nom: 'Classe V', statut: 'disponible', partenaireId: 'p1', dispos: [{ du: '2026-11-20', au: '2026-11-22' }] };
  assert.equal(vehicleOn(mine, [], '2026-11-20T10:00', '2026-11-22T18:00').k, 'f', 'la flotte de la maison ne change pas');
  assert.equal(vehicleOn(ext, [], '2026-11-20T10:00', '2026-11-22T18:00').k, 'f');
  const out = vehicleOn(ext, [], '2026-11-23T10:00', '2026-11-24T18:00');
  assert.deepEqual([out.k, out.t, out.ask], ['off', 'Dispo à demander', true]);
  assert.equal(vehicleOn(ext, [M({ id: 'a', vehiculeId: 'van1' })], '2026-11-21T09:00', '2026-11-21T20:00').k, 'b', 'déjà réservé');
  assert.deepEqual(vehicleOn({ ...ext, aValider: true }, [], '2026-11-20T10:00', '2026-11-21T10:00'), { k: 'off', t: 'À valider' });
  assert.equal(vehicleOn(ext, [], '').k, 'f', 'sans date : pas de verdict');
  assert.deepEqual(freeVehicles([mine, ext], [], '2026-11-23T10:00', '2026-11-24T18:00').map((v) => v.id), ['urus']);
  assert.deepEqual(freeVehicles([mine, ext], [], '2026-11-20T10:00', '2026-11-22T18:00').map((v) => v.id).sort(), ['urus', 'van1']);
});

test('addDispo, dispoDemandeOf, margePrestataire', () => {
  assert.deepEqual(addDispo([{ du: '2026-11-18', au: '2026-11-19' }], '2026-11-20T10:00', '2026-11-22T18:00'), [{ du: '2026-11-18', au: '2026-11-22' }]);
  const m = M({ montant: 2400, dispoDemandes: [{ vehiculeId: 'van1', partenaireId: 'p1', statut: 'envoyee' }] });
  assert.equal(dispoDemandeOf(m, 'van1').statut, 'envoyee');
  assert.equal(dispoDemandeOf(m, 'autre'), null);
  assert.deepEqual(margePrestataire(m, { partenaireId: 'p1', prixAchatJour: 500 }), { cout: 1500, vente: 2400, marge: 900, taux: 38 });
  assert.equal(margePrestataire(m, { prixAchatJour: 500 }), null, 'véhicule de la maison : pas de coût d’achat');
});

test('validation : champs prestataire du véhicule et demandes de dispo de la mission', () => {
  assert.ok(validate.vehicule({ nom: 'Classe V', partenaireId: 'p1', prixAchatJour: 350, dispos: [{ du: '2026-11-20', au: '2026-11-22' }], aValider: true }).ok);
  assert.ok(validate.vehicule({ nom: 'X', dispos: [{ du: '2026-11-22', au: '2026-11-20' }] }).errors['dispos.0']);
  assert.ok(validate.vehicule({ nom: 'X', prixAchatJour: -1 }).errors.prixAchatJour);
  assert.ok(validate.vehicule({ nom: 'X', partenaireId: 'a b' }).errors.partenaireId);
  assert.ok(validate.mission({ titre: 'T', dispoDemandes: [{ vehiculeId: 'v', partenaireId: 'p', statut: 'oui' }] }).ok);
  assert.ok(validate.mission({ titre: 'T', dispoDemandes: [{ vehiculeId: 'v', statut: 'peut-etre' }] }).errors['dispoDemandes.0']);
});
