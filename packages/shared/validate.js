// Validation des fiches : { ok, errors: { champ: 'message en français' } }.
import { STATUTS, CLIENT_STATUTS, LANGUES, CANAUX, SERVICE_IDS, TEAM_IDS, PART_TYPES, PAIEMENT_ST, CONTRAT_ST, CAUTION_ST, DEVIS_ST, UNITES, MOYENS, PROG_TYPES, JOURNAL_T, VEHICULE_STATUTS, PRIORITES } from './constants.js';
import { telNorm, parseDate } from './rules.js';

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]{1,190}\.[A-Za-z]{2,24}$/;
const DT_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;
const ids = (list) => list.map((x) => x.id);
const isStr = (v) => typeof v === 'string';
const empty = (v) => v === undefined || v === null || v === '';

function result(errors) {
  return { ok: Object.keys(errors).length === 0, errors };
}
function oneOf(errors, obj, k, allowed, label) {
  if (!empty(obj[k]) && !allowed.includes(obj[k])) errors[k] = `${label} inconnu.`;
}
function num(errors, obj, k, label, { min = 0 } = {}) {
  if (empty(obj[k])) return;
  const n = Number(obj[k]);
  if (!Number.isFinite(n)) errors[k] = `${label} doit être un nombre.`;
  else if (n < min) errors[k] = `${label} ne peut pas être négatif.`;
}
function date(errors, obj, k, label) {
  if (empty(obj[k])) return;
  if (!isStr(obj[k]) || !DT_RE.test(obj[k]) || !parseDate(obj[k])) errors[k] = `${label} invalide (AAAA-MM-JJ ou AAAA-MM-JJTHH:MM).`;
}
function text(errors, obj, k, label, max) {
  if (empty(obj[k])) return;
  if (!isStr(obj[k])) errors[k] = `${label} doit être un texte.`;
  else if (obj[k].length > max) errors[k] = `${label} trop long (${max} caractères maximum).`;
}
function notObject(obj) {
  return !obj || typeof obj !== 'object' || Array.isArray(obj);
}

export function client(obj) {
  const errors = {};
  if (notObject(obj)) return result({ _: 'Fiche invalide.' });
  if (!isStr(obj.nom) || !obj.nom.trim()) errors.nom = 'Le nom est requis.';
  else if (obj.nom.length > 120) errors.nom = 'Nom trop long (120 caractères maximum).';
  if (!empty(obj.tel) && !telNorm(obj.tel)) errors.tel = 'Numéro de téléphone invalide.';
  if (!empty(obj.email) && (!isStr(obj.email) || !EMAIL_RE.test(obj.email.trim()))) errors.email = 'Adresse e-mail invalide.';
  oneOf(errors, obj, 'langue', LANGUES, 'Langue');
  oneOf(errors, obj, 'statut', ids(CLIENT_STATUTS), 'Statut');
  oneOf(errors, obj, 'canal', CANAUX, 'Canal');
  oneOf(errors, obj, 'responsable', TEAM_IDS, 'Responsable');
  text(errors, obj, 'notes', 'Notes', 20000);
  text(errors, obj, 'prefs', 'Préférences', 4000);
  text(errors, obj, 'allergies', 'Allergies', 2000);
  text(errors, obj, 'marques', 'Marques', 2000);
  for (const k of ['entourage', 'datesImportantes', 'attentions', 'tags']) {
    if (!empty(obj[k]) && !Array.isArray(obj[k])) errors[k] = 'Liste attendue.';
  }
  if (Array.isArray(obj.datesImportantes)) {
    obj.datesImportantes.forEach((d, i) => {
      if (!d || typeof d !== 'object' || !/^\d{4}-\d{2}-\d{2}$|^\d{2}-\d{2}$/.test(String(d.date || ''))) errors[`datesImportantes.${i}`] = 'Date attendue (AAAA-MM-JJ ou MM-JJ).';
    });
  }
  return result(errors);
}

