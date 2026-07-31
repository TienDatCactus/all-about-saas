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

# vite-plus's `vp` binary is Rust, and it initialises an HTTP client at startup —
# before doing any work. Debian slim ships no CA bundle, so it panicked with
# "failed to initialize HTTP client: No CA certificates were loaded from the
# system" and the build died on the first instruction that mattered. This never
# showed up locally, and never in the API image: Node carries its own CA store,
# so only the Rust toolchain notices the system one is missing.
#
# Builder only, for that reason — the runner is Node and needs nothing here.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

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
