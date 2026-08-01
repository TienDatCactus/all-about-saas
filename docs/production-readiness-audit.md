# Production-Readiness Audit — all-about-saas

**Goal:** what this repo needs to become a secure, reproducible, shippable project on a
**single VPS + Docker Compose**. Weighted to **security · DevOps · code quality**.

**Method:** a 9-agent audit (6 subsystem readers, 2 best-practice researchers, 1 adversarial
verifier). 51 raw findings, verified against the actual code, deduplicated to the list below.
Every item cites `file:line`. Dated 2026-07-25.

**Legend:** severity `🔴 critical / 🟠 high / 🟡 medium / ⚪ low` · effort `S`(<1h) `M`(hours) `L`(day+).
Items marked _(known debt)_ were introduced or deliberately deferred during recent feature work.

**Checkbox convention:** `[x]` = the repo now contains the fix. A `⚠️` note on a ticked item
flags something that still needs a human or a running daemon (an operator credential, a
verification that needs Docker). `[ ]` = deliberately not done, with the reason stated.

> **Status as of 2026-08-01 — 36 of 38 findings closed.**
> Critical 5/5 · High 11/11 · Medium 14/15 · Low 6/7.
> Open: **M15** (test suite, skipped by request) and **L2** (partial by design).
> Change-by-change detail lives in [hardening-log.md](./hardening-log.md).

---

## 🔴 Critical — fix before any real deployment

- [x] **C1. RBAC is both dead and unsafe-by-design — fix the two together `L`**
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
  - ✅ **Resolved by deletion.** CASL removed entirely (−176 LOC) after a written plan
    (`docs/casl-removal-plan.md`); replaced with role names + the service-level ownership checks
    that were already doing the real work. Fixing CASL in place would have converted a
    fails-closed bug into a fails-open one.

- [x] **C2. No env-var validation — the app boots with missing/insecure secrets `M`**
  `app.module.ts:23-27` `ConfigModule.forRoot(...)` has **no `validationSchema`**. `JWT_SECRET` is
  read raw (`configuration.ts:26`) and asserted non-null with `!` (`jwt.strategy.ts:13`,
  `auth.module.ts:29`). If `JWT_SECRET`/`DATABASE_*` are unset the app **still starts** — signing
  JWTs with `undefined`. OAuth strategies even fall back to literal `'placeholder_id'`.
  ✅ zod schema in `common/config/env.validation.ts`, all errors at once. Also catches the
  seconds-vs-`"15m"` trap, the >1-year "you passed milliseconds" trap, half-configured OAuth,
  `DATABASE_SYNCHRONIZE=true` in production, and the `REFRESH_EXPIRES_IN` misnaming that had been
  silently ignoring the real config.

- [x] **C3. No migrations + broken migration tooling → fresh prod DB gets no schema `M` — ship blocker**
  `package.json:18` points `typeorm -d src/database/data-source.ts`, but that dir **doesn't exist**;
  the real DataSource at `common/config/data-source.ts` is orphaned **and loads no env** (no
  `dotenv`). Zero migrations are committed. Prod runs `synchronize:false` (`database.ts:23`), so a
  fresh Postgres is **never created**. Paths also disagree (`data-source.ts` uses `src/…/*.ts`,
  `database.ts:25` uses `dist/…/*.js`).
  ✅ Initial migration committed and verified apply → revert → re-apply on a scratch DB, then
  applied for real by the one-shot `migrate` compose service. Made self-contained by hand: TypeORM's
  driver had been creating `uuid-ossp` on connect — invisible in migration history and impossible on
  managed Postgres — so the migration creates it and `installExtensions:false` keeps schema changes
  inside migrations.

- [x] **C4. Rate limiting is configured but never enforced — login brute-force is wide open `S`**
  `ThrottlerModule.forRoot` is registered (`app.module.ts:30-37`) but **no `ThrottlerGuard` is bound**
  (`providers:[AppService]` only). Nothing throttles `POST /auth/login`, and login has no lockout.
  ✅ Bound as `APP_GUARD` + per-route `@Throttle`: 5/min login/signup/reset, 3/min outbound email,
  20/min refresh.

