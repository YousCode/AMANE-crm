# Sécurité

## Secrets

- Aucun secret dans le dépôt : ni clé d'API, ni mot de passe, ni chaîne de connexion MongoDB, ni jeton WhatsApp.
- Les valeurs vivent dans l'hébergeur (variables Railway ou Render), dans EAS pour l'appli, et dans un `apps/api/.env` local, ignoré par Git.
- `apps/api/.env.example` ne contient que des **noms** de variables.
- Un secret poussé par erreur est considéré comme compromis : le **révoquer et le remplacer** d'abord (Atlas, Meta, Anthropic), puis nettoyer l'historique.

## Données clients

Le CRM contient des données personnelles (identité, téléphone, pièces d'identité, habitudes de séjour). Elles restent dans MongoDB Atlas (région Paris) et ne sont jamais copiées dans le dépôt, les tests, les issues ou les captures d'écran. Les jeux de démonstration (`FAKE_DB=1`) sont fictifs.

## Accès

- Équipe : codes PIN personnels, sessions signées (`AUTH_SECRET`), cookies `HttpOnly` et `Secure` en production.
- Webhook WhatsApp : signature `X-Hub-Signature-256` vérifiée avec `WHATSAPP_APP_SECRET`.
- Tâches internes : en-tête `X-Internal-Key`.

## Signaler une faille

Écrire directement à Youssouf (tech), sans ouvrir d'issue publique. Décrire la faille, comment la reproduire, et l'impact.
