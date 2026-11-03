# Amane v2 — monorepo : API Express, back-office React, appli mobile Expo

Contrat partagé entre trois chantiers menés en parallèle. Chaque agent ne touche qu'à ses dossiers. Toute déviation se note ici, dans la section « Décisions ».

## Dossiers et propriétaires

| Dossier | Propriétaire | Contenu |
|---|---|---|
| `packages/shared/` | agent **API** (les autres lisent, jamais n'écrivent) | types, constantes métier, règles, i18n, jetons de design, validation |
| `apps/api/` | agent **API** | Express + MongoDB + WebSocket + tâches de fond. Reprend `lib/` (racine) en le copiant dans `apps/api/src/lib/` et en l'adaptant. |
| `apps/web/` | agent **WEB** | React 18 + Vite + TypeScript, le back-office |
| `apps/mobile/` | agent **MOBILE** | Expo (React Native) + TypeScript |
| `crm/`, `site/`, `api/`, `lib/`, `dev/`, `tests/` (racine) | personne (version actuelle, reste déployable) | ne pas modifier |

Racine : `package.json` avec `"workspaces": ["packages/*", "apps/*"]` (npm 10). Chaque agent crée seulement son propre `package.json` ; l'agent API crée celui de la racine et de `packages/shared`.

`packages/shared` est en JavaScript ES modules **avec fichiers `.d.ts`** (ou TypeScript compilé vers `dist/` avec `tsc`, script `build`) : consommable par Node, Vite et Metro. Nom du paquet : `@amane/shared`. Exports nommés depuis l'index.

## Identité visuelle (obligatoire, identique partout)

Jetons (exportés par `@amane/shared` sous `tokens`) :
```
colors.light: bg #FAF8F4, bg2 #F3EFE8, panel #FFFFFF, panel2 rgba(17,17,17,.035), line rgba(17,17,17,.16), line2 rgba(17,17,17,.08),
  fg #111111, fg2 #4A443E, fg3 #6E675F, accent #8A6A3B, accentInk #FFFFFF, champagne #B8955C, stone #EDE7DD,
  ok #3E7A4E, warn #8A5A12, bad #A3293F, info #3D5F87, scrim rgba(17,17,17,.38)
colors.dark: bg #111111, bg2 #0B0B0B, panel rgba(250,248,244,.045), panel2 rgba(250,248,244,.06), line rgba(250,248,244,.16), line2 rgba(250,248,244,.09),
  fg #F4F1EC, fg2 #CFC8BE, fg3 #A39B90, accent #C9A56A, accentInk #111111, champagne #C9A56A, stone #1C1B19,
  ok #9FBF9A, warn #E2BC72, bad #F09AA6, info #B4C6DE, scrim rgba(0,0,0,.6)
fonts: display 'Bodoni Moda' (titres, chiffres clés, italique pour l'emphase), ui 'Jost' (300/400/500), mono 'IBM Plex Mono' (numéros, montants)
radius: 12 ; rail: 84 ; tracking label: .18em uppercase 11px
```
Règles : ivoire, noir, champagne. Aucune autre couleur hors `ok/warn/bad/info` pour les statuts. Panneaux blancs sur ivoire, filets 1 px, boutons pleins noirs, chips de statut. Logo = le A à serrure (`brand/a.svg`, path dans `site/favicon.svg`). Slogan de la maison : « Arrive as a Guest. Leave with a Story. » (en anglais partout, en Bodoni, *Guest* et *Story* en italique). Mode sombre pris en charge. Web : polices Google Fonts (Bodoni Moda, Jost, IBM Plex Mono) ; mobile : `@expo-google-fonts/bodoni-moda`, `@expo-google-fonts/jost`.

## `@amane/shared` — exports

- `TEAM` : amel (Relation client), youssouf (Tech & flotte), aziz (Contrats & conformité).
- `STATUTS` : nouvelle, proposition, confirmee, encours, terminee, perdue (labels FR). `CLIENT_STATUTS` : prospect, client, habitue, vip. `CLIENT_TAGS`, `LANGUES` (FR EN AR RU ZH ES IT DE), `CANAUX`, `CONTRAT_ST`, `CAUTION_ST`, `PAIEMENT_ST`, `DEVIS_ST`, `UNITES`, `MOYENS`, `PART_TYPES`, `PROG_TYPES`, `JOURNAL_T`, `TASK_TPL`, `SERVICES` (location, chauffeur, van, transfert, shopping, sejour, conciergerie, clip), `VEHICULES_DEFAUT` (Urus SE, Ferrari 296 GTB, G 63, M5 Touring, Classe V VIP — mêmes champs que `crm/tests/mock.js`). Valeurs copiées de `crm/index.html` (lignes ~808-820 et ~1353-1375).
- Types (`.d.ts`) : `Client, Mission, Vehicule, Service, Partenaire, Conversation, Message, Activity, Devis, Ligne, Reglement, Tache, EtapeProgramme, Reglages, User, Rappel`. Champs = ceux du CRM actuel (`crm/index.html` fonction `blank(kind)` ~ligne 1140 pour mission/client) + ceux de `docs/crm-serveur.md`.
- Règles (fonctions pures, testées) : `clashes(mission, missions)` (conflit véhicule), `chClashes(mission, missions)` (conflit chauffeur), `freeVehicles(vehicules, missions, from, to)`, `durDays(mission)`, `tplTasks(mission)`, `devisTotals(devis)` (HT, remise, TVA 20 %, TTC, réglé, reste), `numeroFormat(kind, year, n)` → `D-2026-0001` / `F-2026-0001`, `paiementStatut(mission)`, `nextStatut/prevStatut`, `telNorm(tel)`, `waLink(tel, text)`, `mapsLink(lieu)`, `detectLang(text)`, `docLang(client)`.
- i18n : `t(lang, key, vars)` avec dictionnaires FR/EN/ES/AR pour les documents client (devis, facture, programme, carnet : reprendre `TXT` de `crm/index.html`) et pour les réponses rapides WhatsApp ; l'interface d'équipe reste en français.
- `tokens` (ci-dessus) et `cssVars(theme)` qui rend les variables CSS.
- `validate.client(obj)`, `validate.mission(obj)` … → `{ok, errors:{champ:'message FR'}}`.

## API (`apps/api`) — Express

Base : reprendre intégralement `docs/crm-serveur.md` (routes, formes des données, auth PIN + cookie `amane_s`, WhatsApp, IA, lead, photos, sync, counter, activity). Mêmes chemins, pour que `crm/index.html` continue de fonctionner tel quel contre ce serveur. Ajouts :

| Méthode | Chemin | Rôle |
|---|---|---|
| WS | `/ws` | après auth (cookie), le serveur pousse `{type:'change', col, doc}` / `{type:'deleted', col, id}` / `{type:'message', message}` / `{type:'conversation', conversation}` / `{type:'rappel', rappel}`. Le client garde `/api/sync` pour le rattrapage. |
| POST | `/api/translate` | `{text, to, from?, context?:'message'|'document'}` → `{text, from, cached}`. Claude, ton maison (vouvoiement, feutré, noms de voitures/lieux inchangés, « Amane » jamais traduit). Cache Mongo `translations` clé = sha256(from+to+text). 503 `ia_off` si pas de clé. |
| POST | `/api/transcribe` | `{mediaId}` (vocal WhatsApp) → `{text, lang}` via téléchargement du média Meta puis Whisper (OpenAI `WHISPER_API_KEY` optionnel) ou 503 `transcribe_off`. |
| GET | `/api/relances` | liste calculée : propositions sans réponse > 48 h, habitués sans mission > 90 j, anniversaires sous 21 j, acomptes non reçus à J-3, factures en retard. Chaque ligne : `{type, clientId, missionId?, raison, messageSuggere (langue du client), depuis}`. |
| POST | `/api/rappels/run` | (clé interne ou tâche de fond) envoie les rappels automatiques WhatsApp : veille de mission (J-1 18 h Paris), remerciement J+1 10 h, relance acompte J-3. Texte par langue (FR/EN/ES/AR/RU) dans `reglages/rappels`, désactivable par type. Jamais deux fois le même (`rappels` collection, idempotent). |
| GET/POST | `/api/devis/:id/share` | crée un lien public `/d/:token` (token 24 car.) ; `GET /d/:token` rend une page HTML ivoire/Bodoni du devis (lecture seule, langue du client) avec boutons « Accepter » / « Poser une question » (WhatsApp). Ouverture → `devis.vuAt`, acceptation → `devis.statut='accepte'`, `acceptedAt`, activité + alerte équipe + WS. |
| GET | `/api/digest?semaine=` | le « tableau du lundi » : CA semaine, missions à venir (7 j), véhicules en révision, factures en retard, 3 clients à relancer, rédigé par Claude en français (texte + JSON). Tâche de fond : lundi 8 h 30 Paris → WhatsApp à `TEAM_ALERT_NUMBERS`. |
| GET | `/api/flotte/rentabilite?mois=` | par véhicule : loyer, charges, jours loués, CA, coûts journal, marge nette, taux d'occupation. |
| GET | `/api/espace/:token` | espace client par séjour (token sur la mission) : programme, chauffeur (nom, photo, tel), documents (devis/facture PDF-HTML), solde, bouton contact. Page HTML publique servie par l'API (même charte, langue du client, RTL arabe). `POST /api/missions/:id/espace` crée/renvoie le token. |
| PUT | `/api/doc/clients/:id` | champs enrichis acceptés : `entourage[]`, `datesImportantes[]`, `allergies`, `marques`, `attentions[]`, `langue`, `tags[]`. |

Tâches de fond : `node-cron` dans le process (une seule instance). Variables d'env : celles de `docs/crm-serveur.md` + `PORT`, `PUBLIC_URL`, `WHISPER_API_KEY?`, `CRON_ENABLED=1`. `Dockerfile` + `railway.json`/`render.yaml` + `README` de déploiement. Tests : `node --test`, base en mémoire (`lib/fakedb.js`), `fetch` Meta/Anthropic stubbés ; reprendre les 53 tests existants et les faire passer sur Express, plus les nouveaux.

## Front web (`apps/web`) — React + Vite + TS

- Connexion : écran PIN (trois tuiles Amel/Youssouf/Aziz + pavé numérique), cookie de session.
- Données : un `store` (Zustand ou équivalent léger) alimenté par `/api/sync` au démarrage puis par le WebSocket ; écritures optimistes ; file hors ligne (IndexedDB) rejouée au retour du réseau ; indicateur « Synchronisé / Hors ligne — n modifications en attente ».
- Écrans, dans cet ordre de priorité : Aujourd'hui (salon), Messages (boîte WhatsApp avec traduction FR sous chaque message reçu, rédaction en FR → envoi traduit avec aperçu modifiable, réponses rapides, brouillon IA, fenêtre 24 h/modèle), Demandes (kanban glisser-déposer + liste + fiche en tiroir : infos, contrat, devis/facture, programme, tâches, historique), Planning (semaine par véhicule, conflits en rouge discret, « Qui est libre ? »), Clients (fiche enrichie, relances), Carnet (partenaires/chauffeurs), Flotte (journal, photos, rentabilité), Finances (facturé/encaissé/retards/commissions, CSV), À relancer, Réglages (réponses auto, rappels, textes par langue), Aide.
- Mobile-first : barre d'onglets en bas < 1020 px, tiroirs plein écran, cibles 44 px, boutons Appeler / WhatsApp / Itinéraire partout où il y a une personne ou un lieu.
- Tests : Vitest pour les règles et le store, Playwright pour 8 parcours (login, créer demande, drag statut, envoyer message traduit, accepter devis via lien, relances, planning conflit, hors ligne). API mockée par `msw` selon ce contrat.
- Build statique (`dist/`) servi par l'API Express sous `/app` (l'agent API expose `express.static` sur `apps/web/dist` si présent).

