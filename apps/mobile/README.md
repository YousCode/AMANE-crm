# Amane — appli mobile (Expo)

Appli de l'équipe (Amel, Youssouf, Aziz) : Aujourd'hui, Messages WhatsApp, Demandes, Planning, Clients, Plus. Expo SDK 58, TypeScript, Expo Router, Zustand, `@amane/shared` (workspace `packages/shared`). Toute l'interface est en français.

## Lancer sur un téléphone (Expo Go)

```bash
# à la racine du dépôt, une seule fois
npm install

cd apps/mobile
cp .env.example .env            # EXPO_PUBLIC_API_URL = adresse du serveur apps/api vue depuis le téléphone
npx expo start                  # puis scanner le QR code avec Expo Go (iOS : appareil photo ; Android : appli Expo Go)
```

- Serveur de développement : `cd apps/api && FAKE_DB=1 npm run dev` (port 3000, PIN `1234` pour les trois). Sur le téléphone, mettre l'IP du Mac/PC dans `EXPO_PUBLIC_API_URL` (`http://192.168.1.10:3000`), pas `localhost`.
- Sans `EXPO_PUBLIC_API_URL` (ou avec `mock`), l'appli tourne sur des données de démonstration intégrées (`src/mocks`) : utile pour la maquette, les captures et les tests.
- Expo Go suffit pour tout sauf les notifications push distantes (Android) : pour celles-ci, faire un build de développement (`npx eas-cli build --profile development`).

## Construire avec EAS (iOS et Android)

```bash
npm install -g eas-cli          # ou npx eas-cli@latest
eas login
eas init                        # pose extra.eas.projectId dans app.json (remplacer la valeur 0000…)
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios       # App Store Connect
eas submit --platform android   # Google Play (fichier JSON du compte de service)
```

Profils dans `eas.json` : `development` (client de développement, serveur local), `preview` (distribution interne, serveur de production), `production` (stores, `autoIncrement`). Les identifiants sont fixés dans `app.json` : iOS `fr.amane.crm`, Android `fr.amane.crm`, schéma `amane://`.

Mises à jour sans passer par les stores : `eas update --branch production --message "…"` (JavaScript seulement ; tout ajout de module natif demande un nouveau build).

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `EXPO_PUBLIC_API_URL` | URL du serveur Express (`apps/api`). Vide ou `mock` = données de démonstration intégrées. Posée par profil dans `eas.json`. |
| `EXPO_PUBLIC_ROLE_CLIENT` | `true` pour afficher l'écran « Espace client » (`/espace/:token`) dans Plus. `false` par défaut (prévu pour l'appli client). Peut aussi s'activer dans Réglages. |

Les variables `EXPO_PUBLIC_*` sont figées au moment du build : changer l'URL demande un nouveau build (ou `eas update`).

## Notifications push

1. `eas init` crée le projet EAS ; le `projectId` sert à `expo-notifications` pour obtenir le jeton Expo.
2. iOS : `eas credentials` crée la clé APNs (ou renseigner la clé .p8 du compte développeur). Android : déposer le `google-services.json` du projet Firebase et le déclarer dans `app.json` (`android.googleServicesFile`), puis envoyer les identifiants FCM à EAS (`eas credentials`).
3. À la connexion, l'appli demande la permission, enregistre le jeton par `POST /api/push/register {token, platform}` ; le serveur envoie via Expo Push (`https://exp.host/--/api/v2/push/send`) avec `data: {convId}` ou `data: {missionId}`. Un appui sur la notification ouvre la conversation ou la demande (`src/lib/push.ts`, `src/app/_layout.tsx`).
4. Canal Android `amane` (importance haute). Icône monochrome `assets/notification-icon.png`.

## Données, hors ligne, synchronisation

- `GET /api/sync` au lancement puis `WebSocket /ws` (événements `change`, `deleted`, `message`, `conversation`, `rappel`) ; rattrapage incrémental toutes les 15 s si le WebSocket est coupé.
- Écritures optimistes ; hors ligne, chaque écriture (`PUT /api/doc/…`, `POST /api/whatsapp/send`…) est mise en file (`expo-sqlite` sur l'appareil, `localStorage` sur le web) et rejouée au retour du réseau. L'état est visible en haut des écrans : « En direct », « Synchronisé », « Hors ligne — n en attente ».
- Session : le cookie `amane_s` est conservé dans `expo-secure-store` et renvoyé en en-tête `Cookie` (sur le web, le navigateur le gère).

## Tests et vérifications

```bash
npx tsc --noEmit                 # types
npm test                         # Jest + @testing-library/react-native (store, PIN, composer, carte héros, règles)
npx expo export --platform web   # rendu web (dist/), utilisé pour les captures Playwright à 390×844
```

## Fiche pour les stores

- Nom : **Amane**. Sous-titre : « Le CRM de la maison ». Catégorie : Productivité (Business). Diffusion : privée / interne (TestFlight, Google Play « tests internes ») — l'appli est réservée à l'équipe, pas de création de compte.
- Icône : le A à serrure noir sur ivoire (`assets/icon.png`, 1024 px). Écran de lancement : A noir sur ivoire (sombre : A ivoire sur noir).
- Permissions déclarées : appareil photo et photos (états des lieux, messages WhatsApp), notifications. Pas de localisation, pas de suivi.
- Textes de révision : préciser le compte de test (prénom + PIN) pour Apple ; l'appli est en français.
- Confidentialité : données clients hébergées sur le serveur Amane (MongoDB Atlas, Paris) ; rien n'est vendu ni partagé.

## Arborescence

```
src/app/            écrans Expo Router : login, (tabs)/…, conv/[id], mission/[id], client/[id], vehicule/[id], more/…, espace/[token]
src/components/     Hero, Composer, Bubble, ConvRow, PinPad, ContactBar, ui (Btn, Panel, Chip, Avatar…), Icon, ALogo
src/store/          store Zustand (synchro, file hors ligne) et sélecteurs purs
src/lib/            api (fetch + cookie), ws, session, storage, push, photo (compression → /api/photo), media, links (tel/wa.me/plans), format, haptics
src/mocks/          données de démonstration et simulation du serveur (fetch) pour Jest et le rendu web
src/theme/          jetons (ivoire/noir/champagne, Bodoni Moda, Jost, IBM Plex Mono), mode sombre
```
