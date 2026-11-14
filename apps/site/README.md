# Amane — nouveau site (en validation)

Site vitrine en quatre langues (français, anglais, espagnol, arabe de droite à gauche), construit comme une suite d'arcades que le « A à serrure » en or traverse au défilement. Vite + TypeScript + Three.js + GSAP + Lenis, comme le site de Kiess ; identité Amane (nuit, crème, or, bordeaux ; Bodoni Moda et Jost).

## Lancer

```bash
npm run site                 # depuis la racine : http://localhost:5174
npm run build:site           # → apps/site/dist (site statique)
```

Les films et les photos restent dans `site/` (video, img) : `scripts/copy-media.mjs` copie ceux que la page utilise dans `public/media/` (non versionné) avant `dev` et `build`.

## Réglages (variables `VITE_*`, lues au build)

| Variable | Rôle |
|---|---|
| `VITE_WHATSAPP_NUMBER` | Numéro WhatsApp de la maison, chiffres seulement. Vide : le bouton ouvre WhatsApp sans destinataire prérempli. |
| `VITE_CONTACT_EMAIL` | E-mail affiché sous le formulaire (avec le numéro). |
| `VITE_API_URL` | Adresse du CRM. Vide : même origine (le site est servi par l'API). |

## Ce que fait la page

- `src/three/scene.ts` : le A extrudé depuis les tracés du logo (or poli, serrure laquée bordeaux), poussière d'or, halo. Sa place suit la section en vue (`data-key="x,y,taille,rotation"`, `data-key-m` sur téléphone) ; le fond et l'encre suivent `data-tone`.
- `src/sections.ts` : les huit services en portes (défilement horizontal épinglé sur grand écran, glissement au doigt sur téléphone), le film qui s'ouvre en arcade, le texte de la maison qui s'éclaire mot à mot, l'échange par message, la proposition qui se scelle.
- `src/form.ts` : le message se compose sous les yeux du visiteur et part de son propre WhatsApp ; si le CRM répond (`GET /api/health`), « Être rappelé » envoie la demande au CRM (`POST /api/lead`).
- `src/i18n/` : `base.ts` reprend les textes du site précédent ; `extra.ts` porte ceux de cette version.

Sans WebGL, le A reste affiché à plat ; avec « réduire les animations », tout est lisible sans mouvement.

## Mise en service

Le site actuel (`site/`) reste celui que l'API sert à la racine. Pour basculer : construire (`npm run build:site`) puis servir `apps/site/dist` à la place de `site/` — à faire une fois le rendu validé.
