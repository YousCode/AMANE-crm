// Constantes métier d'Amane. Valeurs copiées de crm/index.html (lignes ~808-820 et ~1353-1375)
// et de crm/tests/mock.js (flotte et services de départ). Objets gelés : à ne jamais modifier.

const freeze = (v) => (Array.isArray(v) ? Object.freeze(v.map(freeze)) : v && typeof v === 'object' ? Object.freeze(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, freeze(x)]))) : v);

/** Les trois personnes de la maison. */
export const TEAM = freeze([
  { id: 'amel', nom: 'Amel', role: 'Relation client' },
  { id: 'youssouf', nom: 'Youssouf', role: 'Tech & flotte' },
  { id: 'aziz', nom: 'Aziz', role: 'Contrats & conformité' },
]);
export const TEAM_IDS = freeze(TEAM.map((t) => t.id));

/** Statuts d'une demande (mission), dans l'ordre du parcours. */
export const STATUTS = freeze([
  { id: 'nouvelle', label: 'Nouvelle' },
  { id: 'proposition', label: 'Proposition' },
  { id: 'confirmee', label: 'Confirmée' },
  { id: 'encours', label: 'En cours' },
  { id: 'terminee', label: 'Terminée' },
  { id: 'perdue', label: 'Perdue' },
]);
/** Statuts « ouverts » : une demande encore vivante. */
export const OPEN_STATUTS = freeze(['nouvelle', 'proposition', 'confirmee', 'encours']);
/** Statuts qui réservent un véhicule (BOOK) ou posent une option (OPT). */
export const BOOK_STATUTS = freeze(['confirmee', 'encours']);
export const OPT_STATUTS = freeze(['nouvelle', 'proposition']);
/** Statuts comptés dans le chiffre d'affaires. */
export const ACTIVE_STATUTS = freeze(['confirmee', 'encours', 'terminee']);

export const CLIENT_STATUTS = freeze([
  { id: 'prospect', label: 'Prospect' },
  { id: 'client', label: 'Client' },
  { id: 'habitue', label: 'Habitué' },
  { id: 'vip', label: 'VIP' },
]);
export const CLIENT_TAGS = freeze([
  { id: 'vip', label: 'VIP' },
  { id: 'regulier', label: 'Régulier' },
  { id: 'delegation', label: 'Délégation' },
  { id: 'famille', label: 'Famille' },
  { id: 'entreprise', label: 'Entreprise' },
]);
export const LANGUES = freeze(['FR', 'EN', 'AR', 'RU', 'ZH', 'ES', 'IT', 'DE']);
/** Langues des documents client (devis, facture, programme, carnet). */
export const DOC_LANGS = freeze(['FR', 'EN', 'ES', 'AR']);
/** Langues des réponses WhatsApp (réponses automatiques, rappels, réponses rapides). */
export const WA_LANGS = freeze(['FR', 'EN', 'ES', 'AR', 'RU']);
export const CANAUX = freeze(['WhatsApp', 'Instagram', 'Site', 'Palace / hôtel', 'Apporteur', 'Bouche-à-oreille', 'E-mail', 'Autre']);
export const CONTRAT_ST = freeze([{ id: 'a_rediger', label: 'À rédiger' }, { id: 'envoye', label: 'Envoyé' }, { id: 'signe', label: 'Signé' }]);
export const CAUTION_ST = freeze([{ id: 'aucune', label: 'Aucune' }, { id: 'preautorisee', label: 'Pré-autorisée' }, { id: 'encaissee', label: 'Encaissée' }, { id: 'restituee', label: 'Restituée' }]);
export const PAIEMENT_ST = freeze([{ id: 'non', label: 'Non payé' }, { id: 'acompte', label: 'Acompte reçu' }, { id: 'solde', label: 'Soldé' }]);
export const DEVIS_ST = freeze([{ id: 'brouillon', label: 'Brouillon' }, { id: 'envoye', label: 'Envoyé' }, { id: 'accepte', label: 'Accepté' }, { id: 'refuse', label: 'Refusé' }]);
export const UNITES = freeze([{ id: 'jour', label: 'jour' }, { id: 'heure', label: 'heure' }, { id: 'forfait', label: 'forfait' }]);
export const MOYENS = freeze([{ id: 'virement', label: 'Virement' }, { id: 'cb', label: 'Carte bancaire' }, { id: 'especes', label: 'Espèces' }, { id: 'lien', label: 'Lien de paiement' }]);
export const PART_TYPES = freeze([
  { id: 'chauffeur', label: 'Chauffeur' }, { id: 'restaurant', label: 'Restaurant' }, { id: 'hotel', label: 'Hôtel / palace' },
  { id: 'boutique', label: 'Boutique' }, { id: 'garage', label: 'Garage / entretien' }, { id: 'assurance', label: 'Assurance' }, { id: 'autre', label: 'Autre' },
]);
export const PROG_TYPES = freeze([
  { id: 'transfert', label: 'Transfert' }, { id: 'restaurant', label: 'Restaurant' }, { id: 'shopping', label: 'Shopping' },
  { id: 'visite', label: 'Visite' }, { id: 'hotel', label: 'Hôtel' }, { id: 'autre', label: 'Autre' },
]);
export const JOURNAL_T = freeze([
  { id: 'entretien', label: 'Entretien' }, { id: 'reparation', label: 'Réparation' }, { id: 'dommage', label: 'Dommage' },
  { id: 'pv', label: 'PV / amende' }, { id: 'controle', label: 'Contrôle' }, { id: 'autre', label: 'Autre' },
]);
export const CARBURANT = freeze(['1/4', '1/2', '3/4', 'Plein']);
export const PRIORITES = freeze(['haute', 'normale', 'basse']);