export function mission(obj) {
  const errors = {};
  if (notObject(obj)) return result({ _: 'Fiche invalide.' });
  if (!isStr(obj.titre) || !obj.titre.trim()) errors.titre = 'Le titre est requis.';
  else if (obj.titre.length > 200) errors.titre = 'Titre trop long (200 caractères maximum).';
  oneOf(errors, obj, 'statut', ids(STATUTS), 'Statut');
  oneOf(errors, obj, 'service', SERVICE_IDS, 'Service');
  oneOf(errors, obj, 'responsable', TEAM_IDS, 'Responsable');
  oneOf(errors, obj, 'paiement', ids(PAIEMENT_ST), 'Statut de paiement');
  oneOf(errors, obj, 'priorite', PRIORITES, 'Priorité');
  date(errors, obj, 'debut', 'Date de début');
  date(errors, obj, 'fin', 'Date de fin');
  if (!errors.debut && !errors.fin && obj.debut && obj.fin && parseDate(obj.fin) < parseDate(obj.debut)) errors.fin = 'La fin précède le début.';
  num(errors, obj, 'montant', 'Montant');
  num(errors, obj, 'acompte', 'Acompte');
  num(errors, obj, 'passagers', 'Nombre de passagers');
  num(errors, obj, 'budget', 'Budget');
  if (!errors.montant && !errors.acompte && !empty(obj.montant) && !empty(obj.acompte) && Number(obj.acompte) > Number(obj.montant)) errors.acompte = 'L’acompte dépasse le montant.';
  text(errors, obj, 'lieu', 'Lieu', 300);
  text(errors, obj, 'notes', 'Notes', 20000);
  if (obj.contrat !== undefined && obj.contrat !== null) {
    if (notObject(obj.contrat)) errors.contrat = 'Contrat invalide.';
    else {
      const ce = {};
      oneOf(ce, obj.contrat, 'statut', ids(CONTRAT_ST), 'Statut du contrat');
      oneOf(ce, obj.contrat, 'cautionStatut', ids(CAUTION_ST), 'Statut de la caution');
      num(ce, obj.contrat, 'caution', 'Caution');
      for (const [k, v] of Object.entries(ce)) errors['contrat.' + k] = v;
    }
  }
  if (obj.devis !== undefined && obj.devis !== null) {
    const d = devis(obj.devis);
    for (const [k, v] of Object.entries(d.errors)) errors['devis.' + k] = v;
  }
  for (const k of ['programme', 'taches', 'commissions']) if (!empty(obj[k]) && !Array.isArray(obj[k])) errors[k] = 'Liste attendue.';
  if (Array.isArray(obj.programme)) {
    obj.programme.forEach((e, i) => {
      if (!e || typeof e !== 'object') { errors[`programme.${i}`] = 'Étape invalide.'; return; }
      if (!empty(e.type) && !ids(PROG_TYPES).includes(e.type)) errors[`programme.${i}.type`] = 'Type d’étape inconnu.';
      if (!empty(e.dt) && !DT_RE.test(String(e.dt))) errors[`programme.${i}.dt`] = 'Date invalide.';
    });
  }
  return result(errors);
}

