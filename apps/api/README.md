# Amane — API v2 (`apps/api`)

Serveur Express 5 + MongoDB (pilote 6) + WebSocket (`ws`) + tâches de fond (`node-cron`). Il reprend intégralement le contrat `docs/crm-serveur.md` (mêmes chemins : l'ancien `crm/index.html` fonctionne tel quel) et ajoute tout ce que décrit `docs/architecture-v2.md`. Le code métier partagé vient de `@amane/shared` (`packages/shared`).

## Lancer

```bash
npm install --legacy-peer-deps            # à la racine (workspaces npm)
cd apps/api
FAKE_DB=1 FAKE_AI=1 npm run dev           # http://localhost:3000 — base en mémoire, PIN 1234, WhatsApp/IA simulés
npm test                                  # node --test (API HTTP réelle sur un port local, base en mémoire, fetch stubbé)
```

Avec une vraie base : copier `.env.example`, renseigner au minimum `MONGODB_URI`, `MONGODB_DB`, `AUTH_SECRET` (32+ car.), `AMANE_SETUP_CODE`, puis `npm start`. Créer les PIN : `POST /api/auth/setup {code, userId, pin}`.

Ce que sert le processus :

| Chemin | Contenu |
|---|---|
| `/api/*` | l'API JSON (ci-dessous) |
| `/ws` | WebSocket temps réel (cookie de session requis) |
| `/app` | le back-office React si `apps/web/dist` existe (repli SPA) |
| `/crm` | le CRM historique (`crm/index.html` enveloppé en document complet, sinon `site/crm/index.html`) |
| `/` et fichiers de `site/` | le site vitrine (`site/vercel.html`) |
| `/d/:token`, `/api/espace/:token` (alias `/espace/:token`) | pages publiques : devis partagé, espace client |

## Mode développement (`FAKE_DB=1`)

- Base en mémoire (`src/lib/fakedb.js`), flotte et services de départ, modèles WhatsApp dans `reglages/templates`.
- PIN de démo `1234` pour Amel, Youssouf et Aziz (`DEV_PINS=none` pour tester `POST /api/auth/setup`, code `dev`).
- WhatsApp simulé (`WHATSAPP_*` posés automatiquement si absents), push Expo simulé, et avec `FAKE_AI=1` : IA (extraction, traduction `[XX] texte`, tableau du lundi, Majordome) et transcription Whisper simulées.
- Cookie de session sans `Secure` en http local.
- Routes de simulation :

| Route | Rôle |
|---|---|
| `POST /__dev/inbound` | message entrant signé comme Meta. `{from, name, text, id?, replyTo?, type}` avec `type` = `text` (défaut), `image`/`video`/`document`/`sticker` (`caption`, `filename`, `mime`, `mediaId`), `audio` (vocal, `voice:false` pour un audio simple), `location` (`lat`, `lng`, `locName`, `address`), `contacts` (`contact:{nom,tel}`), `reaction` (`reactionTo`, `emoji`). Attend la fin des suites (réponse automatique, IA, médias) avant de répondre. |
| `POST /__dev/status` | `{id, status:'sent'|'delivered'|'read'|'failed', code?}` statut Meta d'un message sortant |
| `GET /__dev/outbox` · `DELETE /__dev/outbox` | tout ce qui est parti : `kind` = `message` (vers Meta, avec `id` = wamid), `read` (accusé de lecture), `upload` (média), `ia`, `whisper`, `push` |
| `POST /__dev/clock {now}` | fige l'horloge du serveur (`null` = heure réelle) : fenêtres 24 h, jour/nuit, rappels |
| `POST /__dev/run {job}` | lance `rappels`, `alertes` ou `digest` |
| `GET /__dev/state` · `POST /__dev/drain` | tâches de fond en attente, connexions WS ; attendre la fin des tâches |

Exemple : `curl -X POST localhost:3000/__dev/inbound -H 'content-type: application/json' -d '{"from":"971501234567","name":"Khalid","type":"audio"}'` puis `GET /api/sync` : le vocal est téléchargé (`media.photoId`), transcrit (`transcript`) et traduit (`translation`).

## Routes

Toutes en JSON sauf mention. Erreurs : `{error:'code', message:'texte français'}`. Session = cookie `amane_s` (ou en-tête `Cookie` envoyé par le mobile). Les écritures vérifient l'en-tête `Origin` (même hôte, `PUBLIC_URL`, `CORS_ORIGINS`, origines locales Expo/Vite en dev) et renvoient les en-têtes CORS pour une origine acceptée ; `POST /api/lead` reste strictement même origine.

### Contrat v1 (inchangé, voir `docs/crm-serveur.md`)
`GET /api/health` · `POST /api/auth/setup|login|logout` · `GET /api/auth/me` · `GET /api/sync?since=` · `PUT|DELETE /api/doc/:col/:id` · `POST /api/counter` · `GET /api/activity` · `POST|GET /api/photo` · `POST /api/ai` · `GET|POST /api/whatsapp` (Meta) · `POST /api/whatsapp/send` · `POST /api/whatsapp/read` · `POST /api/lead`. Les formes réécrites (`/api/auth?action=`, `/api/doc?col=&id=`, `/api/doc?op=counter|activity`, `/api/whatsapp?action=`) sont acceptées aussi.

`GET /api/health?detail=1` ajoute `transcription`, `push`, `ws`, `cron`, `fake`.

### Ajouts v2

| Méthode | Chemin | Rôle |
|---|---|---|
| WS | `/ws` | après `hello`, le serveur pousse `{type:'change', col, doc}` (clients, missions, vehicules, services, partenaires, reglages, rappels), `{type:'deleted', col, id}`, `{type:'message', message}`, `{type:'conversation', conversation}`, `{type:'rappel', rappel}`. `{type:'ping'}` → `pong`. Sans session : 401 à la montée. |
| POST | `/api/translate` | `{text, to, from?, context?:'message'|'document', messageId?}` → `{text, from, cached}` ; cache `translations` (sha256) ; `messageId` d'un message reçu pose `translation` dessus ; 503 `ia_off` |
| POST | `/api/transcribe` | `{mediaId}` (wamid du vocal, ou id média Meta) → `{text, lang, translation, cached, messageId}` ; 503 `transcribe_off` |
| GET | `/api/digest?semaine=AAAA-MM-JJ|AAAA-Www` | tableau du lundi : `{du, au, caSemainePassee, missionsAVenir[], vehiculesRevision[], facturesRetard[], relances[], texte, ia}` |
| POST | `/api/digest/send` | envoie le tableau à `TEAM_ALERT_NUMBERS` (une fois par jour) |
| GET | `/api/relances?type=` | `[{type, clientId, missionId?, raison, messageSuggere, depuis, lang, nom, tel, convId}]` |
| GET | `/api/rappels?missionId=&dus=1` | journal des rappels (`rappels`), `dus` = ce qui serait envoyé maintenant |
| POST | `/api/rappels/run` · `/api/alertes/run` | session ou `X-Internal-Key: INTERNAL_KEY` ; lancés aussi par le cron |
| GET/POST | `/api/devis/:id/share` | `{token, url, created, lang, message, waLink, vuAt, acceptedAt, statut}` (`id` = la demande) ; 409 `devis_vide` |
| GET | `/d/:token` | page HTML du devis (`?format=json` pour les données) ; ouverture → `devis.vuAt` |
| POST | `/d/:token/accepter` | accepte (303 vers la page, ou JSON avec `Accept: application/json`) : `devis.statut='accepte'`, `acceptedAt`, demande → confirmée, activité, alerte + push équipe, WS |
| POST | `/api/missions/:id/espace` | `{token, url, created, message, waLink}` |
| GET | `/api/espace/:token` | page HTML de l'espace client (`Accept: application/json` ou `?format=json` → données : client, séjour, chauffeur, programme, documents, solde, contact) ; `/devis`, `/facture`, `/photo/:id` |
| GET | `/api/flotte/rentabilite?mois=AAAA-MM` | par véhicule : loyer, charges, joursLoues, ca (prorata des jours dans le mois), coutsJournal, margeNette, tauxOccupation + total |
| POST | `/api/push/register` · `/api/push/unregister` | `{token:'ExponentPushToken[…]', platform}` ; envois Expo à : nouvelle demande / message reçu (responsable), demande du site (Amel), devis accepté, rappel envoyé, message sans réponse 6 h, révision J-7 |
| GET | `/api/media/:id` | tout média stocké (`photos`) : images, vidéos, PDF, vocaux (`?download=1`) |
| POST | `/api/whatsapp/send` | en plus du texte et du modèle : `{convId, media:{type:'image'|'document'|'video'|'audio', photoId|url, caption, filename}}` (une `photoId` est téléversée chez Meta), `{convId, location:{lat,lng,name,address}}`, `{convId, contact:{partenaireId}|{nom,tel,email,org}}`, `replyTo` (wamid cité), `originalText` (le français d'origine, rangé en `originalText` et `translation`). `media.url` = `/api/missions/:id/devis.pdf` ou `facture.pdf` → envoi du lien public (devis / espace client) dans la langue du client ; `location` sans coordonnées → itinéraire en texte. |
| POST | `/api/whatsapp/note` | `{convId, text, assigne?}` → note interne `dir:'note'` (jamais envoyée) |
| POST | `/api/whatsapp/assign` | `{convId, assigne:'amel'|'youssouf'|'aziz'|'', note?}` → `conversation.assigne` + note de transfert |
| GET | `/api/whatsapp/templates` | modèles effectifs (`reglages/templates` ∪ défauts) : `{name, label, vars, langs, body}` |
| GET | `/api/conversations/:id/messages?limit=&before=` | historique paginé au-delà des 60 jours de `/api/sync` |
| PUT | `/api/doc/clients/:id` | champs enrichis acceptés tels quels : `entourage[]`, `datesImportantes[{date:'AAAA-MM-JJ'|'MM-JJ', label}]`, `allergies`, `marques`, `attentions[]`, `langue`, `tags[]` |
| PUT | `/api/doc/vehicules/:id` | une nouvelle entrée `journal[]` de type `pv` déclenche l'alerte « PV reçu » ; `revision` (AAAA-MM-JJ) alimente l'alerte J-7 |

### Données ajoutées
- `messages` : `media:{id, mime, filename?, caption?, voice?, photoId?, url?}`, `location`, `contacts[]`, `reactionTo`+`emoji`, `replyTo`, `translation`/`translationLang`/`sourceLang`, `transcript`/`transcriptLang`, `originalText`, `erreurCode`+`erreur` (texte Meta lisible), `dir:'note'`, `rappel`. Sortants : `by` = membre, `auto`, `rappel`.
- `conversations` : `assigne`, `lastInId`, `lastReadId`, `lastHumanOutAt` (la réponse automatique ne compte pas comme réponse), `alerte6hFor`.
- `missions` : `devis.shareToken/shareAt/vuAt/acceptedAt/sentAt`, `espaceToken`.
- Collections : `translations`, `rappels` (`_id` = `type:missionId`, `statut` envoye|echec|ignore), `push_tokens`, `photos` (tout média, ≤ 16 Mo, `mediaId` Meta).
- `reglages/rappels` : `{actifs:{veille,merci,acompte}, textes:{FR|EN|ES|AR|RU:{veille,merci,acompte}}}` (variables `{prenom} {service} {voiture} {date} {heure} {lieu} {montant}`). `reglages/templates` : `{modeles:[{name,label,vars,langs,body}]}`.

### Tâches de fond (`CRON_ENABLED=1`, une seule instance)
- toutes les 10 min : rappels (veille J-1 18 h, remerciement J+1 10 h, acompte J-3 9 h, heure de Paris) ;
- toutes les heures : alertes (message client sans réponse d'un humain depuis 6 h, révision à J-7) ;
- lundi 8 h 30 Paris : tableau du lundi à `TEAM_ALERT_NUMBERS` (texte si fenêtre ouverte, sinon modèle `amane_alerte`).

Sans cron (plusieurs instances, ou hébergeur sans processus permanent), appeler `POST /api/rappels/run`, `/api/alertes/run`, `/api/digest/send` avec `X-Internal-Key` depuis un planificateur externe.

## IA
Client Anthropic en HTTP direct (`src/lib/ai.js`) : modèle `claude-sonnet-5-5`, en-tête `anthropic-version: 2026-10-21`, repli serveur `fallbacks:'default'` (bêta `server-side-fallback-2026-07-01`), effort `low`, sortie JSON contrainte (`output_config.format` json_schema) pour l'extraction et la traduction, délai 8 s (25 s pour le Majordome). Toute défaillance est sans effet sur le reste : 503 `ia_off` sans clé, 502/504/422 sinon, jamais de message client cassé.

## Déploiement

### MongoDB Atlas
Cluster `amane` (Paris, EU_WEST_3), base `amane`, utilisateur `amane-app` (readWrite). Les index et les données de départ sont posés au premier démarrage (`meta/schema`). Autoriser l'IP sortante de l'hébergeur (ou `0.0.0.0/0` avec un mot de passe fort).

### Railway / Render / Fly (Docker)
Image : `docker build -f apps/api/Dockerfile -t amane-api .` depuis la racine (le Dockerfile copie `packages/shared`, `apps/api`, `crm`, `site` et `apps/web/dist` : construire le back-office avant, ou créer un dossier `apps/web/dist` vide). `apps/api/railway.json` et `apps/api/render.yaml` sont fournis ; sur Fly : `fly launch --dockerfile apps/api/Dockerfile`, `fly secrets set …`, une seule machine avec `CRON_ENABLED=1`. Variables : voir `.env.example`. `PUBLIC_URL` = l'URL publique (liens `/d/:token`, CORS du back-office). Santé : `GET /api/health`.

### Meta — WhatsApp Cloud API
1. Meta for Developers → app « Business » → produit WhatsApp. Noter le **Phone number ID** (`WHATSAPP_PHONE_NUMBER_ID`) et créer un **utilisateur système** (Business Settings → System users) avec un jeton permanent, permissions `whatsapp_business_messaging` + `whatsapp_business_management` (`WHATSAPP_TOKEN`). `WHATSAPP_APP_SECRET` = App settings → Basic → App secret.
2. Webhook : URL `https://<PUBLIC_URL>/api/whatsapp`, jeton de vérification = `WHATSAPP_VERIFY_TOKEN`, abonnement au champ `messages`.
3. Modèles à créer (WhatsApp Manager → Message templates, catégorie *Utility*, corps exact ; variables `{{n}}` dans l'ordre) :

| Nom | Langues | Corps |
|---|---|---|
| `amane_relance` | fr, en, es, ar, ru | `Bonjour {{1}}, Amel de la maison Amane. Je reviens vers vous au sujet de : {{2}}. Répondez à ce message pour reprendre la conversation.` ({{1}} prénom, {{2}} objet) |
| `amane_rappel` | fr, en, es, ar, ru | `Bonjour {{1}}, nous vous attendons pour votre {{2}} le {{3}} à {{4}}, {{5}}. Toute la maison Amane se réjouit de vous accueillir.` (prénom, service, date, heure, lieu) |
| `amane_devis` | fr, en, es, ar, ru | `Bonjour {{1}}, votre devis {{2}} est prêt : {{3}}. Vous pouvez l’accepter en un geste ou nous poser une question en répondant ici.` (prénom, numéro, lien) |
| `amane_alerte` | fr | `Amane — nouvelle demande de {{1}} : « {{2}} ». Ouvrez le CRM pour répondre.` (nom du client, extrait ≤ 60 car.) |

Les traductions des corps (en/es/ar/ru) se font dans WhatsApp Manager ; les textes exacts attendus par l'équipe sont modifiables dans `reglages/templates` (`body`), ce qui n'a d'effet que sur l'affichage côté CRM. `TEAM_ALERT_NUMBERS` = numéros personnels de l'équipe (`amel:33600000001,…`) ; ils doivent avoir écrit une fois au numéro professionnel pour recevoir du texte libre, sinon le modèle `amane_alerte` est utilisé.

### Expo push
Les applis enregistrent leur jeton via `POST /api/push/register`. L'envoi passe par `https://exp.host/--/api/v2/push/send` ; `EXPO_ACCESS_TOKEN` n'est nécessaire que si la sécurité renforcée des push est activée sur le projet Expo. Les jetons `DeviceNotRegistered` sont retirés automatiquement.

### Transcription
`WHISPER_API_KEY` (clé OpenAI, modèle `whisper-1`) active la transcription des vocaux à la réception et `POST /api/transcribe`. Sans clé : 503 `transcribe_off`, les vocaux restent lisibles via `/api/media/:id`.

## Sécurité
PIN scrypt + sel, cookie httpOnly/Secure/SameSite=Lax signé HMAC (version de PIN incluse), 5 échecs / 15 min, signature Meta à temps constant, ids validés (`^[A-Za-z0-9_-]{1,64}$`), jetons publics de 24 caractères aléatoires avec limite de débit par IP, corps limités (fiches 512 Ko, photo 600 Ko, webhook 1 Mo, médias Meta 16 Mo), médias servis avec `nosniff` + CSP `sandbox`, aucun secret journalisé, erreurs 500 sans détail.

## Tests
`npm test` : 81 tests `node --test` — les 50 tests historiques portés sur Express (HTTP réel), le mode développement, les 20 points de la liste WhatsApp, les ajouts v2, et `test/legacy-crm.test.js` qui pilote l'ancien `crm/index.html` avec Playwright à travers le serveur (connexion PIN, création d'un client et d'une demande, synchro).

## Limites connues
- Pas de génération de PDF côté serveur : les documents sont des pages HTML imprimables (`/d/:token`, `/api/espace/:token/devis|facture`) ; une demande de « PDF » via `/api/whatsapp/send` envoie le lien public.
- Pas de géocodage : une position sans coordonnées part en itinéraire texte (Google Maps).
- La durée des vocaux n'est pas fournie par Meta (pas de `media.duration`).
- `FakeDb` couvre le sous-ensemble du pilote utilisé par le code (voir l'en-tête de `src/lib/fakedb.js`) ; pas d'agrégation.
- Les tâches de fond doivent tourner sur une seule instance (`CRON_ENABLED=1`) ; sinon, planificateur externe + `X-Internal-Key`.