/** Tâches types par service : [libellé, responsable, décalage en jours depuis le début, ou 'fin+n']. */
export const TASK_TPL = freeze({
  location: [['Préparation et lavage du véhicule', 'youssouf', -1], ['Plein et contrôle des niveaux', 'youssouf', -1], ['État des lieux départ', 'aziz', 0], ['Remise des clés', 'youssouf', 0], ['Retour du véhicule', 'youssouf', 'fin+0'], ['État des lieux retour', 'aziz', 'fin+0'], ['Restitution de la caution', 'aziz', 'fin+2']],
  chauffeur: [['Confirmer le chauffeur', 'youssouf', -2], ['Envoyer le nom du chauffeur au client', 'amel', -1], ['Préparer eau, presse et chargeurs', 'youssouf', 0]],
  van: [['Préparer le van (eau, sièges enfant si besoin)', 'youssouf', -1], ['Confirmer chauffeur et horaires au client', 'amel', -1]],
  transfert: [['Vérifier le numéro de vol et l’horaire', 'amel', -1], ['Pancarte nominative', 'youssouf', 0], ['Confirmer l’arrivée au client', 'amel', 0]],
  shopping: [['Réserver les rendez-vous en boutique', 'amel', -3], ['Prévenir les boutiques (commission)', 'amel', -2], ['Livraison des achats à l’hôtel', 'youssouf', 'fin+0']],
  sejour: [['Envoyer le programme au client', 'amel', -3], ['Réserver tables et rendez-vous', 'amel', -3], ['Préparer véhicule et chauffeur', 'youssouf', -1], ['Facture et solde', 'aziz', 'fin+0']],
  conciergerie: [['Confirmer la réservation', 'amel', -1], ['Rappel au client la veille', 'amel', -1]],
  clip: [['Repérage et autorisations', 'youssouf', -3], ['Préparation du véhicule', 'youssouf', -1], ['Livraison du montage', 'youssouf', 'fin+5']],
});

