import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, DICT, hasT, fmtMoney, fmtDate, fmtTime, QUICK_REPLY_KEYS, QUICK_REPLY_LABELS, WA_LANGS, DOC_LANGS, normLang } from '../index.js';

test('t : traduction, variables, repli', () => {
  assert.equal(t('FR', 'doc.quote'), 'Devis');
  assert.equal(t('en', 'doc.quote'), 'Quotation');
  assert.equal(t('ES', 'doc.invoice'), 'Factura');
  assert.equal(t('AR', 'doc.invoice'), 'فاتورة');
  assert.equal(t('FR', 'doc.hello', { nom: 'M. Dupont' }), 'Bonjour M. Dupont,');
  assert.equal(t('EN', 'doc.hello', { nom: 'Mr Smith' }), 'Dear Mr Smith,');
  assert.equal(t('ZH', 'doc.quote'), 'Quotation', 'langue sans dictionnaire → EN');
  assert.equal(t('RU', 'doc.quote'), 'Quotation', 'clé absente en RU → EN');
  assert.equal(t('FR', 'cle.inconnue'), 'cle.inconnue');
  assert.equal(t(null, 'doc.quote'), 'Quotation');
  assert.equal(normLang('fr-FR'), 'FR');
  assert.equal(hasT('RU', 'quick.accuse'), true);
  assert.equal(hasT('RU', 'doc.quote'), false);
});

test('réponses rapides et rappels dans les 5 langues WhatsApp, avec variables', () => {
  for (const L of WA_LANGS) {
    for (const k of QUICK_REPLY_KEYS) assert.ok(DICT[L]['quick.' + k], `${L} quick.${k}`);
    for (const k of ['veille', 'merci', 'acompte']) assert.ok(DICT[L]['rappel.' + k].includes('{prenom}'), `${L} rappel.${k}`);
    for (const k of ['proposition', 'habitue', 'anniversaire', 'acompte', 'facture']) assert.ok(DICT[L]['relance.' + k].includes('{prenom}'), `${L} relance.${k}`);
    assert.ok(DICT[L]['auto.jour'].includes('{prenom}') && DICT[L]['auto.nuit'].includes('{prenom}'));
    for (const [k, v] of Object.entries(DICT[L])) {
      assert.ok(!/\d+\s?(€|eur\b|\$)/i.test(v), `jamais de prix : ${L} ${k}`);
      assert.ok(!/amane/i.test(v.replace(/Amane/g, '')), `« Amane » jamais traduit : ${L} ${k}`);
    }
  }
  assert.equal(t('FR', 'quick.confirmation', { prenom: 'Jean', voiture: 'Urus SE', date: '20 novembre', heure: '10 h', lieu: 'George V' }),
    'Bonjour Jean, votre réservation est confirmée : Urus SE, le 20 novembre à 10 h, George V. Nous nous réjouissons de vous accueillir.');
  assert.equal(t('AR', 'quick.accuse', {}).startsWith('مرحباً، شكراً'), true, 'prénom absent retiré proprement en arabe');
  assert.match(t('RU', 'rappel.veille', { prenom: 'Ольга', date: '20 ноября', heure: '10:00', lieu: 'Ritz' }), /^Здравствуйте, Ольга! Ждём вас завтра, 20 ноября в 10:00, Ritz\./);
  for (const k of QUICK_REPLY_KEYS) assert.ok(QUICK_REPLY_LABELS[k], 'libellé FR ' + k);
});

test('documents : toutes les clés présentes dans FR/EN/ES/AR', () => {
  const keys = Object.keys(DICT.FR).filter((k) => k.startsWith('doc.'));
  assert.ok(keys.length > 40);
  for (const L of DOC_LANGS) for (const k of keys) assert.equal(typeof DICT[L][k], 'string', `${L} ${k}`);
});

test('formats par langue', () => {
  assert.equal(fmtMoney(1300, 'FR').replace(/ | /g, ' '), '1 300,00 €');
  assert.equal(fmtMoney(1300, 'EN'), '€1,300.00');
  assert.equal(fmtMoney('abc', 'FR').replace(/ | /g, ' '), '0,00 €');
  assert.equal(fmtDate('2026-11-20T10:00:00Z', 'FR', { day: 'numeric', month: 'long', year: 'numeric' }, 'Europe/Paris'), '20 novembre 2026');
  assert.equal(fmtDate('2026-11-20T10:00:00Z', 'EN', { day: 'numeric', month: 'long', year: 'numeric' }, 'Europe/Paris'), '20 November 2026');
  assert.equal(fmtTime('2026-11-20T10:05:00Z', 'FR', 'Europe/Paris'), '11:05');
  assert.equal(fmtDate('n’importe quoi'), '');
});
