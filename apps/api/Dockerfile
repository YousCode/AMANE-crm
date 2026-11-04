# API Amane v2 — image de production (Node 20, npm workspaces).
# Construire depuis la RACINE du dépôt :  docker build -f apps/api/Dockerfile -t amane-api .
FROM node:20-alpine AS base
WORKDIR /srv
ENV NODE_ENV=production

# Manifestes d'abord (cache des dépendances).
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --workspace packages/shared --workspace apps/api --no-audit --no-fund --legacy-peer-deps \
 || npm install --omit=dev --workspace packages/shared --workspace apps/api --no-audit --no-fund --legacy-peer-deps

# Code : paquet partagé, API, et ce que l'API sert en statique (back-office construit, CRM historique, site).
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY crm crm
COPY site site
# Le back-office React doit être construit avant : `npm run build -w apps/web` (créer un dossier apps/web/dist vide s'il n'existe pas).
COPY apps/web/dist apps/web/dist

ENV PORT=3000 HOST=0.0.0.0
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/api/src/server.js"]
