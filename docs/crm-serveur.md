# CRM Amane — version serveur (Vercel + MongoDB Atlas + WhatsApp)

Contrat partagé entre le serveur (`api/`, `lib/`) et le CRM (`crm/index.html`).
Toute évolution du contrat se note ici.

## Hébergement
- Un seul projet Vercel à la racine du dépôt. `vercel.json` sert le dossier `site/` (site + `site/crm/` généré) et les fonctions de `api/`.
- Node 20+, ES modules (`"type":"module"` dans `package.json` racine). Seule dépendance d'exécution : `mongodb`.
- **Plan Hobby : 12 fonctions maximum par déploiement.** Chaque fichier `.js` sous `api/` est une fonction. Le code partagé va dans `lib/` (hors `api/`). Cible : 8 fichiers ou moins sous `api/`, les sous-routes passent par `vercel.json` (rewrites) ou par un paramètre.
- Base : MongoDB Atlas, cluster `amane` (Paris, EU_WEST_3), base `amane`, utilisateur `amane-app` (readWrite sur `amane` seulement).

## Variables d'environnement (Vercel → Settings → Environment Variables)
| Nom | Rôle | Obligatoire |
|---|---|---|
| `MONGODB_URI` | chaîne `mongodb+srv://…` | oui |
| `MONGODB_DB` | `amane` | oui |
| `AUTH_SECRET` | 32+ caractères aléatoires, signe les sessions | oui |
| `AMANE_SETUP_CODE` | code pour créer/réinitialiser les codes PIN | oui |
| `WHATSAPP_TOKEN` | jeton permanent (utilisateur système Meta) | WhatsApp |
| `WHATSAPP_PHONE_NUMBER_ID` | id du numéro WhatsApp Business | WhatsApp |
| `WHATSAPP_VERIFY_TOKEN` | chaîne choisie, sert à valider le webhook | WhatsApp |
| `WHATSAPP_APP_SECRET` | secret de l'app Meta, vérifie la signature | WhatsApp |
| `ANTHROPIC_API_KEY` | analyse des messages, brouillons, Majordome | IA |
| `TEAM_ALERT_NUMBERS` | ex. `amel:33600000001,aziz:33600000002` | alertes |

Sans `WHATSAPP_*` ou `ANTHROPIC_API_KEY`, tout le reste fonctionne ; `/api/health` dit ce qui est actif.

## Données
Collections : `clients`, `missions`, `vehicules`, `services`, `partenaires`, `reglages`, `conversations`, `messages`, `activity`, `users`, `meta`, `photos`, `ratelimits`.
- Stockage : `_id` = id texte de la fiche. L'API expose `id` (jamais `_id`).
- Chaque écriture pose `updatedAt` (heure serveur, ISO), `updatedBy` (id utilisateur ou `whatsapp`/`site`/`ia`), `createdAt` si nouvelle.
- Suppression = douce : `{_deleted:true, updatedAt}`. La synchro renvoie l'id dans `deleted`.
- Téléphone normalisé `telNorm` (chiffres, indicatif inclus, `0612…` → `33612…`) posé par le serveur sur `clients` et `partenaires` à chaque écriture.
- `reglages/general` : `{autoReply:true, horaires:{debut:'09:00',fin:'21:00'}, fuseau:'Europe/Paris', textes:{FR:{jour,nuit},EN:{…},AR:{…},ES:{…},RU:{…}}}`. Valeurs par défaut côté serveur si absent.
- `conversations` : `_id` = numéro WhatsApp (chiffres). `{phone, nom, clientId, missionId, lang, lastAt, lastText, lastDir, unread, windowUntil, aiSummary, aiDraft, aiFields}`.
- `messages` : `_id` = wamid (ou id généré pour les sortants). `{convId, dir:'in'|'out', type, text, at, status, by, media?}`.
- `activity` : `{at, user, col, docId, action:'create'|'update'|'delete'|'whatsapp'|'lead', resume}` (resume en français : « statut : Nouvelle → Confirmée », « montant modifié »…).

## Authentification
- Trois personnes : `amel` (Relation client), `youssouf` (Tech & flotte), `aziz` (Contrats & conformité). Connexion = prénom + code PIN (4 à 8 chiffres), haché avec scrypt + sel.
- Cookie `amane_s` httpOnly, Secure, SameSite=Lax, 30 jours, signé HMAC-SHA256 avec `AUTH_SECRET` (`userId.expiration.signature`).
- 5 échecs en 15 min pour un même prénom ou une même IP → 429.

## Routes
Toutes en JSON. Erreurs : `{error:'code', message:'texte français'}` avec le bon statut HTTP.