- [x] **C5. Not containerized — no Dockerfiles, no prod compose, no reverse proxy/TLS `M`**
  No `Dockerfile` anywhere; the only compose (`apps/api/docker-compose.yml`) starts **postgres only**
  and publishes it on the host (`${DATABASE_PORT}:5432`). No api/web service, no proxy, no TLS.
  ✅ Multi-stage Dockerfiles for both apps, `docker-compose.prod.yml` (Postgres unpublished, only
  the proxy exposed), Caddy with automatic TLS. Both images built and the full stack brought up
  healthy with 0 restarts. ⚠️ Images need one rebuild to pick up the post-`react-email` shrink.

---

## 🟠 High

- [x] **H1. Access token in `localStorage` → full XSS token theft `L`.** `services/auth/queries.ts:17`,
  read back in `lib/utils/http.ts:36-40`. Refresh token is correctly httpOnly
  (`auth.service.ts:444`), so the access token is the weak link. Keep it **in memory** and
  re-hydrate via `/auth/refresh`; add a strict CSP.
  ✅ Token now lives in a module variable (`lib/utils/access-token.ts`); reload rehydrates through
  the existing 401→refresh interceptor; tokens left by earlier logins are purged once. CSP at Caddy
  pins `connect-src` to this origin + the API, so an injected script has nowhere to send it.
  ⚠️ `script-src` keeps `'unsafe-inline'` (the SSR framework hydrates inline) — the honest upgrade
  is nonce-based CSP at the framework level. ⚠️ `caddy validate` + a browser click-through of
  login → reload → auto-refresh still pending on the Docker daemon.

- [x] **H2. Auth is opt-in per controller, not default-deny `M`.** No global `APP_GUARD`
  (`app.module.ts`); each controller must remember `@UseGuards`, and `PoliciesGuard` returns
  `true` when a route has no `@CheckPolicies` (`policies.guard.ts:25`). A `@Public()` decorator
  already exists but is unused.
  ✅ `JwtAuthGuard` bound globally; public routes opt out with `@Public()` (share endpoint, the
  OAuth legs — a login flow cannot require a login).

- [x] **H3. Privilege escalation via role editing `M`.** `PATCH /roles/:id/permissions`
  (`roles.controller.ts:38`) is gated only by `{update, Role}`; the service blindly persists the
  client-supplied permission array (`roles.service.ts:34-60`) with no roleId restriction and no
  "grant-only-what-you-hold" check. Anyone who can update a Role can grant themselves
  `manage all`. (Live once C1 is fixed.)
  ✅ Removed with the CASL permission model (C1); the escalation surface no longer exists.

- [x] **H4. Swagger served unconditionally in prod `S`.** `main.ts:59-66` — full API schema at `/api`
  to anonymous users. ✅ Behind `NODE_ENV !== 'production'`.

- [x] **H5. CORS wide open `S`.** `main.ts:25` `enableCors()` with no options; `frontendUrl`
  (`configuration.ts:42`) exists but is unused.
  ✅ Explicit `FRONTEND_URL` allowlist with `credentials:true`, and **no** `origin: true` fallback —
  reflecting the caller's origin while sending credentials lets any site read authenticated
  responses. Env validation makes the variable mandatory in production.

- [x] **H6. No graceful shutdown `S`.** `main.ts` never calls `enableShutdownHooks()`; `docker stop`
  SIGTERM hard-kills in-flight requests and the DB pool. ✅ Enabled.

- [x] **H7. No prod serve strategy for web `S`.** `apps/web/package.json` has only `dev/build/preview`
  — no `start`. ✅ Nitro output served from `apps/web/Dockerfile`; verified 200 in the running stack.

