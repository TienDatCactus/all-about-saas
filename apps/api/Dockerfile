# syntax=docker/dockerfile:1
#
# NestJS API image, built with Turborepo's `prune --docker` recipe.
# Build from the REPO ROOT:
#
#   docker build -f apps/api/Dockerfile -t aas-api .
#
# This replaces apps/api/.Dockerfile. Fixes carried over from it:
#   1. `turbo prune api` → `@app/api`. The old scope did not exist, so the build
#      failed immediately with "Invalid scope. Package with name api not found".
#   2. CMD pointed at dist/index.js; Nest builds dist/main.js.
#   3. Runner was `alpine` while the builder was `slim`. bcrypt is a NATIVE
#      module, so its glibc-linked .node binary cannot load under musl — the
#      image built cleanly and died on the first login. All stages share one
#      base now. (Alternative: keep alpine everywhere and add python3/make/g++
#      to the builder so bcrypt compiles against musl.)
#   4. Leftover `expressjs` user/group from the Vercel example; the node image
#      already ships a non-root `node` user.
#   5. `npm install` → `npm ci`, so the image matches the committed lockfile.

ARG NODE_VERSION=24.13.1
FROM node:${NODE_VERSION}-slim AS base

# ---------- prepare: reduce the monorepo to just what @app/api needs ----------
# prune emits out/json (manifests + lockfile) and out/full (source), which is
# what lets the install layer stay cached across source-only edits.
FROM base AS prepare
WORKDIR /app
RUN npm install -g turbo@2
COPY . .
RUN turbo prune @app/api --docker

# ---------- builder ----------
FROM base AS builder
WORKDIR /app

# Manifests first: this layer is reused until a package.json or the lockfile
# changes, which is far rarer than a code change.
COPY --from=prepare /app/out/json/ .
RUN npm ci --ignore-scripts=false

# Then the sources. turbo resolves build order: @repo/badminton-calc and
# @transactional/emails compile before the API that imports them.
COPY --from=prepare /app/out/full/ .
RUN npx turbo run build --filter=@app/api

# ---------- runner ----------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Whole tree, because the API resolves its workspace deps through the symlinks
# npm created in node_modules. (Size optimisation for later: a second install
# with --omit=dev, once this is verified working.)
COPY --from=builder --chown=node:node /app .

USER node
EXPOSE 8000

# Nest's enableShutdownHooks() registers a SIGTERM listener, so node as PID 1
# drains in-flight requests on `docker stop` instead of being killed.
CMD ["node", "apps/api/dist/main.js"]
