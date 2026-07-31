# Docker & Env — practical guide for this monorepo

Two goals:

1. **Understand Docker well enough** to reason about builds, not just copy commands.
2. **Low-friction device switches** — one command brings up infra.

Our chosen workflow: **infra runs in Docker, the apps run on your host** (`npm run dev`). You get fast hot-reload while Postgres and the mail server are disposable containers. Secrets live in gitignored `.env` files that you manage yourself (no external secret manager wired up).

---

## Part 1 — Docker, the mental model

### Image vs. container

- An **image** is a read-only, layered filesystem snapshot + metadata (what to run). Think "class".
- A **container** is a running (or stopped) instance of an image with a thin writable layer on top. Think "object".
- You **build** images and **run** containers. Deleting a container never deletes its image.

### Layers and the build cache — the single most useful thing to know

Each instruction in a Dockerfile (`FROM`, `COPY`, `RUN`, …) creates a **layer**. Docker caches layers and **reuses them until something changes** — and once one layer's input changes, **every layer after it is rebuilt**.

That's why real Dockerfiles copy dependency manifests and install *before* copying source:

```dockerfile
COPY package.json package-lock.json .   # changes rarely
RUN npm ci                               # expensive — cached across code edits
COPY . .                                 # changes constantly, but comes AFTER install
RUN npm run build
```

If you instead `COPY . .` first, every one-character code change busts the cache and reinstalls all deps. Order instructions **least-changing → most-changing**.

### `.dockerignore`

Works like `.gitignore` but for the **build context** (the files sent to the Docker daemon for `COPY`). Without it, `COPY . .` drags in `node_modules`, `.git`, and — dangerously — your `.env` files, baking secrets into the image. We added one at the repo root.

### Multi-stage builds

Use several `FROM` stages so the **final image only contains what runtime needs** — no compilers, no dev deps. A build stage compiles; a slim runner stage copies just the output:

```dockerfile
FROM node:24-slim AS builder
# ... install everything, build ...

FROM node:24-alpine AS runner
COPY --from=builder /app/dist ./dist    # only the artifact crosses over
CMD ["node", "dist/main.js"]
```

Smaller images = faster pulls, smaller attack surface.

### Tags: never trust `latest`

`postgres:latest` means "whatever was newest when you pulled" — two devices can silently get different majors and corrupt a shared volume. **Pin** (`postgres:16-alpine`). We did this in `docker-compose.yml`.

---

## Part 2 — docker compose

Compose describes a **set of services** in one YAML file and wires them together. Key pieces you'll see in our [`docker-compose.yml`](../docker-compose.yml):

| Concept | What it does |
|---|---|
| `services` | Each container (postgres, mailpit). |
| `image` | Which image to run. Pin the tag. |
| `ports: "H:C"` | Map **host** port H → **container** port C. `5432:5432` = reach the DB at `localhost:5432`. |
| `volumes` | **Named volume** (`pgdata`) persists data across `down`/`up`. Removed only by `down -v`. |
| `environment` | Env vars set *inside* the container. |
| `healthcheck` | Lets Docker know when Postgres is actually ready (not just started). |
| `restart` | `unless-stopped` = comes back after a reboot. |

### The gotcha you already hit: `env_file` vs `${interpolation}`

Two *different* mechanisms, easy to confuse:

- **`${VAR}` in the compose file** (e.g. `"${DATABASE_PORT}:5432"`) is **interpolation**, resolved *before* the container starts, from your shell env or `--env-file` **or a `.env` next to the compose file**. It does **not** read a service's `env_file`.
- **`env_file:` / `environment:`** set variables *inside the running container*, and do **not** feed `${...}` interpolation.

The old `apps/api/docker-compose.yml` used `${DATABASE_NAME}` for `container_name` but supplied it via `--env-file server/.env...` — and that `server/` path didn't exist, so interpolation silently fell back to empty. Our new file fixes this two ways:
- `npm run docker:up` passes `--env-file apps/api/.env.development.local`, so your real values interpolate.
- Every `${VAR:-default}` has a fallback, so `docker compose down` still works with no env file.

### Cheat sheet

```bash
docker compose up -d          # start all services, detached
docker compose ps             # what's running
docker compose logs -f        # tail logs (Ctrl-C to stop tailing)
docker compose down           # stop + remove containers (KEEPS the volume/data)
docker compose down -v        # ...and DELETE the volume (fresh DB)
docker compose pull           # update pinned images
docker exec -it aas-postgres psql -U aas -d aas   # shell into the DB
docker image prune -f         # reclaim disk from dangling images
```

---

## Part 3 — This repo's setup (what to actually run)

All commands from the **repo root**.

```bash
npm run docker:up      # start Postgres + Mailpit
npm run docker:logs    # watch them
npm run docker:down    # stop (data kept)
npm run docker:reset   # stop + wipe DB volume
```

Then run the apps on the host as usual (`npm run dev`, or per-app). Mail sent by the API lands in Mailpit's inbox at **http://localhost:8025**.

### New device, from scratch

```bash
npm run bootstrap      # npm install → docker:up
```

You still need to provide the `.env` files first — see Part 4.

