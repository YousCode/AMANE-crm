import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEAM, STATUTS, CLIENT_STATUTS, LANGUES, SERVICES, SERVICE_IDS, SERVICES_DEFAUT, VEHICULES_DEFAUT, TASK_TPL, WA_TEMPLATES, labelOf, SLOGAN,
  tokens, cssVars, cssTheme, logoSvg, validate, validateClient,
} from '../index.js';

test('constantes : valeurs du CRM, objets gelés', () => {
  assert.deepEqual(TEAM.map((x) => x.id), ['amel', 'youssouf', 'aziz']);
  assert.equal(TEAM[2].role, 'Contrats & conformité');
  assert.deepEqual(STATUTS.map((x) => x.label), ['Nouvelle', 'Proposition', 'Confirmée', 'En cours', 'Terminée', 'Perdue']);
  assert.deepEqual(CLIENT_STATUTS.map((x) => x.id), ['prospect', 'client', 'habitue', 'vip']);
  assert.deepEqual([...LANGUES], ['FR', 'EN', 'AR', 'RU', 'ZH', 'ES', 'IT', 'DE']);
  assert.deepEqual([...SERVICE_IDS], ['location', 'chauffeur', 'van', 'transfert', 'shopping', 'sejour', 'conciergerie', 'clip']);
  assert.equal(SERVICES[0].nom, 'Voiture d’exception');
  assert.equal(SERVICES_DEFAUT.transfert.nom, 'Transfert aéroport');
  assert.deepEqual(Object.keys(VEHICULES_DEFAUT), ['urus', 'f296', 'g63', 'm5', 'classev']);
  assert.deepEqual(VEHICULES_DEFAUT.urus, { nom: 'Urus SE', categorie: 'Super SUV', tarifJour: 1000, loyerMois: 2430, chargesMois: 500, statut: 'disponible', ordre: 1 });
  assert.equal(Object.keys(TASK_TPL).length, 8);
  assert.equal(labelOf(STATUTS, 'encours'), 'En cours');
  assert.equal(labelOf(STATUTS, 'x'), '—');
  assert.equal(WA_TEMPLATES.find((x) => x.name === 'amane_alerte').vars.length, 2);
  assert.equal(SLOGAN, 'Arrive as a Guest. Leave with a Story.');
  assert.throws(() => { TEAM.push({}); });
  assert.throws(() => { 'use strict'; VEHICULES_DEFAUT.urus.tarifJour = 1; });
});

test('jetons de design et variables CSS', () => {
  assert.equal(tokens.colors.light.bg, '#FAF8F4');
  assert.equal(tokens.colors.light.champagne, '#B8955C');
  assert.equal(tokens.colors.dark.bg, '#111111');
  assert.equal(tokens.colors.dark.accent, '#C9A56A');
  assert.equal(tokens.radius, 12);
  assert.equal(tokens.rail, 84);
  assert.match(tokens.fonts.display, /Bodoni Moda/);
  assert.match(tokens.fonts.ui, /Jost/);
  const light = cssVars('light');
  assert.ok(light.includes('--bg:#FAF8F4;') && light.includes('--accent-ink:#FFFFFF;') && light.includes('--radius:12px;'));
  assert.ok(cssVars('dark').includes('--fg:#F4F1EC;'));
  const theme = cssTheme();
  assert.ok(theme.includes(':root{') && theme.includes('prefers-color-scheme:dark') && theme.includes('[data-theme="dark"]'));
  assert.match(logoSvg({ size: 20 }), /^<svg [^>]*viewBox="40 -60 940 1120"[^>]*><path fill="currentColor" d="M452 -6/);
});

test('validate.client', () => {
  assert.deepEqual(validateClient({ nom: 'Jean', tel: '06 12 34 56 78', email: 'j@example.com', langue: 'FR', statut: 'vip' }), { ok: true, errors: {} });
  const bad = validate.client({ nom: '', tel: '12', email: 'nope', langue: 'XX', statut: 'roi', responsable: 'bob', tags: 'x', datesImportantes: [{ date: 'hier' }] });
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.errors).sort(), ['datesImportantes.0', 'email', 'langue', 'nom', 'responsable', 'statut', 'tags', 'tel']);
  assert.equal(bad.errors.nom, 'Le nom est requis.');
  assert.equal(validate.client(null).ok, false);
  assert.equal(validate.client({ nom: 'A', datesImportantes: [{ date: '03-14', label: 'Anniversaire' }], entourage: [], allergies: 'noix' }).ok, true);
});

test('validate.mission et validate.devis', () => {
  assert.equal(validate.mission({ titre: 'Urus', statut: 'nouvelle', service: 'location', debut: '2026-11-20T10:00', fin: '2026-11-22T18:00', montant: 3000, acompte: 900 }).ok, true);
  const bad = validate.mission({ titre: '', statut: 'x', service: 'avion', debut: '2026-11-22T10:00', fin: '2026-11-20T18:00', montant: -1, acompte: 'abc', contrat: { statut: 'nope' }, devis: { lignes: [{ d: '', q: 1, pu: 'x' }], remise: 120 }, programme: [{ type: 'zoo', dt: 'demain' }] });
  assert.equal(bad.ok, false);
  for (const k of ['titre', 'statut', 'service', 'fin', 'montant', 'acompte', 'contrat.statut', 'devis.lignes.0.d', 'devis.lignes.0.pu', 'devis.remise', 'programme.0.type', 'programme.0.dt']) assert.ok(bad.errors[k], k);
  assert.equal(validate.mission({ titre: 'x', montant: 100, acompte: 200 }).errors.acompte, 'L’acompte dépasse le montant.');
  assert.equal(validate.devis({ lignes: [{ d: 'Urus', q: 2, u: 'jour', pu: 1000 }], paiements: [{ montant: 100, moyen: 'cb' }] }).ok, true);
  assert.equal(validate.devis({ paiements: [{ montant: 1, moyen: 'troc' }] }).errors['paiements.0.moyen'], 'Moyen de paiement inconnu.');
});

test('validate.vehicule, partenaire, service', () => {
  assert.equal(validate.vehicule({ nom: 'Urus', tarifJour: 1000, statut: 'disponible', journal: [{ type: 'pv', cout: 90 }] }).ok, true);
  assert.deepEqual(Object.keys(validate.vehicule({ nom: '', tarifJour: 'x', statut: 'volé', journal: [{ type: 'bof', cout: -3 }] }).errors).sort(), ['journal.0.cout', 'journal.0.type', 'nom', 'statut', 'tarifJour']);
  assert.equal(validate.partenaire({ nom: 'Karim', type: 'chauffeur', tel: '+33600000000', commission: 10 }).ok, true);
  assert.deepEqual(Object.keys(validate.partenaire({ nom: 'K', type: 'ninja', tel: 'abc', commission: 150 }).errors).sort(), ['commission', 'tel', 'type']);
  assert.equal(validate.service({ nom: 'Clip', ordre: 8 }).ok, true);
  assert.equal(validate.service({}).ok, false);
});
