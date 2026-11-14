# Prestataires (loueurs) — contrat

Les prestataires (loueurs de voitures et de vans) confient leurs véhicules à la maison, qui les reloue.
Trois publics, trois surfaces : l'équipe dans le back-office `/app`, le client par lien et WhatsApp, **le prestataire par un lien personnel** (pas de mot de passe, comme l'espace client).

Règles communes : `packages/shared` (`rules.js`, `constants.js`, `validate.js`, types dans `index.d.ts`). Tout est déjà écrit et testé (`test/prestataires.test.js`) ; l'API et le back-office les consomment, ils ne les recopient pas.

## Données

**Partenaire** (`partenaires`) — nouveau type `loueur` (« Loueur / prestataire véhicules »).

| Champ | Rôle |
|---|---|
| `type: 'loueur'` | prestataire de véhicules |
| `societe`, `siren` | raison sociale et SIREN (facultatifs) |
| `aValider: true` | inscription reçue par le formulaire public, pas encore validée par l'équipe ; aucun portail tant que c'est vrai |
| `inscription: {at, vehicules, message}` | ce que le prestataire a annoncé en s'inscrivant |
| `portailToken`, `portailAt` | jeton du portail (24 caractères, `TOKEN_RE`), **posé par le serveur uniquement** : un `PUT /api/doc/partenaires/:id` ne peut ni le créer ni le changer (la valeur stockée est conservée). Il est détruit à la suppression du partenaire |

**Véhicule** (`vehicules`)

| Champ | Rôle |
|---|---|
| `partenaireId` | prestataire propriétaire ; vide = véhicule de la maison |
| `prixAchatJour` | ce que la maison paie au prestataire, par jour |
| `dispos: [{du, au}]` | jours (`AAAA-MM-JJ`, bornes incluses) où le prestataire déclare le véhicule disponible |
| `aValider: true` | véhicule proposé par le prestataire depuis son portail, pas encore validé par l'équipe |

Champs posés par le serveur seulement (`PROTECTED` dans `apps/api/src/lib/docs.js`) : `partenaires.portailToken`, `portailAt`, `aValider` et `missions.dispoDemandes`. Une fiche enregistrée depuis un écran en retard ne peut donc ni écraser la réponse d'un prestataire, ni remettre un partenaire « à valider ».

**Mission** (`missions`) — `dispoDemandes: [{vehiculeId, partenaireId, statut, envoyeAt, reponduAt, canal, par}]`, une entrée par véhicule ; `statut` ∈ `envoyee | oui | non` (`DISPO_ST`) ; `canal` ∈ `whatsapp | lien | portail` (portail = réponse donnée sur le portail, whatsapp = réponse par message).

## Règles (`@amane/shared`)

