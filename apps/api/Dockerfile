# API Amane v2 — image de production (Node 20, npm workspaces).
# Construire depuis la RACINE du dépôt :  docker build -f apps/api/Dockerfile -t amane-api .
# 1) Back-office React (apps/web/dist n'est pas dans Git : on le construit ici, Railway/Render construisent depuis GitHub).
FROM node:20-alpine AS web
WORKDIR /srv
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY apps/site/package.json apps/site/
# Tous les manifestes du monorepo sont présents (lockfile cohérent) ; on n'installe que shared + web, devDependencies comprises.
RUN npm ci --workspace packages/shared --workspace apps/web --include=dev --no-audit --no-fund --legacy-peer-deps
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace apps/web

# 2) Image de l'API.
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
COPY --from=web /srv/apps/web/dist apps/web/dist

ENV PORT=3000 HOST=0.0.0.0
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/api/src/server.js"]
