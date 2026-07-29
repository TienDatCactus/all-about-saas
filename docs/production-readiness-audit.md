# Production-Readiness Audit — all-about-saas

**Goal:** what this repo needs to become a secure, reproducible, shippable project on a
**single VPS + Docker Compose**. Weighted to **security · DevOps · code quality**.

**Method:** a 9-agent audit (6 subsystem readers, 2 best-practice researchers, 1 adversarial
verifier). 51 raw findings, verified against the actual code, deduplicated to the list below.
Every item cites `file:line`. Dated 2026-07-25.

**Legend:** severity `🔴 critical / 🟠 high / 🟡 medium / ⚪ low` · effort `S`(<1h) `M`(hours) `L`(day+).
Items marked _(known debt)_ were introduced or deliberately deferred during recent feature work.

---

## 🔴 Critical — fix before any real deployment

### C1. RBAC is both dead and unsafe-by-design — fix the two together `L`
- **Dead path:** `casl/ability.factory.ts:21,23` builds rules from `perm.resource`, but the
  entity column is `perm.subject` (`casl/entities/permission.entity.ts:13`). Every rule is built
  with `subject: undefined`, so `ability.can(action, 'User')` never matches → **every
  `@CheckPolicies` route currently denies**.
- **Unsafe design (latent):** `common/guard/policies.guard.ts:33-35` checks
  `ability.can(action, resourceNameString)` — a bare string, not a loaded entity. CASL only
  evaluates `conditions` (the ownership templates `{ authorId: '${user.id}' }`,
  `permission.entity.ts:15-16`) against an **object instance**. So the moment you fix the dead
  path, "read your own User" silently becomes "read **all** Users" (`users.controller.ts:26-28`).
- **Why it hasn't bitten yet:** badminton avoids leakage only because its *service* re-filters by
  `ownerId` by hand (`badminton.service.ts:44-52`), not because RBAC works.
- **Fix:** rename `perm.resource`→`perm.subject`; then enforce row-level checks against real
  objects (`ability.can(action, subject('User', entity))` after load, or `accessibleBy(ability)`
  query filtering on lists). Add a test asserting a seeded permission actually grants **and** denies.

### C2. No env-var validation — the app boots with missing/insecure secrets `M`
`app.module.ts:23-27` `ConfigModule.forRoot(...)` has **no `validationSchema`**. `JWT_SECRET` is
read raw (`configuration.ts:26`) and asserted non-null with `!` (`jwt.strategy.ts:13`,
`auth.module.ts:29`). If `JWT_SECRET`/`DATABASE_*` are unset the app **still starts** — signing
JWTs with `undefined`. OAuth strategies even fall back to literal `'placeholder_id'`.
**Fix:** add a Joi/zod `validationSchema` (require `JWT_SECRET` ≥32 chars, `DATABASE_*`,
`FRONTEND_URL`, enabled OAuth secrets), `abortEarly:false`. Turn a silent insecure boot into a crash.

### C3. No migrations + broken migration tooling → fresh prod DB gets no schema `M` — **ship blocker**
`package.json:18` points `typeorm -d src/database/data-source.ts`, but that dir **doesn't exist**;
the real DataSource at `common/config/data-source.ts` is orphaned **and loads no env** (no
`dotenv`). Zero migrations are committed. Prod runs `synchronize:false` (`database.ts:23`), so a
fresh Postgres is **never created**. Paths also disagree (`data-source.ts` uses `src/…/*.ts`,
`database.ts:25` uses `dist/…/*.js`).
**Fix:** point the script at `common/config/data-source.ts`, add `import 'dotenv/config'`, align
the migrations glob, generate + commit an initial migration, and run `migration:run` as a **deploy
step** (one-shot compose service), never `synchronize`.

### C4. Rate limiting is configured but never enforced — login brute-force is wide open `S`
`ThrottlerModule.forRoot` is registered (`app.module.ts:30-37`) but **no `ThrottlerGuard` is bound**
(`providers:[AppService]` only). Nothing throttles `POST /auth/login`, and login has no lockout.
**Fix:** `{ provide: APP_GUARD, useClass: ThrottlerGuard }`, plus a tighter `@Throttle` on
login/signup/refresh/reset (5–10/min). Back with Redis storage if you ever run >1 instance.

### C5. Not containerized — no Dockerfiles, no prod compose, no reverse proxy/TLS `M`
No `Dockerfile` anywhere; the only compose (`apps/api/docker-compose.yml`) starts **postgres only**
and publishes it on the host (`${DATABASE_PORT}:5432`). No api/web service, no proxy, no TLS.
You literally cannot ship the app yet. See the **Deploy blueprint** below.

---

## 🟠 High

- **H1. Access token in `localStorage` → full XSS token theft `L`.** `services/auth/queries.ts:17`,
  read back in `lib/utils/http.ts:36-40`. Refresh token is correctly httpOnly
  (`auth.service.ts:444`), so the access token is the weak link. Keep it **in memory** and
  re-hydrate via `/auth/refresh`; add a strict CSP.
