# Contribuer

## Règle d'or

`main` est toujours déployable. On n'y pousse jamais directement : tout passe par une pull request dont la CI est verte.

## Cycle de travail

1. Partir de `main` à jour : `git switch main && git pull`.
2. Créer une branche nommée d'après le travail :
   - `feat/planning-chauffeurs` pour une fonctionnalité
   - `fix/doublon-client-whatsapp` pour une correction
   - `chore/maj-expo-59` pour l'outillage, les dépendances
   - `docs/guide-devis` pour la documentation
3. Coder **avec ses tests**. Une règle métier va dans `packages/shared` et se teste là.
4. Avant de pousser : `npm test && npm run typecheck`, et `npm run test:crm` si `crm/` a changé.
5. Ouvrir la pull request : remplir le modèle (quoi, pourquoi, comment vérifier, captures si l'écran change).
6. Fusion en **squash** une fois la CI verte et la relecture faite. Supprimer la branche.

## Messages de commit

En français, à l'impératif, préfixés par le domaine :

```
API : alerte si un message client reste sans réponse 6 h
Back-office : planning par chauffeur
Mobile : appel direct depuis la fiche client
Site : formulaire en arabe
Shared : numérotation des devis par année
```

La première ligne fait moins de 72 caractères. Le corps, si besoin, explique **pourquoi**.

## Où mettre quoi

| Besoin | Dossier |
|---|---|
| Règle métier (statuts, prix, conflits, langues) | `packages/shared/src` + test dans `packages/shared/test` |
| Route, webhook, tâche planifiée | `apps/api/src/routes`, `apps/api/src/lib` + test dans `apps/api/test` |
| Écran du back-office | `apps/web/src` (pages, composants, store Zustand) |
| Écran mobile | `apps/mobile/src/app` (Expo Router) |
| Contrat de l'API | mettre à jour `docs/architecture-v2.md` dans la même PR |

## Conventions de code

- JavaScript moderne (ESM) côté API et shared ; TypeScript strict côté web et mobile.
- 2 espaces, fins de ligne LF, UTF-8 (voir `.editorconfig`).
- Textes affichés en français ; le CRM gère aussi EN, ES, AR (droite à gauche) et RU pour les messages clients.
- Pas de secret dans le code, les tests ou les captures. Les fausses valeurs des tests restent visiblement fausses (`sk-ant-test`).
- Tout nouvel appel externe (Meta, Anthropic, Open-Meteo…) se simule en mode `FAKE_DB=1` pour que le développement local n'ait besoin d'aucun compte.

## Versions

- Back-office et API : déployés à chaque fusion sur `main`.
- Appli mobile : `version` dans `apps/mobile/app.json`, numéro de build incrémenté par EAS.
- Étiqueter les mises en production importantes : `git tag v2.1.0 && git push --tags`.