> Note: production images live at `apps/api/Dockerfile` and `apps/web/Dockerfile`; the old `apps/api/.Dockerfile` is gone. See the appendix.

---

## Part 4 — Env files (managed manually)

There's no external secret manager wired up. Real secrets live in gitignored files; only `.env.example` files are committed as documentation.

| Where | Real file (gitignored) | Committed example |
|---|---|---|
| `apps/api` | `.env.development.local`, `.env.production.local` | `.env.example` |
| `apps/web` | `.env` | `.env.example` |
| `packages/transactional` | `.env` | `.env.example` |

### On a new device

Copy each `.env.example` to its real filename and fill in the values (from your password manager, a note, or your other machine):

```bash
cp apps/api/.env.example apps/api/.env.development.local
cp apps/web/.env.example apps/web/.env
cp packages/transactional/.env.example packages/transactional/.env
# then edit in the real secret values
```

Keep `.env.example` up to date whenever you add a new variable, so future-you knows what's needed.

> If manual copying gets painful later, ask and we can wire up an encrypted-in-repo approach (dotenvx / SOPS) or a secret manager. For now it's plain files.

---

## Appendix — production images (done)

`apps/api/.Dockerfile` has been replaced by **`apps/api/Dockerfile`** and a new
**`apps/web/Dockerfile`**, both keeping its Turborepo `prune --docker` recipe.
Six bugs were fixed on the way — the first and the sixth were build/runtime
breakers, not cosmetics:

1. **`turbo prune api` did not resolve.** The workspace is named `@app/api`, so
   the build failed at once with *"Invalid scope. Package with name api in
   package.json not found"*. Correct scope: `turbo prune @app/api --docker`.
2. **Wrong start command** — `dist/index.js`; Nest builds `dist/main.js`.
3. **Leftover `expressjs` user/group** from Vercel's example; the node image
   already ships a non-root `node` user.
4. **Leading-dot filename** wasn't auto-detected. Now `Dockerfile`.
5. **`npm install` → `npm ci`**, so images match the committed lockfile.
6. **glibc → musl ABI mismatch.** The builder was `slim` (glibc) and the runner
   `alpine` (musl). `bcrypt` is a *native* module, so its compiled `.node`
   binary could not load under musl: the image built cleanly and would have
   crashed on the first login. All stages now share one base. (Alternative:
   stay on alpine everywhere and add `python3 make g++` to the builder so
   bcrypt compiles against musl.)

Also added: **`docker-compose.prod.yml`** (postgres not published, one-shot
`migrate` service gating the api via `service_completed_successfully`,
healthchecks everywhere), **`Caddyfile`** for TLS, and
**`scripts/backup-db.sh`** with a `--verify-latest` restore test.

### Built and run (2026-08-01)

Both images build and the stack comes up: `postgres`, `migrate`, `api`, `web` all
healthy, 0 restarts, `/health` and `/health/ready` answering 200 with
`database: "up"`, and `POST /auth/login` returning 400 rather than 500 — which is
what proves bcrypt's native binary actually loads (item 6 above).

Six further problems only became visible by running it, none of which fail a
build or a unit test:

1. **`@repo/typescript-config` was declared by nobody**, though
   `packages/badminton-calc` and `packages/transactional` both `extends` it. It
   resolved on the host through workspace hoisting; `turbo prune` never copied it,
   so `tsc` failed in the image. Same for `@types/react` in `transactional` and
   `dotenv` in `apps/api` — all phantom dependencies, now declared.
2. **`vp build` panicked**: vite-plus's Rust binary initialises an HTTP client at
   startup and `node:24-slim` ships no CA bundle → *"No CA certificates were
   loaded from the system"*. The web builder now installs `ca-certificates`. Node
   carries its own CA store, which is why nothing else noticed.
3. **The API image was 1.44GB** — the runner copied the builder's whole tree,
   dev dependencies included. A production-only install in the runner brings it to
   726MB. That also broke the migration job (`typeorm` is no longer hoisted to the
   root), so it now runs via `npm run migration:run:prod` instead of an absolute
   path into `node_modules`, and the root `prepare` script is `husky || true`
   because `--omit=dev` removes husky.
4. **The initial migration was not self-contained.** Every PK defaults to
   `uuid_generate_v4()`, and TypeORM's driver had been installing `uuid-ossp`
   itself on connect — invisible in the migration history, and impossible on
   managed Postgres where the app role cannot `CREATE EXTENSION`. The migration
   now creates it, and `installExtensions: false` keeps schema changes inside
   migrations.
5. **A trailing carriage return in a secret file** (Git Bash `openssl` writes
   CRLF) meant Postgres initialised with one password and the API sent another.
   `resolveFileSecrets` strips any single trailing terminator now; `file-secrets.spec.ts`
   pins it.
6. **`/health/ready` killed the process on every poll.** Its `@Res()` form
   returned the Express Response object, `ClassSerializerInterceptor` tried to
   serialise it, and the exception filter's write on an already-sent response
   aborted Node with `ERR_INTERNAL_ASSERTION`. The endpoint returns a plain object
   now, and the filter bails when `headersSent` — so the next route to do this
   cannot take the API down with it.