## Mobile (`apps/mobile`) — Expo SDK 52+, TypeScript, Expo Router

- Mêmes écrans que le web, réduits à l'essentiel : Connexion PIN, Aujourd'hui (prochaine mission en carte héros + appels/WhatsApp/itinéraire en un geste), Messages (liste + fil + traduction + envoi), Demandes (liste + fiche + changement de statut), Planning (jour/semaine), Clients, Plus (flotte, carnet, finances, réglages, déconnexion).
- Notifications push via `expo-notifications` (jeton enregistré par `POST /api/push/register {token, platform}` — l'agent API l'ajoute et envoie via Expo Push à `nouvelle demande`, `message reçu`, `devis accepté`, `rappel`).
- Appareil photo (états des lieux) → `/api/photo` compressé ; stockage hors ligne (`expo-sqlite` ou MMKV) avec file de synchro.
- Rôle « client » prévu dans la navigation (écran Espace client lisant `/api/espace/:token`), désactivé par défaut (`ROLE_CLIENT=false`), pour l'appli client future.
- Tests : Jest + `@testing-library/react-native` sur les composants et le store ; `npx tsc --noEmit` et `npx expo export` doivent passer. Aucun appareil ici : pas de capture d'écran native exigée, mais un rendu web (`expo export --platform web`) sert aux captures Playwright à 390×844.

