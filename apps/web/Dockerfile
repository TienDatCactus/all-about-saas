# syntax=docker/dockerfile:1
#
# TanStack Start web app (Nitro server output), same Turborepo prune recipe as
# the API. Build from the REPO ROOT:
#
#   docker build -f apps/web/Dockerfile \
#     --build-arg VITE_API_BASE_URL=https://api.example.com -t aas-web .
#
# VITE_API_BASE_URL is a BUILD arg, not a runtime env var: Vite inlines
# import.meta.env at build time, so setting it in compose `environment:` would
# have no effect on the shipped bundle.

ARG NODE_VERSION=24.13.1
FROM node:${NODE_VERSION}-slim AS base

FROM base AS prepare
WORKDIR /app
RUN npm install -g turbo@2
COPY . .
RUN turbo prune @app/web --docker

FROM base AS builder
WORKDIR /app
COPY --from=prepare /app/out/json/ .
RUN npm ci --ignore-scripts=false
COPY --from=prepare /app/out/full/ .

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npx turbo run build --filter=@app/web

# ---------- runner ----------
# Nitro bundles its dependencies into .output, so nothing needs installing here
# and only that directory has to cross over.
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/apps/web/.output ./.output

USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