- `vehicleOn(v, missions, a, b, excl)` : inchangé pour la flotte de la maison. Pour un véhicule de prestataire : `{k:'off', t:'À valider'}` si `aValider` ; réservation ou option d'abord (`b`, `o`) ; sinon libre (`f`) **seulement si chaque jour de [a, b] est dans `dispos`**, sinon `{k:'off', t:'Dispo à demander', ask:true}`.
- `freeVehicles` suit `vehicleOn` : « Qui est libre ? » inclut les véhicules des prestataires sur leurs jours déclarés.
- `normDispos(list)`, `dispoCovers(v, a, b)`, `addDispo(dispos, a, b)`, `dispoDemandeOf(m, vehiculeId)`.
- `margePrestataire(m, v)` → `{cout, vente, marge, taux}` (prix d'achat / jour × `durDays(m)`), `null` pour un véhicule de la maison.

## API

Toutes les routes publiques : `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, limite de débit par IP (comme l'espace client), jeton validé par `TOKEN_RE`, 404 identique pour un jeton inconnu, révoqué ou d'un partenaire `aValider` / supprimé. **Jamais** de prix de vente, de montant client, de téléphone ou d'e-mail de client, ni de nom complet : le prestataire voit le prénom du client (`firstName`), les dates et le lieu de remise.

### Équipe (session)

| Méthode | Chemin | Rôle |
|---|---|---|
| POST | `/api/partenaires/:id/portail` | corps `{reset?: boolean}`. Crée (ou renvoie, ou régénère si `reset`) le jeton. 409 `a_valider` si le partenaire n'est pas validé, 409 `pas_loueur` si le type n'est pas `loueur`. → `{token, url, created, message, waLink}` (`url` = `publicUrl(req, '/p/<token>')`, `message` en français, `waLink` si le partenaire a un téléphone) |
| POST | `/api/partenaires/:id/valider` | valide une inscription : retire `aValider`, crée le jeton. → même réponse que ci-dessus |
| POST | `/api/missions/:id/dispo` | corps `{vehiculeId}`. Le véhicule doit appartenir à un prestataire validé (sinon 409 `pas_prestataire`). Pose ou remet à `envoyee` l'entrée de `dispoDemandes`, s'assure que le portail existe, tente l'envoi WhatsApp au prestataire (texte libre dans la fenêtre de 24 h, sinon modèle `amane_dispo`, paramètres : prénom du contact, véhicule, « du … au … », lien du portail). → `{ok, canal: 'whatsapp' \| 'lien', url, message, waLink}` : si WhatsApp n'est pas configuré ou échoue, `canal: 'lien'` et l'équipe envoie `message` elle-même par `waLink` |

`GET /api/flotte/rentabilite` : pour un véhicule de prestataire, `couts` = `prixAchatJour` × jours loués (pas de loyer ni de charges) ; la réponse porte `partenaireId` par véhicule.

### Prestataire (jeton)

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/p/:token` | page HTML du portail (français, téléphone d'abord, charte Amane via `pages/shell.js`) |
| GET | `/api/portail/:token` | JSON : `{partenaire:{nom}, vehicules:[{id, nom, categorie, plaque, aValider, dispos, reservations:[{du, au, lieu, prenom, titre}]}], demandes:[{missionId, vehiculeId, vehicule, du, au, lieu, prenom, statut}]}` — `reservations` = missions confirmées ou en cours à venir sur ses véhicules ; `demandes` = entrées `dispoDemandes` le concernant sur des missions ouvertes |
| POST | `/api/portail/:token/dispos` | `{vehiculeId, dispos:[{du, au}]}` remplace les jours déclarés du véhicule (le véhicule doit être le sien ; `normDispos`, 60 périodes au plus, pas de date à plus de 2 ans) |
| POST | `/api/portail/:token/vehicules` | `{nom, categorie?, plaque?, prixJour?, notes?}` propose un véhicule : créé avec `partenaireId`, `aValider: true`, `prixAchatJour = prixJour` ; 20 véhicules au plus par prestataire ; alerte à l'équipe |
| POST | `/api/portail/:token/demandes/:missionId` | `{vehiculeId, reponse: 'oui' \| 'non'}`. Met à jour l'entrée (`reponduAt`, `canal: 'portail'`) ; sur `oui`, ajoute la période de la mission aux `dispos` du véhicule (`addDispo`) ; alerte au responsable de la mission (sinon Amel) ; journal d'activité. Idempotent |

Le formulaire HTML de la page poste en `fetch` JSON vers ces routes et fonctionne aussi sans JavaScript pour répondre à une demande (`<form method="post">` → redirection 303 vers `/p/:token`).

### Inscription publique

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/prestataires` | page publique « Devenir prestataire » : formulaire court (société, nom du contact, téléphone, e-mail, SIREN facultatif, véhicules proposés, message), charte Amane |
| POST | `/api/prestataires/inscription` | même garde-fous que `/api/lead` : même origine, champ piège `website`, 5 envois par heure et par IP, tailles bornées, téléphone valide **obligatoire**. Crée un partenaire `type: 'loueur'`, `aValider: true`, `inscription`. Si un partenaire porte déjà ce `telNorm` : on ne crée rien de nouveau et on répond 200 (pas de fuite d'existence). Alerte à l'équipe. → `{ok: true}` |

Une inscription ne donne **aucun accès** : c'est la validation par l'équipe qui crée le portail.

### WhatsApp entrant d'un prestataire

Un message venant du numéro d'un partenaire **validé** (`telNorm` d'un partenaire non supprimé, sans `aValider`) ne crée **ni client ni demande** (comme les numéros de l'équipe). Il est rangé dans une conversation marquée `partenaireId`. S'il répond à une demande en attente — bouton du modèle ou texte seul `oui` / `non` (insensible à la casse, variantes `dispo`, `disponible`, `pas dispo`, `indisponible` ; « ok » seul n'est pas une réponse) — la réponse s'applique à **sa demande `envoyee` la plus récente**, exactement comme sur le portail, avec `canal: 'whatsapp'`, et il reçoit un accusé (« Merci, c'est noté : … »). Tout autre texte reste un message normal, lu par l'équipe.

Modèle Meta à créer (catégorie Utility, français) — `amane_dispo` :
`Bonjour {{1}}, Amane a une demande pour votre {{2}}, {{3}}. Est-il disponible ? Répondez OUI ou NON, ou ouvrez votre espace : {{4}}`
avec deux boutons de réponse rapide « Oui, disponible » et « Non ». À ajouter à `WA_TEMPLATES` (paquet partagé) et au tableau du README de l'API.

## Back-office (`apps/web`)

- **Carnet** : type « Loueur ». Les inscriptions à valider en tête, avec « Valider » et « Refuser » (refuser = suppression). Fiche d'un loueur : bloc « Portail prestataire » (créer le lien, copier, envoyer par WhatsApp, régénérer), liste de ses véhicules.
- **Flotte** : sur la fiche véhicule, « Appartient à » (la maison ou un loueur), « Prix d'achat / jour », jours déclarés (lecture et modification). Pastille du propriétaire sur les cartes. Véhicules « À valider » en tête avec « Valider ».
- **Fiche demande** : si le véhicule choisi est celui d'un prestataire, bloc « Disponibilité prestataire » (non demandée / en attente / disponible / pas disponible) avec « Demander la dispo » (puis le message et le lien WhatsApp si `canal: 'lien'`), et la marge (`margePrestataire`).
- **Planning et « Qui est libre ? »** : rien à coder au-delà d'afficher le libellé `t` (« Dispo à demander », « À valider ») que `vehicleOn` renvoie déjà.
- **À faire** : « Inscription prestataire à valider », « Véhicule proposé à valider », « Prestataire sans réponse depuis 24 h ».
- Faux serveur `msw` (`src/mocks/fakeApi.ts`) : les mêmes routes, pour les tests et le développement.

## Précisions de mise en œuvre

- `reservations[].titre` et le libellé des demandes valent le **service** (« Van VIP »), jamais le titre libre de la mission : les titres automatiques contiennent le nom ou le numéro du client.
- `POST /api/missions/:id/dispo` répond 409 `mission_fermee` pour une mission terminée ou perdue.
- Une réponse de prestataire est **définitive** de son côté : la même réponse répétée → 200 `deja: true`, la réponse contraire → 409 `deja_repondu`. Pour corriger, l'équipe redemande la dispo (l'entrée repasse à `envoyee`).
- WhatsApp entrant : une inscription encore `aValider` ne compte **jamais** comme partenaire (sinon le formulaire public permettrait de couper les demandes d'un client, connu ou futur) ; son message suit le circuit habituel. Le « oui / non » n'est appliqué que pour un loueur validé.
- Alertes à l'équipe : l'inscription n'y porte que le numéro (aucun texte libre de l'inscrit) ; les noms de prestataire et de véhicule y sont dépouillés de toute adresse web.
- L'extraction IA n'attribue seule qu'un véhicule de la flotte de la maison.
- Un « oui » du prestataire vaut jours déclarés sur la période de la mission (`vehicleOn`), même si les `dispos` de la fiche ont été réécrites entre-temps.
- Dans `demandes`, le lieu et le prénom ne sont plus renvoyés pour une demande refusée, ni pour une mission confirmée avec un autre véhicule.
- Limite de débit : l'adresse du client est celle que voit le proxy de confiance (`TRUST_PROXY`, 1 par défaut), jamais `X-Real-IP` ni un `X-Forwarded-For` fourni par le client ; les inscriptions sont en plus plafonnées à 40 par heure toutes adresses confondues.
- Suppression d'un partenaire : son lien est détruit, `aValider` est conservé (une inscription refusée puis ré-enregistrée ne revient pas validée).
- Réponses enrichies : `dispos` → `{ok, dispos}` ; `vehicules` → `{ok, id, vehicule}` ; `demandes/:missionId` → `{ok, statut, deja}`.
- Sans JavaScript, la page du portail permet de répondre à une demande et de proposer un véhicule ; déclarer des jours demande JavaScript.

## Hors périmètre de cette étape

E-mails et SMS (il faut d'abord un nom de domaine validé dans Brevo), paiement des prestataires, appli mobile (elle lit `vehicleOn` du paquet partagé et suit donc sans changement), CRM historique `crm/` (figé : il affiche les véhicules des prestataires comme les autres).
