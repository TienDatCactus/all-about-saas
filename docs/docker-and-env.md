# Docker & Env — practical guide for this monorepo

Two goals:

1. **Understand Docker well enough** to reason about builds, not just copy commands.
2. **Zero-friction device switches** — one command brings up infra, one command syncs secrets.

Our chosen workflow: **infra runs in Docker, the apps run on your host** (`npm run dev`). You get fast hot-reload while Postgres and the mail server are disposable containers. Secrets live in **1Password** and are rendered on demand.

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

### New device, from scratch — one command

```bash
npm run bootstrap      # npm install → env:pull (1Password) → docker:up
```

That's the whole "I switched laptops" flow. No hand-copying anything.

> Note: `apps/api/.Dockerfile` is a leftover production image recipe (currently for local dev we don't use it). It has bugs to fix *before* any prod use — see the end of this doc.

---

## Part 4 — Env syncing with 1Password (no more manual copying)

### How it works

- We commit **templates** (`apps/api/.env.tpl`, `apps/web/.env.tpl`, `packages/transactional/.env.tpl`). They contain non-secret config inline and **`op://Vault/Item/field` references** for secrets — no real secrets in git.
- [`scripts/env.mjs`](../scripts/env.mjs) runs `op inject` to replace those references with real values, writing the gitignored `.env.development.local` / `.env` files.
- Your secrets live once in 1Password; any signed-in device can render them.

### One-time setup (do this once, on the device that currently has the real secrets)

1. **Install the 1Password CLI** (`op`): https://developer.1password.com/docs/cli/get-started/
   Enable *Settings → Developer → Integrate with 1Password CLI* so `op` uses the desktop app for auth.
2. **Create a vault** named `AAS` (or rename in the `.tpl` files + `scripts/env.mjs` mapping).
3. **Add items/fields** matching the references in the templates. For the current `apps/api/.env.tpl` that means an item `api` with fields `DATABASE_PASSWORD`, `JWT_SECRET`, `BASE_PASSWORD`; items `google-oauth`, `github-oauth`, `facebook-oauth` each with `CLIENT_ID` + `CLIENT_SECRET`; and an `email` item with `USER` + `PASS`. Paste the real values (from your existing `.env.development.local`) into those fields.
   - Tip: `op item create --category=login --title=api --vault=AAS 'DATABASE_PASSWORD[password]=...'`

### Every device after that

```bash
op signin        # once per session (or rely on desktop integration)
npm run env:pull # renders every .env from 1Password
```

### Daily use — two good options

- **Render to files** (what `env:pull` does): simplest, works with everything (Nest's `@nestjs/config`, Vite, docker compose `--env-file`). Files stay gitignored.
- **Never touch disk**: `op run --env-file apps/api/.env.tpl -- npm run dev` injects secrets straight into the process. Nothing secret is written down. Use this when you want maximum hygiene; use `env:pull` when a tool needs a real file on disk.

### Rules of thumb

- Real `.env*` files stay **gitignored** (they already are). Only `.env.example` and `.env.tpl` are committed.
- Rotating a secret = update it in 1Password once, then `npm run env:pull` on each device. No file surgery.
- Keep non-secret config (ports, URLs) inline in the template so the vault only holds true secrets.

---

## Appendix — fixing `apps/api/.Dockerfile` before any production use

Not needed for local dev, but for the record it currently has:

1. **Wrong start command.** It ends with `CMD node apps/api/dist/index.js`, but NestJS builds to `dist/main.js` (`start:prod` runs `node dist/main`). Should be `CMD ["node", "apps/api/dist/main.js"]`.
2. **Leftover Express naming** (`expressjs` user/group) — cosmetic, copy-pasted from Vercel's example.
3. **Odd filename** — a leading-dot `.Dockerfile` isn't auto-detected; you'd need `docker build -f apps/api/.Dockerfile`. Rename to `Dockerfile`.
4. It relies on the root `.dockerignore` (now added) so `COPY . .` no longer ships `node_modules`/secrets.

When you're ready to containerize the app for deploy (the "Both" option from earlier), ping me and I'll finish the multi-stage build + a `docker-compose.prod.yml`.