- [x] **H8. No Postgres backups `M`.** Only persistence is the `pgdata` volume. One disk failure =
  total loss. Add scheduled `pg_dump -Fc` → **offsite**, with tested restores.
  ✅ `backup` sidecar in the prod compose (ships with the stack, so provisioning cannot forget it):
  matching `postgres:16-alpine`, secret-file password, dump→`.part`→size-check→rename so a
  half-written dump can never look real, retention prune, baseline dump at startup.
  `scripts/backup-db.sh` holds the offsite leg and `--verify-latest` restore test.
  ⚠️ Offsite is operator config (`BACKUP_REMOTE` + credentials) and the restore test has not yet
  been run against real sidecar output — both need the daemon and a real host.

- [x] **H9. No CI gate `S`.** `.github/workflows` has only two third-party bots
  (react-compiler `fail-on-error:false`, react-doctor). Nothing runs `turbo build/lint/test`.
  Also: **`check-types` typechecks nothing** — no workspace defines a `check-types` script.
  ✅ Required gates: check-types + lint (both apps) + build + test, plus a docker-build job.
  `check-types` had been covering only `packages/badminton-calc`; naming it consistently surfaced
  6 real type errors immediately.

- [x] **H10. Split algorithm duplicated across api + web `M` _(known debt)_.** `badminton.calc.ts` and
  `web/lib/badminton/calc.ts` are the same ~90-line function; `ComputedSnapshot` lives in **three**
  files. ✅ Extracted to `packages/badminton-calc`, consumed by both; the web schema carries a
  compile-time assertion that it still matches the package's type.

- [x] **H11. API tsconfig isn't strict `S`.** `apps/api/tsconfig.json` sets only `strictNullChecks`;
  `noImplicitAny:false` and friends off — the **backend** (auth, RBAC, DB) is the *less*
  type-checked half. Web is `strict:true`.
  ✅ `strict: true`, no sub-flag left off (94 errors → 0). Found an **OAuth account takeover**:
  `email` typed `string` while providers legitimately omit it, and TypeORM drops `undefined` WHERE
  conditions — so `SELECT … LIMIT 1` matched an arbitrary user and minted *their* tokens.

---

## 🟡 Medium