## Auth et sécurité (tous)
Comme `docs/crm-serveur.md` : PIN scrypt, cookie httpOnly signé, 5 échecs / 15 min, pas de secret dans le code, ids validés, limites de taille, CORS restreint à `PUBLIC_URL` et aux origines Expo en dev. Le mobile stocke le cookie dans `expo-secure-store` et l'envoie en en-tête `Cookie`.

## WhatsApp — tout ce qui doit marcher (API + fronts)

Réception
1. Texte, image, vidéo, document, audio (vocal), localisation, contact, réaction, réponse citée (`context.id`) : tout est stocké dans `messages` avec `type`, `media:{id, mime, filename?, caption?}`, `location`, `contacts`, `reactionTo`, `replyTo`.
2. Médias téléchargés depuis Meta (`GET /{media-id}` puis l'URL signée) et stockés dans `photos` (binaire, ≤ 16 Mo) ; servis par `GET /api/media/:id` (session). Vocaux transcrits (`/api/transcribe`) et traduits ; la transcription se range dans `message.transcript` et `message.translation`.
3. Traduction automatique de chaque message reçu vers le français (`message.translation`), faite dès la réception quand l'IA est active ; rattrapée à la demande sinon.
4. Détection de langue par conversation, mémorisée sur le client (`langue`) si vide.
5. Idempotence sur `wamid`, signature vérifiée, bursts sérialisés par numéro.
6. Client retrouvé par numéro normalisé, sinon créé ; demande créée s'il n'y a pas de demande ouverte ; l'IA remplit les champs vides et pose `aiSummary` + `aiDraft`.
7. Numéros de l'équipe (`TEAM_ALERT_NUMBERS`) : jamais de client ni de demande créés.

Réponses
8. Réponse automatique jour/nuit par langue (FR/EN/ES/AR/RU), une seule fois par 12 h, textes et horaires dans `reglages/general`, désactivable.
9. Envoi texte, image, document (PDF devis/facture/carnet), localisation (adresse d'une mission), contact (fiche du chauffeur) : `POST /api/whatsapp/send` avec `{convId, text}` ou `{convId, media:{type, photoId|url, caption, filename}}` ou `{convId, location:{lat,lng,name,address}}` ou `{convId, contact:{partenaireId}}`.
10. Rédaction en français → traduction dans la langue du client avant envoi, aperçu modifiable, bouton « envoyer en français quand même ».
11. Réponses rapides par langue (accusé, dates, caution, confirmation, remerciement, itinéraire, « votre chauffeur est en route »), avec variables (prénom, voiture, heure, lieu).
12. Brouillon IA (`aiDraft`) inséré d'un geste, jamais envoyé seul.
13. Fenêtre de 24 h : hors fenêtre, envoi d'un modèle approuvé (`amane_relance`, `amane_rappel`, `amane_devis`, `amane_alerte`) avec paramètres ; liste des modèles et leurs variables dans `reglages/templates` ; 409 `window_closed` sinon.
14. Accusés : envoyé → distribué → lu, affichés dans le fil ; échecs avec le code Meta lisible (ex. numéro hors WhatsApp).
15. Marquer lu côté Meta (`messages` read receipt) quand l'équipe ouvre le fil ; compteur non lus par conversation et global ; WS en temps réel.

Automatismes
16. Rappels automatiques (J-1 mission, J+1 remerciement, J-3 acompte), traçés dans `rappels`, idempotents, désactivables par type, langue du client.
17. Alertes équipe : nouvelle demande, message sans réponse depuis 6 h, devis accepté via lien, PV reçu, révision à J-7 ; texte ou modèle `amane_alerte` hors fenêtre ; destinataire = responsable de la fiche, sinon Amel.
18. Tableau du lundi envoyé à l'équipe (digest).
19. Lien de devis / espace client envoyé en un geste depuis la demande, avec message prérempli dans la langue du client.
20. Attribution : « Qui s'en occupe » par conversation (`conversation.assigne`), transfert à un collègue avec note interne (messages `dir:'note'`, jamais envoyés au client, affichés en jaune pâle).

Fronts
21. Liste des conversations : nom ou numéro, aperçu (ou « 🎤 vocal 0:42 » / « 📎 passeport.pdf »), heure relative, non lus, langue, fenêtre fermée, assigné ; recherche ; filtres (non lus, à moi, sans demande).
22. Fil : bulles entrant/sortant, traduction grise sous l'original, médias affichés (image, vidéo, PDF, vocal lisible avec transcription), citations, réactions, séparateurs de jour, RTL pour l'arabe, notes internes.
23. En-tête : Appeler, WhatsApp (appel natif), Fiche client, Demande liée ou « Créer la demande », carte IA (`aiSummary`, champs extraits, « Appliquer »).
24. Composer : texte, pièce jointe (photo/document), localisation d'une mission, contact chauffeur, réponses rapides, brouillon IA, aperçu de traduction, modèle hors fenêtre, note interne.
25. Mobile : partage natif d'une photo prise sur place directement dans le fil ; notifications push « nouveau message » qui ouvrent la conversation.

## Décisions (à compléter par les agents)
- (vide)