| Méthode | Chemin | Accès | Corps / réponse |
|---|---|---|---|
| GET | `/api/health` | public | `{ok, db, whatsapp, ia, version}` |
| POST | `/api/auth/setup` | public + code | `{code, userId, pin}` → `{ok}` |
| POST | `/api/auth/login` | public | `{userId, pin}` → `{user:{id,nom,role}}` + cookie ; 401 `bad_pin` ; 409 `no_pin` (PIN jamais créé) ; 429 |
| POST | `/api/auth/logout` | session | `{ok}` |
| GET | `/api/auth/me` | session | `{user}` ; 401 |
| GET | `/api/sync?since=ISO` | session | `{now, changes:{clients:[],missions:[],vehicules:[],services:[],partenaires:[],reglages:[],conversations:[],messages:[]}, deleted:{col:[ids]}, compteurs:{}}`. Sans `since` : tout, sauf `messages` limités aux 60 derniers jours. `now` sert de `since` suivant (le serveur retire 2 s de marge). |
| PUT | `/api/doc/:col/:id` | session | corps = champs de la fiche → `{id, updatedAt}`. Colonnes permises : `clients, missions, vehicules, services, partenaires, reglages`. 512 Ko max. |
| DELETE | `/api/doc/:col/:id` | session | suppression douce → `{ok}` |
| POST | `/api/counter` | session | `{key}` (ex. `devis-2026`) → `{n}` (incrément atomique) |
| GET | `/api/activity?docId=&limit=50` | session | `{items:[…]}` récent d'abord ; sans `docId` : fil global |
| POST | `/api/photo` | session | `{dataUrl}` JPEG/PNG/WebP ≤ 600 Ko → `{id, url:'/api/photo?id=…'}` |
| GET | `/api/photo?id=` | session | l'image (Cache-Control privé, 1 an) |
| POST | `/api/ai` | session | `{system?, messages:[{role,content}], max_tokens?}` → `{text}` (Claude, côté serveur) ; 503 `ia_off` |
| GET | `/api/whatsapp` | Meta | vérification du webhook (`hub.verify_token`) → renvoie `hub.challenge` |
| POST | `/api/whatsapp` | Meta, signé | réception (voir ci-dessous) ; répond 200 vite |
| POST | `/api/whatsapp/send` | session | `{convId, text}` ou `{convId, template:{name,lang,params}}` → `{id}` ; 409 `window_closed` hors fenêtre de 24 h sans modèle ; 503 `whatsapp_off` |
| POST | `/api/whatsapp/read` | session | `{convId}` → remet `unread` à 0 |
| POST | `/api/lead` | public | formulaire du site `{nom, tel, email, langue, service, date, message, website}` (`website` = piège à robots, doit être vide) → `{ok}` ; 5 par heure et par IP |

## Arrivée d'un message WhatsApp
1. Vérifier `X-Hub-Signature-256` (HMAC du corps brut avec `WHATSAPP_APP_SECRET`). Signature fausse → 401.
2. Idempotent sur le `wamid` (Meta renvoie parfois deux fois).
3. Conversation créée ou mise à jour (`unread+1`, `windowUntil = maintenant + 24 h`, langue détectée).
4. Client retrouvé par `telNorm`, sinon créé : `{nom: nom du profil WhatsApp, tel:'+…', canal:'WhatsApp', statut:'prospect', langue, responsable:'amel'}`.
5. Pas de demande ouverte (`nouvelle, proposition, confirmee, encours`) de ce client depuis 30 jours → demande créée : `{titre:'WhatsApp — <début du message>', statut:'nouvelle', service deviné, responsable:'amel', source:'whatsapp', convId}`.
6. Réponse automatique si `reglages.autoReply` et aucun message sortant vers ce numéro depuis 12 h : texte « jour » ou « nuit » selon les horaires, dans la langue détectée, prénom inséré. Ce n'est jamais un prix ni un engagement.
7. Si `ANTHROPIC_API_KEY` : Claude extrait `{service, vehicule, debut, fin, lieu, passagers, budget, langue, urgence}` → remplit les champs **vides** de la demande, pose `aiSummary` (une phrase) et `aiDraft` (brouillon de réponse, **jamais envoyé seul**).
8. Alerte équipe : si `TEAM_ALERT_NUMBERS`, message au responsable (modèle `amane_alerte` hors fenêtre, sinon texte).
9. Statuts (envoyé, distribué, lu) mis à jour sur les messages sortants.

## Côté CRM (`crm/index.html`)
Trois modes, choisis au démarrage :
1. **claude.ai** (`window.claude` présent) : inchangé.
2. **serveur** (`/api/auth/me` répond) : connexion par PIN, synchro toutes les 4 s + au retour sur l'onglet, écran Messages, historique, photos, Majordome via `/api/ai`.
3. **appareil** (pas d'API) : base dans le navigateur, comme aujourd'hui.