- [x] **M1. OAuth has no CSRF `state` `S`** (`google/github/facebook.strategy.ts`) → login-CSRF.
  ✅ Double-submit cookie with timing-safe compare, single-use, `sameSite:lax` (strict would
  withhold the cookie on the provider's redirect back). Chosen over passport's `state:true`, which
  needs express-session; the library's behaviour was read from `passport-oauth2` source, not assumed.
  9 tests.
- [x] **M2. Refresh tokens plaintext + never rotated `M`.** `session.entity.ts:20`; `refresh()` only
  mints a new access token (`auth.service.ts:174`).
  ✅ sha256 at rest, rotation on every use, replay revokes every session — with a 10s grace so
  concurrent tab refreshes aren't mistaken for theft. `jti` added because HS256 is deterministic:
  two logins in the same second had been minting byte-identical tokens.
- [x] **M3. Account enumeration `S`.** Signup "Email already in use" (`auth.service.ts:103`), reset
  "User not found" 404 (`:310`). ✅ Identical responses — **and** a throwaway bcrypt compare when
  the user is absent, because <1ms vs ~300ms is an oracle no wording fixes.
- [x] **M4. In-session password change needs no current-password proof `S`** (`auth.service.ts:258-284`).
  ✅ Current password required, other sessions revoked. The endpoint was also **500ing on every
  call** (`select:false` password column fed `undefined` to bcrypt).
- [x] **M5. Internal exception messages leak to clients `S`.** `http-exception.filter.ts:28,53` ships
  raw `exception.message` (TypeORM/pg internals) on 500s. ✅ Withheld in prod; `traceId` ties the
  response to the server-side log.
- [x] **M6. helmet applied twice, ordered after Swagger, per-route version skips GET `S`**
  (`main.ts:66-68`, `app.module.ts:47-60`). ✅ Applied once, globally, before Swagger.
- [x] **M7. DB has no SSL / no explicit pool `S`** (`database.ts:6-26`). ✅ Env-driven `ssl` + pool
  `max`/timeouts; `rejectUnauthorized` is a **separate** switch because it stops eavesdropping but
  not impersonation, and should be chosen deliberately.
- [x] **M8. `.env.example` incomplete + weak `S`.** ✅ Complete and annotated, plus a new
  `.env.prod.example`. `.gitignore` switched to deny-all `.env.*` with example whitelisting —
  `.env.prod` had **not** been ignored.
- [x] **M9. Health endpoint is a static `'OK'` `S`** (`app.controller.ts:9`).
  ✅ Split: `/health` liveness never touches the DB (a restart cannot fix a DB outage — tying them
  creates restart loops); `/health/ready` does `SELECT 1` and 503s. Deliberately without
  `@nestjs/terminus` — two endpoints did not justify the dependency. Its first form **killed the
  process on every healthcheck poll**; see hardening-log.
- [x] **M10. Secrets are hand-placed `.env` files, no management `M`.** ✅ Compose `secrets:` mounted
  as files, read via the `*_FILE` convention with an explicit allowlist. Env vars are inherited by
  child processes and visible in `docker inspect`; files are not.
- [x] **M11. Phantom dependency `S`.** `@tanstack/react-query` undeclared. ✅ Declared — and three
  more of the same class were later found by the container build (`@repo/typescript-config`,
  `@types/react`, `dotenv`), all of which had resolved only via hoisting.
- [x] **M12. Floating `latest`/`*` versions `S`.** ✅ `nitro`, `vite-plus`, `@nestjs/mapped-types`
  pinned. Workspace `*` deps kept — that is the npm-workspaces convention, not a floating range.
- [x] **M13. rxjs duplicate papered over with a tsconfig `paths` hack `M` _(known debt)_.**
  ✅ Root cause: `@angular-devkit/*` pins `=7.8.1` while the workspace resolved `7.8.2` — five
  copies, two structurally distinct `Observable` types, and a runtime duplication the `paths` hack
  never touched. Exact-pin override collapses it to one copy; hack deleted.
- [x] **M14. Web↔API response contract hand-mirrored, never validated `M`.**
  ✅ zod schemas are now both the type and the runtime check, for badminton **and** auth. Converting
  the hand-written interfaces exposed three live mismatches, including a list type promising fields
  the endpoint never sent.
- [ ] **M15. Auth/users/roles/mail have zero real tests `L` _(known debt)_.** 9 stub specs are
  jest-ignored; only badminton has genuine coverage.
  **Deliberately skipped** — user instruction: "no need to focus on tests". ~35 targeted tests did
  land where they verified new security controls (rotation/grace/replay, OAuth state ×9,
  file-secrets ×10, health), but the guard tests and the login→protected-route e2e this item asks
  for are still missing.

## ⚪ Low

- [x] **L1.** Weak password policy (`@MinLength(6)`) + bcrypt cost 10. ✅ 8-char minimum, bcrypt 12,
  72-byte cap (bcrypt truncates silently past it). Login DTOs deliberately keep **no** composition
  rules — enforcing the new floor on a *submitted* password would lock out every account created
  under the old one.
- [ ] **L2.** `synchronize` gated only on `NODE_ENV==='development'` string equality — drop it
  entirely once migrations exist.
  **Partial by design.** Production now *refuses* `DATABASE_SYNCHRONIZE=true` at boot via env
  validation, which is the load-bearing half. Dev still uses it: flipping dev to migrations breaks
  existing dev volumes, since `migration:run` fails against an already-synced schema. Worth doing
  as a deliberate one-off with a `docker:reset`, not as a drive-by.
- [x] **L3.** No explicit request body-size limit. ✅ Explicit 100kb — which required
  `bodyParser: false` at `create()`, because express skips an already-parsed body and a later
  `app.use` limit would have been decoration.
- [x] **L4.** No `.dockerignore`. ✅ Added, and later extended to exclude `secrets/` and `backups/`.
- [x] **L5.** Stray gitignored `server/node_modules`. ✅ Verified gone — no `server/` directory
  exists; the duplicate-rxjs story was entirely M13's hoisting conflict.
- [x] **L6.** `TransformInterceptor` strips any top-level `message` field. ✅ Now opt-in via
  `@ResponseMessage()`; a resource's own `message` field is no longer silently deleted.
- [x] **L7.** `apps/web/tsconfig.json:5-9` references a non-existent `../new-repo` sibling. ✅ Removed.

---

## Best-practice playbook (from current 2025–2026 sources)

**Auth/session**
- [x] Refresh token → httpOnly + Secure + SameSite cookie; access token **in memory only**. Short
  access TTL (5–15 min), rotate refresh on every use with reuse-detection. ✅ All of it.
- [x] Hash refresh tokens at rest. ✅ sha256 (indexable; a 256-bit JWT needs no slow hash).
  ⚠️ A jti/token-version denylist in Redis for *instant* revocation is not built — revocation is
  DB-row based, which is correct but not sub-request-latency.
- [x] Password hashing: argon2id or **bcrypt ≥12**. ✅ bcrypt 12.
- [x] Throttle auth routes hard; `whitelist`/`forbidNonWhitelisted` on; return DTOs not entities.
  ✅ Throttled; DTO options were already on.
- [x] Work the **OWASP API Top 10 (2023)** — BOLA is #1 and is exactly C1/H3 here. ✅ Ownership is
  enforced in services against loaded rows.

**Deploy blueprint (single VPS + Compose)**
1. [x] **Multi-stage Dockerfiles** + `turbo prune --docker` + `.dockerignore`. ✅ Both apps.
   Production-only runner install took the API image 1.44GB → 726MB.
2. [x] **`docker-compose.prod.yml`** — api, web, postgres (pinned), caddy; internal network, only
   the proxy exposed; Postgres **not** published. ✅
3. [x] **Reverse proxy + TLS** — Caddy with persisted `/data`. ✅
4. [x] **Migrations** as a one-shot service before app start, never in the app CMD. ✅ Gated by
   `service_completed_successfully`.
5. [x] **Healthchecks + `restart: unless-stopped`** everywhere; `depends_on: service_healthy`. ✅
6. [x] **Secrets** via Compose `secrets:`. ✅
7. [x] **Backups** — nightly `pg_dump -Fc` sidecar. ✅ ⚠️ offsite + tested restore outstanding (H8).
8. [x] **Logs** — cap json-file logs or disk fills. ✅ The anchor had been declared and referenced
   by **nothing**; every container was running unbounded. Now applied to all five services.
9. [ ] **CI/CD** — build+push to ghcr tagged by SHA, then SSH deploy (pull → migrate →
   docker-rollout → curl health).
   **CI done, CD not.** CI builds both images but does not push them, and there is no deploy step
   or SHA-tag rollback path. This is the largest remaining blueprint gap.

---

## Suggested order of attack

1. [x] **Security quick wins:** C4 · H4 · H5 · M6 · M5 · C2.
2. [x] **Fix RBAC correctly:** C1 · H2 · H3.
3. [x] **Make it shippable:** C3 · C5 · H6 · H7 · M9 · H8.
4. [x] **Harden the pipeline:** H9 · H11 · M11/M12 · M13/L5.
5. [x] **Pay down known debt:** H10 · M14. (M15 skipped by request.)

---

## What is actually left

1. **CD pipeline** (blueprint 9) — the biggest gap; nothing automates deployment or rollback.
2. **M15** — guard tests + a login→protected-route e2e, if the no-tests instruction is ever lifted.
3. **Operator steps nobody but you can do:** `BACKUP_REMOTE` credentials, a real domain in
   `.env.prod`, `ACME_EMAIL`.
4. **Verification waiting on the Docker daemon:** rebuild both images and re-measure, `caddy
   validate` the new CSP block, run the backup sidecar once and `--verify-latest` its output, and
   click through login → reload → auto-refresh in a served build.
5. **Watch-list** (documented, not defects): `@nestjs/swagger`'s exact `js-yaml` pin,
   `brace-expansion` upstream, TypeORM relations typed `!` but undefined-unless-joined,
   `signJwt(payload: any)` with no runtime payload validation, `test/` excluded from typecheck,
   and L2's dev-side `synchronize`.