- **H2. Auth is opt-in per controller, not default-deny `M`.** No global `APP_GUARD`
  (`app.module.ts`); each controller must remember `@UseGuards`, and `PoliciesGuard` returns
  `true` when a route has no `@CheckPolicies` (`policies.guard.ts:25`). A `@Public()` decorator
  already exists but is unused. **Fix:** bind `JwtAuthGuard` globally, opt out public routes with
  `@Public()` (e.g. the badminton share endpoint).
- **H3. Privilege escalation via role editing `M`.** `PATCH /roles/:id/permissions`
  (`roles.controller.ts:38`) is gated only by `{update, Role}`; the service blindly persists the
  client-supplied permission array (`roles.service.ts:34-60`) with no roleId restriction and no
  "grant-only-what-you-hold" check. Anyone who can update a Role can grant themselves
  `manage all`. (Live once C1 is fixed.)
- **H4. Swagger served unconditionally in prod `S`.** `main.ts:59-66` — full API schema at `/api`
  to anonymous users. Guard behind `NODE_ENV !== 'production'`.
- **H5. CORS wide open `S`.** `main.ts:25` `enableCors()` with no options; `frontendUrl`
  (`configuration.ts:42`) exists but is unused. Restrict to the known origin with `credentials:true`.
- **H6. No graceful shutdown `S`.** `main.ts` never calls `enableShutdownHooks()`; `docker stop`
  SIGTERM hard-kills in-flight requests and the DB pool.
- **H7. No prod serve strategy for web `S`.** `apps/web/package.json` has only `dev/build/preview`
  — no `start`. Needs `node .output/server/index.mjs` (Nitro output) wired to a Dockerfile.
- **H8. No Postgres backups `M`.** Only persistence is the `pgdata` volume. One disk failure =
  total loss. Add scheduled `pg_dump -Fc` → **offsite**, with tested restores.
- **H9. No CI gate `S`.** `.github/workflows` has only two third-party bots
  (react-compiler `fail-on-error:false`, react-doctor). Nothing runs `turbo build/lint/test`.
  _(Task already queued this session.)_ Also: **`check-types` typechecks nothing** — no workspace
  defines a `check-types` script, so `turbo run check-types` is a no-op (`turbo.json:12`).
- **H10. Split algorithm duplicated across api + web `M` _(known debt)_.** `badminton.calc.ts` and
  `web/lib/badminton/calc.ts` are the same ~90-line function; `ComputedSnapshot` lives in **three**
  files. Financial math kept in two hand-synced copies will drift. Extract `packages/badminton-calc`.
- **H11. API tsconfig isn't strict `S`.** `apps/api/tsconfig.json` sets only `strictNullChecks`;
  `noImplicitAny:false` and friends off — the **backend** (auth, RBAC, DB) is the *less*
  type-checked half. Web is `strict:true`. Turn on `strict` and fix implicit-anys incrementally.

---

## 🟡 Medium

- **M1. OAuth has no CSRF `state` `S`** (`google/github/facebook.strategy.ts`) → login-CSRF. Add `state:true`.
- **M2. Refresh tokens plaintext + never rotated `M`.** `session.entity.ts:20`; `refresh()` only
  mints a new access token (`auth.service.ts:174`). Hash at rest (helper already at
  `tokens.service.ts:58`), rotate on every use, detect reuse.
- **M3. Account enumeration `S`.** Signup "Email already in use" (`auth.service.ts:103`), reset
  "User not found" 404 (`:310`). Return generic responses.
- **M4. In-session password change needs no current-password proof `S`** (`auth.service.ts:258-284`).
  Combined with H1 → one stolen access token = account takeover. Verify current password; revoke other sessions.
- **M5. Internal exception messages leak to clients `S`.** `http-exception.filter.ts:28,53` ships
  raw `exception.message` (TypeORM/pg internals) on 500s. Null it out in prod.
- **M6. helmet applied twice, ordered after Swagger, per-route version skips GET `S`**
  (`main.ts:66-68`, `app.module.ts:47-60`). Apply once, globally, before Swagger.
- **M7. DB has no SSL / no explicit pool `S`** (`database.ts:6-26`). Add env-driven `ssl` + `extra:{max}`;
  keep Postgres off the public network.
- **M8. `.env.example` incomplete + weak `S`.** 9 lines, omits `JWT_SECRET`, GitHub/Facebook/email
  secrets, `FRONTEND_URL`; ships `DATABASE_PASSWORD=1234`.
- **M9. Health endpoint is a static `'OK'` `S`** (`app.controller.ts:9`). Use `@nestjs/terminus`
  for a DB-backed readiness probe; wire into container healthchecks.
- **M10. Secrets are hand-placed `.env` files, no management `M`.** Prefer Docker Compose
  `secrets:` (mounted files) over env vars; complete `.env.example`.
- **M11. Phantom dependency `S`.** `web/services/badminton/queries.ts` imports
  `@tanstack/react-query`, not declared in `apps/web/package.json` (resolves only via hoisting). Declare it.