export function devis(obj) {
  const errors = {};
  if (notObject(obj)) return result({ _: 'Devis invalide.' });
  oneOf(errors, obj, 'statut', ids(DEVIS_ST), 'Statut du devis');
  num(errors, obj, 'remise', 'Remise');
  if (!errors.remise && !empty(obj.remise) && Number(obj.remise) > 100) errors.remise = 'La remise dépasse 100 %.';
  num(errors, obj, 'tva', 'TVA');
  date(errors, obj, 'date', 'Date du devis');
  date(errors, obj, 'factureDate', 'Date de facture');
  if (obj.lignes !== undefined && !Array.isArray(obj.lignes)) errors.lignes = 'Liste de lignes attendue.';
  if (Array.isArray(obj.lignes)) {
    obj.lignes.forEach((l, i) => {
      if (!l || typeof l !== 'object') { errors[`lignes.${i}`] = 'Ligne invalide.'; return; }
      if (!isStr(l.d) || !l.d.trim()) errors[`lignes.${i}.d`] = 'Désignation requise.';
      num(errors, l, 'q', 'Quantité'); if (errors.q) { errors[`lignes.${i}.q`] = errors.q; delete errors.q; }
      num(errors, l, 'pu', 'Prix unitaire'); if (errors.pu) { errors[`lignes.${i}.pu`] = errors.pu; delete errors.pu; }
      if (!empty(l.u) && !ids(UNITES).includes(l.u)) errors[`lignes.${i}.u`] = 'Unité inconnue.';
    });
  }
  if (Array.isArray(obj.paiements)) {
    obj.paiements.forEach((p, i) => {
      if (!p || typeof p !== 'object') { errors[`paiements.${i}`] = 'Règlement invalide.'; return; }
      num(errors, p, 'montant', 'Montant'); if (errors.montant) { errors[`paiements.${i}.montant`] = errors.montant; delete errors.montant; }
      if (!empty(p.moyen) && !ids(MOYENS).includes(p.moyen)) errors[`paiements.${i}.moyen`] = 'Moyen de paiement inconnu.';
    });
  }
  return result(errors);
}

export function vehicule(obj) {
  const errors = {};
  if (notObject(obj)) return result({ _: 'Fiche invalide.' });
  if (!isStr(obj.nom) || !obj.nom.trim()) errors.nom = 'Le nom est requis.';
  oneOf(errors, obj, 'statut', ids(VEHICULE_STATUTS), 'Statut');
  num(errors, obj, 'tarifJour', 'Tarif journalier');
  num(errors, obj, 'loyerMois', 'Loyer mensuel');
  num(errors, obj, 'chargesMois', 'Charges mensuelles');
  num(errors, obj, 'km', 'Kilométrage');
  num(errors, obj, 'ordre', 'Ordre');
  date(errors, obj, 'revision', 'Date de révision');
  if (!empty(obj.journal) && !Array.isArray(obj.journal)) errors.journal = 'Liste attendue.';
  if (Array.isArray(obj.journal)) {
    obj.journal.forEach((j, i) => {
      if (!j || typeof j !== 'object') { errors[`journal.${i}`] = 'Entrée invalide.'; return; }
      if (!empty(j.type) && !ids(JOURNAL_T).includes(j.type)) errors[`journal.${i}.type`] = 'Type inconnu.';
      num(errors, j, 'cout', 'Coût'); if (errors.cout) { errors[`journal.${i}.cout`] = errors.cout; delete errors.cout; }
    });
  }
  return result(errors);
}

export function partenaire(obj) {
  const errors = {};
  if (notObject(obj)) return result({ _: 'Fiche invalide.' });
  if (!isStr(obj.nom) || !obj.nom.trim()) errors.nom = 'Le nom est requis.';
  oneOf(errors, obj, 'type', ids(PART_TYPES), 'Type');
  if (!empty(obj.tel) && !telNorm(obj.tel)) errors.tel = 'Numéro de téléphone invalide.';
  if (!empty(obj.email) && (!isStr(obj.email) || !EMAIL_RE.test(obj.email.trim()))) errors.email = 'Adresse e-mail invalide.';
  num(errors, obj, 'commission', 'Commission');
  if (!errors.commission && !empty(obj.commission) && Number(obj.commission) > 100) errors.commission = 'La commission dépasse 100 %.';
  return result(errors);
}

export function service(obj) {
  const errors = {};
  if (notObject(obj)) return result({ _: 'Fiche invalide.' });
  if (!isStr(obj.nom) || !obj.nom.trim()) errors.nom = 'Le nom est requis.';
  num(errors, obj, 'ordre', 'Ordre');
  return result(errors);
}

export const validate = Object.freeze({ client, mission, devis, vehicule, partenaire, service });