/** Les huit services de la maison (identiques à la collection `services` de départ). */
export const SERVICES = freeze([
  { id: 'location', nom: 'Voiture d’exception', ordre: 1, tarif: 'x' },
  { id: 'chauffeur', nom: 'Chauffeur VIP', ordre: 2 },
  { id: 'van', nom: 'Van VIP', ordre: 3 },
  { id: 'transfert', nom: 'Transfert aéroport', ordre: 4 },
  { id: 'shopping', nom: 'Personal shopping', ordre: 5 },
  { id: 'sejour', nom: 'Séjour clé en main', ordre: 6 },
  { id: 'conciergerie', nom: 'Conciergerie sur demande', ordre: 7 },
  { id: 'clip', nom: 'Clip souvenir', ordre: 8 },
]);
export const SERVICE_IDS = freeze(SERVICES.map((s) => s.id));
/** Même contenu, indexé par id (forme de la collection Mongo `services`). */
export const SERVICES_DEFAUT = freeze(Object.fromEntries(SERVICES.map(({ id, ...rest }) => [id, rest])));

/** Flotte de départ (identique à crm/tests/mock.js et lib/seed.js), indexée par id. */
export const VEHICULES_DEFAUT = freeze({
  urus: { nom: 'Urus SE', categorie: 'Super SUV', tarifJour: 1000, loyerMois: 2430, chargesMois: 500, statut: 'disponible', ordre: 1 },
  f296: { nom: 'Ferrari 296 GTB', categorie: 'Supercar', tarifJour: 1300, loyerMois: 2240, chargesMois: 500, statut: 'disponible', ordre: 2 },
  g63: { nom: 'G 63', categorie: 'SUV', tarifJour: 650, loyerMois: 1670, chargesMois: 500, statut: 'disponible', ordre: 3 },
  m5: { nom: 'M5 Touring', categorie: 'Break sport', tarifJour: 450, loyerMois: 1480, chargesMois: 500, statut: 'disponible', ordre: 4 },
  classev: { nom: 'Classe V VIP', categorie: 'Van 7-8 places', tarifJour: 300, loyerMois: 930, chargesMois: 500, statut: 'disponible', ordre: 5 },
});
export const VEHICULE_STATUTS = freeze([{ id: 'disponible', label: 'Disponible' }, { id: 'entretien', label: 'En entretien' }, { id: 'indisponible', label: 'Indisponible' }]);

/** Modèles WhatsApp approuvés (hors fenêtre de 24 h) et leurs variables, dans l'ordre des paramètres de corps. */
export const WA_TEMPLATES = freeze([
  { name: 'amane_relance', label: 'Relance', vars: ['prenom', 'objet'], langs: ['fr', 'en', 'es', 'ar', 'ru'] },
  { name: 'amane_rappel', label: 'Rappel de mission', vars: ['prenom', 'service', 'date', 'heure', 'lieu'], langs: ['fr', 'en', 'es', 'ar', 'ru'] },
  { name: 'amane_devis', label: 'Devis à consulter', vars: ['prenom', 'numero', 'lien'], langs: ['fr', 'en', 'es', 'ar', 'ru'] },
  { name: 'amane_alerte', label: 'Alerte équipe', vars: ['nom', 'extrait'], langs: ['fr'] },
]);

/** Types de rappels automatiques (collection `rappels`). */
export const RAPPEL_TYPES = freeze([
  { id: 'veille', label: 'Veille de mission (J-1, 18 h)' },
  { id: 'merci', label: 'Remerciement (J+1, 10 h)' },
  { id: 'acompte', label: 'Acompte non reçu (J-3)' },
]);
/** Types de relances calculées (`GET /api/relances`). */
export const RELANCE_TYPES = freeze([
  { id: 'proposition', label: 'Proposition sans réponse (> 48 h)' },
  { id: 'habitue', label: 'Habitué sans mission (> 90 j)' },
  { id: 'anniversaire', label: 'Date importante sous 21 j' },
  { id: 'acompte', label: 'Acompte non reçu (J-3)' },
  { id: 'facture', label: 'Facture en retard' },
]);
/** Types de messages (collection `messages`). */
export const MESSAGE_TYPES = freeze(['text', 'image', 'video', 'document', 'audio', 'sticker', 'location', 'contacts', 'reaction', 'template', 'note', 'button', 'interactive']);
export const SLOGAN = 'Arrive as a Guest. Leave with a Story.';

/** Libellé d'une valeur dans une liste {id,label}. */
export function labelOf(list, id, fallback = '—') {
  const x = (list || []).find((o) => o.id === id);
  return x ? x.label || x.nom : fallback;
}
