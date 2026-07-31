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

# A second, production-only install rather than copying the builder's tree.
# Copying it produced a 1.44GB image: jest, the Nest CLI, typescript, eslint and
# every transitive dev dep travelled to production, where nothing calls them and
# they are only extra attack surface. Installing fresh here is what leaves them
# behind, and it still creates the node_modules symlinks the API needs to resolve
# @repo/badminton-calc and @transactional/emails (both production deps).
#   --ignore-scripts=false is kept, not dropped: bcrypt is a native module and
#   needs its install script to fetch/build the .node binary, so an install that
#   skipped scripts would produce an image that boots and dies on first login.
#   That is also why the root `prepare` script is `husky || true` — with
#   --omit=dev husky is not installed, and `prepare` failing took the whole
#   install down with exit 127.
COPY --from=prepare /app/out/json/ .
RUN npm ci --omit=dev --ignore-scripts=false \
 && npm cache clean --force

# Compiled output has to come from the builder: the install above restored the
# workspace symlinks, but each package's dist/ is a build artefact that does not
# exist in a fresh install. Root-owned and world-readable — the app runs as
# `node` and has no business rewriting its own code.
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/badminton-calc/dist ./packages/badminton-calc/dist
COPY --from=builder /app/packages/transactional/dist ./packages/transactional/dist

USER node
EXPOSE 8000

# Nest's enableShutdownHooks() registers a SIGTERM listener, so node as PID 1
# drains in-flight requests on `docker stop` instead of being killed.
CMD ["node", "apps/api/dist/main.js"]
