import { test } from 'node:test';
import assert from 'node:assert/strict';
import { devisDoc, carnetDoc, maisonInfo, maisonMissing, docShell, programmeSteps, MAISON_FIELDS } from '../index.js';

const maison = { raison: 'Amane SAS', adresse: '12 avenue Montaigne, 75008 Paris', siren: '123 456 789', tva: 'FR12123456789', iban: 'FR76 3000 6000 0112 3456 7890 189', bic: 'AGRIFRPP', tel: '+33 1 00 00 00 00', email: 'bonjour@amane.paris' };
const client = { nom: 'Jean Dupont', hotel: 'Plaza Athénée', langue: 'FR', tel: '+33600000000' };
const mission = {
  titre: 'Urus 3 jours', responsable: 'aziz', debut: '2026-11-20T10:00', fin: '2026-11-22T18:00',
  devis: { numero: 'D-2026-0007', date: '2026-11-03', factureNumero: 'F-2026-0003', factureDate: '2026-11-05', statut: 'accepte', remise: 0, tva: 20,
    lignes: [{ d: 'Lamborghini Urus <SE>', q: 3, u: 'jour', pu: 1000 }], paiements: [{ date: '2026-11-05', montant: 3600, moyen: 'virement' }] },
  programme: [{ dt: '2026-11-21T20:00', type: 'restaurant', partenaireId: 'p2' }, { dt: '2026-11-20T10:00', type: 'transfert', lieu: 'CDG' }],
};

test('maisonInfo : nettoie, complète par les valeurs par défaut ; maisonMissing liste les mentions légales absentes', () => {
  assert.equal(MAISON_FIELDS.length, 9);
  const m = maisonInfo({ raison: '  Amane SAS ', iban: '' }, { iban: 'FR76 ENV', bic: 'ENVBIC' });
  assert.equal(m.raison, 'Amane SAS');
  assert.equal(m.iban, 'FR76 ENV', 'IBAN vide → défaut (variable d’environnement)');
  assert.equal(m.siren, '');
  assert.deepEqual(maisonMissing(m), ['adresse', 'siren', 'tva']);
  assert.deepEqual(maisonMissing(maison), []);
});

test('facture A4 : mentions légales, totaux, acquittée, échappement, thème bordeaux', () => {
  const html = devisDoc({ mission, client, kind: 'facture', maison });
  assert.ok(html.startsWith('<!doctype html><html lang="fr" dir="ltr">'));
  assert.ok(html.includes('<h1>Facture</h1>') && html.includes('F-2026-0003'));
  assert.ok(html.includes('SIREN 123 456 789') && html.includes('TVA FR12123456789') && html.includes('Amane SAS'));
  assert.ok(html.includes('FR76 3000 6000 0112 3456 7890 189') && html.includes('AGRIFRPP'));
  assert.ok(html.includes('Lamborghini Urus &lt;SE&gt;'), 'désignation échappée');
  assert.ok(/3\s?600,00\s€/.test(html), 'TTC 3 600,00 €');
  assert.ok(html.includes('Acquittée'), 'facture soldée');
  assert.ok(html.includes('Devis D-2026-0007'), 'référence du devis');
  assert.ok(html.includes('Échéance 05/12/2026'), 'échéance à 30 jours');
  assert.ok(html.includes('Votre interlocuteur : Aziz'));
  assert.ok(html.includes('#5B1622') && html.includes('#F6F1E8') && html.includes('#B8955C'));
  assert.ok(html.includes('M452 -6 L560 -6'), 'le A à serrure');
  assert.ok(html.includes('Arrive as a <em>Guest</em>. Leave with a <em>Story</em>.'));
  assert.ok(!html.includes('class="ph"'));
});

test('devis : pages client sans « [SIREN] », usage interne avec champs à compléter visibles', () => {
  const pub = devisDoc({ mission, client: { ...client, langue: 'EN' }, kind: 'devis', maison: {} });
  assert.ok(pub.includes('<h1>Quotation</h1>') && pub.includes('Valid until 18/11/2026'));
  assert.ok(!pub.includes('[SIREN]') && !pub.includes('class="ph"'), 'aucun gabarit vide montré au client');
  assert.ok(!pub.includes('Acquittée') && !pub.includes('Paid</span>'));
  const int = devisDoc({ mission, client, kind: 'devis', maison: {}, placeholders: true });
  assert.ok(int.includes('[SIREN]') && int.includes('[Raison sociale]') && int.includes('[IBAN]'));
});

test('arabe : RTL, polices arabes, textes traduits', () => {
  const html = devisDoc({ mission, client: { nom: 'خالد', langue: 'AR' }, kind: 'devis', maison });
  assert.ok(html.includes('<html lang="ar" dir="rtl">') && html.includes('Amiri') && html.includes('عرض سعر') && html.includes('صادر عن'));
});

test('carnet de séjour : étapes triées par jour, partenaire, interlocuteur, pied non légal', () => {
  assert.deepEqual(programmeSteps(mission).map((x) => x.type), ['transfert', 'restaurant']);
  const html = carnetDoc({ mission, client: { ...client, langue: 'ES' }, partenaires: [{ id: 'p2', nom: 'Le Meurice', adresse: '228 rue de Rivoli' }], maison });
  assert.ok(html.includes('Programa de su estancia') && html.includes('Estimado/a Jean Dupont:'));
  assert.ok(html.indexOf('Traslado') < html.indexOf('Restaurante'), 'ordre chronologique');
  assert.ok(html.includes('Le Meurice') && html.includes('228 rue de Rivoli') && html.includes('20:00'));
  assert.ok(!html.includes('SIREN'), 'pas de mentions légales sur le carnet');
  assert.ok(html.includes('bonjour@amane.paris'));
});

test('docShell : contenu « after » sous la feuille, masqué à l’impression', () => {
  const html = docShell({ lang: 'FR', title: 'X', body: '<p>b</p>', after: '<form id="accept"></form>' });
  assert.ok(html.includes('<div class="after"><form id="accept"></form></div>'));
  assert.ok(html.includes('.bar,.after{display:none}'));
});