- **M12. Floating `latest`/`*` versions `S`.** `apps/web` `nitro:"latest"`, `vite-plus:"latest"`;
  root `@nestjs/mapped-types:"*"`. Non-reproducible installs. Pin to caret ranges.
- **M13. rxjs duplicate papered over with a tsconfig `paths` hack `M` _(known debt)_.**
  `apps/api/tsconfig.json:17-20`. Root cause includes a stray `server/node_modules` (see L5).
  Dedupe for real (root `overrides`), then delete the hack.
- **M14. Web↔API response contract hand-mirrored, never validated `M`.** `http.ts` returns
  `get<T=any>() as unknown as Promise<T>`; responses aren't zod-parsed though zod is used for
  inputs. Share the types (H10) and parse responses at the boundary.
- **M15. Auth/users/roles/mail have zero real tests `L` _(known debt)_.** 9 stub specs are
  jest-ignored (`package.json` `testPathIgnorePatterns`); only badminton has genuine coverage.
  Write real `AuthService`/guard tests + one login→protected-route e2e.

## ⚪ Low
- **L1.** Weak password policy (`@MinLength(6)`) + bcrypt cost 10 → raise to 8–12 chars, bcrypt 12 or argon2id.
- **L2.** `synchronize` gated only on `NODE_ENV==='development'` string equality — drop it entirely once migrations exist.
- **L3.** No explicit request body-size limit (relies on implicit 100kb).
- **L4.** No `.dockerignore` (will leak `.env`/`node_modules` into image layers once Dockerfiles exist).
- **L5.** Stray gitignored `server/node_modules` (duplicate rxjs/@angular-devkit) — delete it; fix `db:dev/db:prod` env-file paths.
- **L6.** `TransformInterceptor` strips any top-level `message` field from response bodies (`transform.interceptor.ts:46-50`) — make it opt-in.
- **L7.** `apps/web/tsconfig.json:5-9` references a non-existent `../new-repo` sibling — copy-paste cruft.

---

## Best-practice playbook (from current 2025–2026 sources)

**Auth/session**
- Refresh token → httpOnly + Secure + SameSite cookie scoped to `/auth/refresh`; access token in
  memory only. Short access TTL (5–15 min), rotate refresh on every use with reuse-detection.
- Hash refresh tokens at rest; keep a jti/token-version denylist (Redis) for instant revocation.
- Password hashing: **argon2id** (OWASP: 19 MiB, t=2, p=1) or bcrypt ≥12.
- Throttle auth routes hard; DTO `whitelist:true, forbidNonWhitelisted:true` (already on) blocks
  mass-assignment; return **DTOs not entities** and `@Exclude()` sensitive fields.
- Work the **OWASP API Top 10 (2023)** — BOLA (per-object ownership) is #1 and is exactly C1/H3 here.

**Deploy blueprint (single VPS + Compose)**
1. **Multi-stage Dockerfiles** — `node:22` builder → `node:22-alpine`/distroless runtime, `USER node`,
   `turbo prune <app> --docker` for per-app deps. Add `.dockerignore`.
2. **`docker-compose.prod.yml`** — `api`, `web`, `postgres:17` (pinned), `caddy`; internal network,
   only the proxy exposed; Postgres **not** published to host.
3. **Reverse proxy + TLS** — **Caddy** (automatic Let's Encrypt, ~3-line Caddyfile, persist `/data`).
4. **Migrations** — one-shot `docker compose run --rm api npm run migration:run` before app start;
   never in the app CMD. Expand/contract for low-downtime.
5. **Healthchecks + `restart: unless-stopped`** on every service; `depends_on: {db: service_healthy}`.
   (Note: Docker restarts on *exit*, not *unhealthy* — add autoheal or an orchestrator if needed.)
6. **Secrets** via Compose `secrets:` (files under `/run/secrets`), not env vars.
7. **Backups** — nightly `pg_dump -Fc` sidecar → offsite (S3/B2), tested restores.
8. **Logs** — cap Docker json-file logs (`max-size:10m,max-file:3`) or disk fills; optional Loki+Grafana.
9. **CI/CD** — GitHub Actions: build+push image to ghcr (tagged by SHA), then SSH deploy
   (`docker compose pull` → migrate → `docker-rollout` → curl health). SHA tags = one-line rollback.

---

## Suggested order of attack

1. **Security quick wins (a few hours, `S`):** C4 throttler guard · H4 Swagger guard · H5 CORS
   allowlist · M6 helmet order · M5 error leakage · C2 env validation.
2. **Fix RBAC correctly (`L`):** C1 (both halves + a grants/denies test) · H2 global guard · H3 role-edit hardening.
3. **Make it shippable (`M`):** C3 migrations · C5 Dockerfiles + prod compose + Caddy · H6 shutdown
   hooks · H7 web start · M9 readiness probe · H8 backups.
4. **Harden the pipeline (`S`–`M`):** H9 real CI (build/lint/typecheck/test) · H11 api `strict` ·
   M11/M12 dep hygiene · M13/L5 rxjs dedupe.
5. **Pay down known debt:** H10 shared `badminton-calc` package · M15 real auth tests · M14 response validation.
