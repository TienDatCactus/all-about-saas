# Backend Roadmap — the NestJS playlist (48 eps) mapped onto this repo

**Revised 2026-08-05** against `977dd35`. Replaces the 2026-08-05 first draft, which was written before
the hardening/deploy work landed and still assumed CASL, in-repo nginx, and an unfixed Phase 0.

Source material: "Tips Javascript" NestJS + Ecommerce-Microservices playlist, ep 01–48.
Target: `apps/api` — NestJS 11, TypeORM 0.3, Postgres 16, zod-validated env, global `JwtAuthGuard`,
shipped to a single VPS via GHCR + `scripts/deploy.sh` behind host nginx.

Read these first; this roadmap defers to them and does not restate their decisions:
[production-readiness-audit.md](docs/production-readiness-audit.md) (finding register),
[hardening-log.md](docs/hardening-log.md) (why each fix looks the way it does),
[deployment.md](docs/deployment.md) (the live runbook),
[casl-removal-plan.md](docs/casl-removal-plan.md) (the authorization model),
[badminton-splitter-spec.md](docs/badminton-splitter-spec.md) (the actual product).

**Framing correction the first draft got wrong.** This is not a generic SaaS reasoning about
hypothetical scale. `apps/web/src/routes/` contains auth pages plus four `badminton/*` routes and
nothing else; `casl-removal-plan.md:24` calls badminton "the real feature". So every phase below is
justified by a badminton-shaped need or a deploy-shaped need, and phases that only make sense for an
imaginary social network are marked as such. The playlist is an ecommerce-microservices course — most
of its second half is a curriculum, not a backlog.

---

## 1. Reconciled status — what the playlist teaches vs what exists

| Ep | Topic | State | Evidence |
|---|---|---|---|
| 01–05 | Why Nest, IoC, CLI, debug, providers | Done | DI throughout, `nest-cli.json`, turbo scripts |
| 06 | AOP: pipe / guard / interceptor / filter / middleware | Done, with dead members | `TransformInterceptor` (`transform.interceptor.ts:21`), `HttpExceptionFilter` (`http-exception.filter.ts:63`), global `ValidationPipe` (`main.ts:49`). Dead: `LoggingInterceptor` unregistered, `VersionMiddleware` unregistered, `OwnershipGuard` returns `true` — see P0-C |
| 07 | Registration + login | Exceeded | 14 auth routes (`auth.controller.ts:50`–`:295`), selector+hash verification tokens, non-oracle signup, timing-parity absent-user hash (`users.service.ts:45`) |
| 08–09 | Upload: multer disk, chunked large file + merge | **Missing** | zero `multer`/`FileInterceptor`/`UploadedFile` hits. `UserProfile.avatarUrl` (`user-profile.entity.ts:19`) is a URL column with no writer |
| 10–12 | Logger levels, Winston, file/search format | **Missing, and mis-set** | `ConsoleLogger` with `logLevels: ['error','debug','verbose','fatal']` (`main.ts:25`) — `log` and `warn` are dropped. No pino/winston. No correlation id |
| 13–15 | Dockerfile FE/BE, image shrink | Done, better than the course | 4-stage + `turbo prune --docker` (`apps/api/Dockerfile:31`), non-root, 1.44GB → 726MB (`docs/docker-and-env.md:198`) |
| 16 | Scale with PM2 | Superseded | Docker `restart: unless-stopped` + healthchecks. PM2 would add a supervisor inside a supervised container. Blocked anyway — see Phase 3 on the in-memory throttler |
| 17–22 | TypeORM: relations, migrations, repository | Done | `BaseService` (`base.service.ts:41`), `BaseEntity`/`SoftDeleteBaseEntity`, one committed migration `1785518575724-init.ts` with 8 tables. CLI paths resolve (`package.json:22`, `data-source.ts:39`) — the first draft's "broken migration script" claim was **wrong** |
| 23–24 | Prisma | **Dropped** | Repo is TypeORM with a committed schema. Two ORMs over one DB is cost with no return. Watch for learning only |
| 25–26 | Search: MySQL vs Elasticsearch | **Partially needed** | `suggestParticipants` is an unindexed `ILIKE` (`badminton.service.ts:202`). Postgres `pg_trgm` closes this; Elasticsearch is not warranted — Phase 5 |
| 27 | JWT + permissions | Done | HS256, `jti` per refresh token (`tokens.service.ts:53`), sha256 hash + `timingSafeEqual` (`:83`) |
| 28–29 | ACL / RBAC for admin | Deliberately thin, and **currently non-functional** | CASL deleted by decision (`production-readiness-audit.md:38`). `RolesGuard` works but nothing seeds or assigns a role, so `@Roles('admin')` denies everyone — P0-B |
| 30 | Ship it: nginx, smtp, redis, mysql, elastic, kafka | Done for the parts that apply | GHCR images, `cd.yml`, `scripts/deploy.sh` with health-gated rollback, host nginx + certbot, Mailpit in dev, `pg_dump` sidecar. Redis/elastic/kafka not shipped because nothing needs them yet |
| 31–32 | Cache for QPS/TPS; write-cache ↔ DB consistency, 4 scenarios | **Missing** | zero cache deps. Also blocks: in-memory throttler store (`app.module.ts:67`), no jti denylist (`production-readiness-audit.md:239`), inline email send (`auth.service.ts:568`) — Phase 3 |
| 33–35 | Feed at peak, like/unlike, Redis pipeline | **Conditional** | Only lands if the spec's deferred v2 reaction feature ships (`badminton-splitter-spec.md:62-70`) — Phase 4 |
| 36–48 | Microservices, gRPC/TCP, MQ, saga, gateway security | **Gated, not scheduled** | One VPS, one product, one developer. Phase 7 states the trigger |
| 38 | Etcd / k8s config | Deferred | zod-validated env + Compose `secrets:` files is the correct tier for one host (`file-secrets.ts:27`) |
| 44–45 | "Share source code" episodes | N/A | Nothing to implement |

---

## Phase 0 — close what a fresh audit still finds open

Not the same list as the first draft: five of its six items were fixed by the hardening work. These
are new findings from re-reading the code at `977dd35`. Nothing else in this roadmap should start
before P0-A.

### P0-A — Security: the refresh token is written to the log (30 min)

`apps/api/src/auth/auth.controller.ts:210`

```ts
Logger.debug(`Refresh token: ${refreshToken}`);
```

`debug` is an enabled level (`main.ts:25`), the prod log driver is `json-file` with 30MB retained per
service (`docker-compose.prod.yml:22-26`), and the token is a bearer credential valid for the whole
refresh window. Delete the line. Then grep the whole tree for the same class of leak before moving on:

```
grep -rnE "Logger\.(debug|log|verbose)\(.*(token|password|secret|cookie|authorization)" apps/api/src
```

Exit: no credential appears in any log statement; `docker compose -f docker-compose.prod.yml logs api`
on the next deploy contains no JWT-shaped string (`grep -E 'eyJ[A-Za-z0-9_-]{10,}'`).

### P0-B — `@Roles('admin')` denies everybody (2–3 h)

`RolesGuard` reads `user.role.name` from the DB (`roles.guard.ts:35-40`), but no code path ever sets
`User.role` — not `UsersService.create` (`users.service.ts:94`), not `findOrCreateOAuthUser` (`:76`),
and `grep -rni seed apps/api/src` is empty. `Role` rows do not exist either. So the two admin routes
on `roles.controller.ts:17` are unreachable, and the guard's failure mode is silent.

Decide one of two, and write the decision down rather than leaving it ambiguous:

- **(a) Make it work.** A migration inserting `role('admin')` and `role('user')`, a nullable-default
  assignment in `UsersService.create`, and a documented one-off promote path
  (`npm run cli -- user:promote <email>` or a SQL snippet in `deploy/SETUP.md`). Add the guard's first
  test — `RolesGuard` has no spec today.
- **(b) Delete it until an admin screen exists.** Remove `roles.controller.ts`, `RolesService`
  (it is a bare `extends BaseService` with no methods, `roles.service.ts:8`), `RolesGuard`,
  `roles.decorator.ts`. Keep the `role` table and `User.role` column — dropping the column costs a
  migration; `casl-removal-plan.md:144` already established the routes have no caller.

(b) is consistent with how CASL was handled and is ~40 lines of deletion. Choose (a) only if an admin
surface is on the near roadmap.

Exit: either an integration test proves an `admin`-roled user reaches `GET /roles` and a plain user
gets 403, or the dead surface is gone and `grep -rn "@Roles" apps/api/src` is empty.

### P0-C — Delete the dead cross-cutting code before extending it (1–2 h)

Every item here is confirmed unreferenced or inert. It matters now because Phases 1–3 all touch this
same layer, and each dead file is a decoy that will get "fixed" instead of removed.

| Delete / fix | Why | Ref |
|---|---|---|
| `common/guard/ownership.guard.ts` | Unconditional `return true`, logs `'===TRIGGER ROUTE GUARD==='`, not `@Injectable()`, zero importers. Ownership lives in service queries by decision | `ownership.guard.ts:8`; `casl-removal-plan.md:124` |
| `common/middleware/version.middleware.ts` | Hardcoded `x-app-version === '2.0.0'` gate; only reference is a commented line | `version.middleware.ts:8`, `app.module.ts:116` |
| `common/guard/throttler.guard.ts` body | Exists only to log `'===TRIGGER GLOBAL GUARD==='` at a suppressed level; misspelled `CustomeThrottlerGuard`. Either keep the class with real per-route key logic or use `ThrottlerGuard` directly | `throttler.guard.ts:4-10` |
| `badminton/badminton.calc.ts` + `badminton/types/computed-snapshot.ts` | Orphaned in-app copy; all consumers import `@repo/badminton-calc`. A second copy of the split algorithm is exactly the drift the spec's shared-package decision exists to prevent | `badminton.service.ts:6`; `badminton-splitter-spec.md:34-37` |
| `badminton/dto/*.ts` (3 files) | Live DTOs are all in `badminton.dto.ts`; the `dto/` directory is unreferenced duplicates | `badminton.controller.ts:18-22` |
| `users/users.dto.ts` `QueryUsersDto` | No consumer. Also carries a stale header comment naming another file | `users.dto.ts:1`, `:12` |
| `app.service.ts` `AppService.health()` | Unreferenced since the health split; `AppService` still provided | `app.service.ts:5`, `app.module.ts:81` |
| `test/app.e2e-spec.ts` | Asserts `GET /` → `'Hello World!'`; no `GET /` route exists. Stale scaffolding that also never runs (`rootDir: "src"`) | `app.controller.ts`, `package.json:113` |
| `auth.module.ts:45` duplicate `MailService` provider | `MailModule` is already imported at `:34`; the extra provider creates a second instance with its own transport | `auth.module.ts:34`, `:45` |
| `ua-parser-js` dependency location | Imported at `auth.service.ts:13`, declared only in the **root** `package.json:39`. Resolves by hoisting today; breaks the moment the API is installed alone — and `apps/api/Dockerfile` does exactly that (`--omit=dev` install from pruned json) | `auth.service.ts:13` |
| `OAuthAccount.accessToken` / `.refreshToken` | Provider tokens stored as plaintext columns. Nothing reads them. Drop the columns, or encrypt at rest if a provider API call is planned | `oauth-account.entity.ts:53-57` |

Exit: `npx turbo run check-types lint test` green; `git diff --stat` is net-negative; no behaviour change
observable through the API.

---

## Phase 2 — Structured logging + correlation (ep 10, 11, 12) · 1–2 days

Numbered 2 because P0 comes first; it is the first *feature* phase. First because every later phase is
undiagnosable without it, and because `HttpExceptionFilter` already has a hole shaped exactly like it:

```ts
// http-exception.filter.ts:115-118 — reads request.traceId "if one is added upstream". Nothing adds it.
const traceId = request.traceId ?? request.headers['x-trace-id'] ?? randomUUID();
```

Today every error invents its own id, so two log lines from one request share nothing, and GET requests
are not logged at all (`LoggerMiddleware` is registered for POST/PATCH/DELETE only, `app.module.ts:102-115`).

**Choice: `nestjs-pino` over Winston.** The playlist teaches Winston (ep 11–12) and Winston is fine, but
pino gives JSON + child-logger-per-request + `AsyncLocalStorage` correlation out of the box, and the prod
log path is already stdout → `json-file` driver, so file transports and rotation are the *container's*
job (`docker-compose.prod.yml:22-26`), not the app's. Do ep 12's file-rotation exercise only if you also
want local file search.

```
npm i -w @app/api nestjs-pino pino-http && npm i -D -w @app/api pino-pretty
```

Tasks:
1. `src/common/logger/logger.module.ts` — `LoggerModule.forRootAsync` reading `LOG_LEVEL` (add to the zod
   schema in `env.validation.ts`, default `info`, prod-warn if `debug`). `transport: pino-pretty` when
   `NODE_ENV !== 'production'`, raw JSON otherwise.
2. `genReqId` — accept an inbound `x-request-id`/`x-trace-id`, else `randomUUID()`; echo it on the
   response header. Assign it to `req.traceId` so `http-exception.filter.ts:115` stops generating and
   starts reading. Log every method, not just writes.
3. `app.useLogger(app.get(Logger))` in `main.ts`, replacing the `ConsoleLogger` block at `:24-27` —
   which also fixes the dropped `log`/`warn` levels, unmasking `LoggerMiddleware`, the refresh-reuse
   `Logger.warn` at `auth.service.ts:292`, and anything else currently invisible.
4. `redact` list: `req.headers.authorization`, `req.headers.cookie`, `res.headers['set-cookie']`,
   `*.password`, `*.currentPassword`, `*.refreshToken`, `*.token`. This is the structural fix for the
   class of bug P0-A was an instance of.
5. Delete `common/interceptor/logging.interceptor.ts` (never registered) and slim `LoggerMiddleware`
   to nothing — `pino-http` covers both, with status and duration, which neither did.
6. `autoLogging.ignore` for `GET /health` so the 15s container healthcheck (`docker-compose.prod.yml:201`)
   does not become the log volume.

Exit: one `curl -H 'x-request-id: probe-1' .../auth/login` with a bad password yields a request line and
an error line both carrying `probe-1`, the 401 body's `traceId` equals `probe-1`, and no cookie, token
or password string appears anywhere in the output. `LOG_LEVEL=debug` changes verbosity with no rebuild.

---

## Phase 3 — Redis: cache, write consistency, and three things blocked on it (ep 31, 32) · 4–6 days

The playlist's ep 32 (four write-cache/DB consistency scenarios) is the single most transferable lesson
in the list, and this repo has three *existing* problems that all resolve into the same box:

| Blocked today | Symptom | Ref |
|---|---|---|
| Throttler store is in-memory | Per-process buckets. Two replicas = 2× every limit; the 5/min login limit becomes 10/min | `app.module.ts:67-74` |
| No refresh-token denylist | Revocation waits for expiry; rotation reuse-detection is DB-only | `production-readiness-audit.md:239-240` |
| Email sent inline in the request | Signup latency = SMTP latency; a slow relay is a slow API, and a failed send fails the signup | `auth.service.ts:568-581`, `mail.service.ts:13` |

Add to `docker-compose.yml` (dev) and `docker-compose.prod.yml` (`redis:7-alpine`, pinned per
`docs/docker-and-env.md:54`, no published port in prod, `--requirepass` from a Compose file secret to
match the existing `secrets:` pattern, `appendonly yes`, healthcheck `redis-cli ping`, and a `redisdata`
volume). Gate `api` on `redis: service_healthy` like it gates on Postgres (`:196-200`).

```
npm i -w @app/api ioredis @nestjs/cache-manager cache-manager @keyv/redis
npm i -w @app/api @nest-lab/throttler-storage-redis   # or nestjs-throttler-storage-redis
```

### 3a. Cache module and key discipline (1 day)

`src/common/cache/` — a `CacheModule` plus a typed key builder. No inline string concatenation in
services; one file that enumerates every key namespace and its TTL, because invalidation correctness is
a property of the key set, not of any single call site.

```ts
// cache.keys.ts — one place to read when asking "what invalidates this?"
export const K = {
  sessionPublic: (shareToken: string) => `bad:pub:${shareToken}`,      // TTL 60s
  participantSuggest: (ownerId: string, q: string) => `bad:sug:${ownerId}:${q}`, // TTL 300s
  userById: (id: string) => `user:${id}`,                              // TTL 300s
} as const;
```

### 3b. The two real read paths (1 day)

Cache-aside, applied to the two places with actual traffic — not to everything:

- **Public share link.** The spec's unguessable read-only view (`badminton-splitter-spec.md:47`) is
  unauthenticated, linkable, and returns a `computed` jsonb snapshot that only changes when the owner
  edits. This is the ideal cache-aside target: short TTL + explicit invalidation on update.
- **Participant autocomplete.** `suggestParticipants` runs an unindexed `ILIKE` per keystroke
  (`badminton.service.ts:202-212`) — `app.module.ts:57-61` already documents that this endpoint's
  request-per-prefix behaviour is what forced the global throttle limit up. Cache per (ownerId, prefix).

Add TTL jitter (±10%) and single-flight (`SETNX` lock, short expiry) so a cold key does not fan N
concurrent misses into N identical queries.

### 3c. Ep 32's four scenarios, as tests (1–2 days)

The point of this phase. Implement the correct pattern and *encode the wrong ones as failing-by-design
tests* so the reasoning survives:

1. **DB → then delete cache.** The baseline. Delete, don't update — writing the cache from the writer
   invents a second source of truth.
2. **Cache → then DB.** Demonstrate the data loss when the process dies between the two, then reject.
3. **Concurrent read-miss vs write.** Reader loads v1, writer commits v2 and deletes, reader writes
   v1 back — a stale entry with a full TTL to live. Fix with delayed double-delete or a version-stamped
   key; pick one and say which.
4. **Invalidation after a committed transaction fails.** Never invalidate inside the transaction
   (rollback leaves a hole) and never assume the delete succeeded. Use a TypeORM `afterTransactionCommit`
   subscriber or a small outbox row + retry. This same outbox is what Phase 5's reindexing needs.

### 3d. The three unblocked items (1–2 days)

- Throttler storage → Redis. Then, and only then, `docker compose up -d --scale api=2` is honest.
- `jti` denylist: on logout / password reset / reuse-detection, `SETEX denylist:jti:<jti> <ttl> 1`;
  `JwtStrategy.validate` checks it. TTL equals the token's remaining life, so the set is self-pruning.
  Note the tradeoff plainly: this makes Redis a dependency of authentication — decide whether a Redis
  outage should fail open (available, revocation delayed) or closed (secure, API down), and encode it.
- Move mail off the request path with BullMQ (`npm i -w @app/api @nestjs/bullmq bullmq`): a `mail` queue
  with retry/backoff, so `sendVerificationEmail` enqueues and returns. This is the honest version of
  the playlist's ep 41/42 message-queue lesson at this repo's scale — a queue inside one service, no
  broker topology needed.

Exit: cache hit ratio observable in logs; all four ep-32 scenarios covered by tests; two api replicas
share one rate-limit bucket (verify: 6 rapid logins across both replicas → the 6th is 429); a logout
invalidates its access token immediately; signup returns before SMTP completes and a forced SMTP failure
retries without failing the HTTP request.

---

## Phase 4 — Files and upload (ep 08, 09) · 3–5 days

Deferred behind Redis because nothing in the product needs it yet: `UserProfile.avatarUrl` and
`OAuthAccount.avatarUrl` are populated from provider URLs, and `user-profile.entity.ts:11-14` notes
nothing writes the profile at all. Do this when avatars or a receipt photo per badminton session becomes
a real requirement.

- `src/files/` with a `StorageService` interface + `LocalDiskStorage` (ep 08's `diskStorage`), so an S3
  driver is a provider swap. On this VPS, local disk means a Docker volume — add it to the backup
  sidecar's scope or accept that files are not backed up, explicitly.
- `file` entity extending `SoftDeleteBaseEntity`: `key`, `mime`, `size`, `checksum`, `ownerId`. Store a
  generated key, never the client's `originalname`; keep the display name as data.
- Ownership per the established convention — `where: { id, ownerId }` in the service, not a guard
  (`casl-removal-plan.md:124-126`).
- **Body limits must move together.** `main.ts:20` caps JSON at `100kb` with `bodyParser: false`, and
  nginx caps at `client_max_body_size 1m` (`deploy/nginx/twinfoundry.org-single-domain.conf:80`). An
  upload route needs a per-route multer limit *and* a matching `location` override in both nginx variants
  — and the Caddyfile has **no** body limit at all today, so the profile-gated Caddy path would accept
  unbounded bodies. Fix that in the same change.
- Chunked upload (ep 09) only if files can exceed ~10MB: `POST /files/uploads` opens a session,
  `PUT /files/uploads/:id/parts/:n`, `POST /files/uploads/:id/complete` merges in order and verifies a
  client SHA-256. Idempotent and resumable — `complete` returns the received part list. A janitor job on
  the Phase 3 queue reaps abandoned sessions.

Exit: an over-size and a wrong-mime upload are both rejected with the standard error envelope; a killed
1GB transfer resumes; the proxy layer and the app agree on the limit at every hop.

---

## Phase 5 — Search that matches the query you actually run (ep 25, 26) · 1–2 days

The playlist jumps to Elasticsearch. This repo's only search is
`ILIKE '%q%'` over `badminton_participant.name`, limited to 8 (`badminton.service.ts:202-212`), on a
table with no index for it. The correct next step is one migration:

- `CREATE EXTENSION pg_trgm;` + a GIN trigram index on `lower(name)`, which makes the existing leading-%
  `ILIKE` indexable — a plain btree cannot serve it. Add `unaccent` if Vietnamese diacritics should match
  loosely, which for this product they should.
- Verify with `EXPLAIN ANALYZE` before/after on a seeded table (~50k rows) and record both plans in the
  phase's design note. "It felt faster" is not the exit criterion.
- Elasticsearch stays out until a written trigger fires: multi-entity relevance ranking or faceting that
  SQL cannot express. When it does, it goes behind the same `SearchService` interface and reindexes from
  Phase 3's outbox — never dual-write from a controller.

Exit: the autocomplete query is index-backed in `EXPLAIN ANALYZE`; the Phase 3 cache in front of it
becomes an optimisation rather than a load-bearing necessity.

---

## Phase 6 — Operational tail (ep 30, and what ep 16 was reaching for) · 2–3 days, mostly small

Docker, images, CI/CD, TLS, and backups are **done** — `cd.yml` builds and pushes SHA-tagged GHCR images
and `scripts/deploy.sh` gates migrations on Postgres health, waits on container health, and re-execs
itself with `PREVIOUS_TAG` on failure (`scripts/deploy.sh:105`). What remains is the tail neither the
audit nor the playlist closes:

1. **Container limits.** No `mem_limit`/`cpus`/`pids_limit`/`read_only`/`cap_drop`/`security_opt` anywhere
   in either compose file. One runaway Node process currently takes the host, including Postgres.
2. **Proxy-layer rate limiting.** Zero `limit_req` in either nginx variant; app-level throttling is the
   only defence, which means every abusive request still costs a Node event-loop turn and a DB round-trip
   (`RolesGuard` does one per request — `roles.guard.ts:35`). A `limit_req_zone` on `/api/auth/` is cheap.
3. **Backups are unverified.** The sidecar dumps locally (`docker-compose.prod.yml:98-115`) but
   `BACKUP_REMOTE` is unset and absent from `.env.prod.example`, offsite is a manual cron
   (`scripts/backup-db.sh:76`), the sidecar has no healthcheck so a permanently failing dump loop is
   silent, and `--verify-latest` has never been run against real output
   (`production-readiness-audit.md:128-129`). An unrestored backup is a hypothesis.
4. **`.env.prod.example` drift.** Missing `API_IMAGE`, `WEB_IMAGE`, `API_HOST_PORT`, `WEB_HOST_PORT`,
   `BACKUP_REMOTE` — without the image vars, `compose pull` targets nonexistent local tags. And
   `VITE_API_BASE_URL` has three different values in-tree (`.env.prod.example:46`,
   `docker-compose.prod.yml:233`, `docs/deployment.md:80`). Pick one, delete the others.
5. **Uptime + unhealthy-container recovery.** Both are doc suggestions only (`deploy/SETUP.md:574`,
   `~588`). `restart: unless-stopped` does not restart a container that is running but failing its
   healthcheck. An external check against `/health/ready` and either `autoheal` or a systemd timer.
6. **CI has no image scan and no compose validation.** `docker compose -f docker-compose.prod.yml config`
   and `bash -n scripts/*.sh` are seconds; Trivy on both images is a minute.
7. **Scaling, when it is time.** `docker compose up -d --scale api=2` behind nginx `upstream`, *after*
   Phase 3 moved throttler state out of process memory. Not PM2 — a supervisor inside a supervised
   container buys nothing here, and ep 16's lesson is already served by the orchestrator.
8. **Stale docs, which are a deploy hazard.** `docs/deployment.md:227-237` "Unverified" claims CD has
   never run and nginx never passed `nginx -t`, both falsified by `4d8b30e`; `:184-186` says to create a
   `production` environment while `cd.yml:142` uses `AAS`; `:130-141` says to add a host-key fingerprint
   that `cd.yml:154` already pins. `docs/REPO_CONTEXT.md:61` still documents CaslModule as live and omits
   `badminton` and `packages/badminton-calc` entirely; `badminton-splitter-spec.md` says "CASL-guarded"
   in five places. A runbook that lies about what is verified is worse than no runbook.

Exit: every container has a memory cap; `/api/auth/` is rate-limited at the proxy; one restore from
sidecar output into a scratch DB has actually been performed and dated; CI fails on a critical CVE in
either image; no doc contains a falsified verification claim.

---

## Phase 7 — Conditional and gated

### 7a. High-concurrency social patterns (ep 33, 34, 35) — only with the v2 reaction feature

The spec defers a per-player 👍/👎 on their court share that "does not affect the calculation"
(`badminton-splitter-spec.md:62-70`). If that ships, ep 34–35 apply almost directly: Redis counters with
a pipeline or Lua for the atomic toggle, idempotency per (user, target) — ep 34's trap is double-counting
under client retry — and a periodic flush to Postgres. Ep 33's feed fan-out has no analogue in this
product; skip it. Do not build the pattern before the feature.

### 7b. Microservices (ep 36–48) — gated

**Do not start this because the playlist does.** One VPS, one product surface, one developer: splitting
now buys distributed tracing, network partitions, and a saga in exchange for nothing. The gate opens
when at least one is true: a component needs independent scaling, two teams need independent deploy
cadence, or a workload needs a different runtime.

If it opens, the useful order — and note how much is already done in monolith form:

| Ep | Lesson | Already true here |
|---|---|---|
| 37 | Repo strategy for many services | `apps/*` monorepo + turbo already fits; one service per app |
| 36 | Carve by bounded context; TCP vs gRPC | First seam would be mail+queue (already isolated behind `MailService` and a Bull queue after Phase 3), never `users` |
| 46–48 | Gateway holds auth; delete the refresh token | Rotation, reuse-detection, grace window and revocation already exist (`auth.service.ts:266-341`); ep 48's "instant revocation" is Phase 3's jti denylist |
| 39 | One identity provider for many services | `AuthModule` is already the only issuer |
| 40–42 | MQ, fanout, saga with compensation | Phase 3's queue is the single-service version. There are no distributed transactions — compensations or nothing |
| 43 | A datastore per service | Postgres 16 for everything today; one DB per service and no cross-service joins if split |
| 38 | Etcd / k8s config | Only once a cluster exists to justify it |

Exit for a first extraction only: one service out, gateway auth intact, and a written path back to the
monolith.

---

## Sequencing

| # | Phase | Size | Gate |
|---|---|---|---|
| 1 | P0-A refresh-token log leak | 30 min | none — do it first |
| 2 | P0-B roles decision, P0-C dead code | ½–1 d | none |
| 3 | Phase 2 logging + correlation | 1–2 d | none |
| 4 | Phase 3 Redis: cache, ep-32 consistency, throttler, jti, mail queue | 4–6 d | needs Phase 2 to be observable |
| 5 | Phase 5 `pg_trgm` search | 1–2 d | independent; can run before Phase 3 |
| 6 | Phase 6 operational tail | 2–3 d | items 1–4 and 8 are independent of everything |
| 7 | Phase 4 files/upload | 3–5 d | when avatars or receipts become real |
| 8 | Phase 7a reactions | — | with the v2 feature |
| 9 | Phase 7b microservices | — | gated; probably never on this host |

Phase 6 item 8 (stale docs) and item 4 (`.env.prod.example`) are an hour and can be done at any point;
they are the cheapest risk reduction on this list.

## Also worth fixing, not phase-shaped

Small, real, and homeless — do them alongside whatever phase touches the same file:

- **M15, the known test gap** (`production-readiness-audit.md:202-207`, skipped by instruction). No spec
  exists for `RolesGuard`, `JwtAuthGuard`, `TransformInterceptor`, `HttpExceptionFilter`, `TokensService`,
  `BaseService`, or `UsersService`, and the one e2e file is stale scaffolding that jest never runs. If
  P0-B option (a) is chosen, the guard test stops being optional.
- **`TransformInterceptor` reads metadata handler-only** (`transform.interceptor.ts:32-35`), so a
  class-level `@ResponseMessage` is silently ignored. Use `getAllAndOverride` like `JwtAuthGuard` does.
- **`EMAIL_USER` / `EMAIL_PASS` are read by `configuration.ts:38-39` but absent from the zod schema**
  (`env.validation.ts`), so the one thing that validation exists to prevent — booting with a missing
  credential — is still possible for mail.
- **`JwtStrategy` reads `configuration()` directly** rather than `ConfigService` (`jwt.strategy.ts:13`),
  bypassing the validated/cached config object.
- **Watch-list items already logged** at `hardening-log.md:158`: `signJwt(payload: any)` with no runtime
  payload validation, TypeORM relations typed `!` but undefined-unless-joined, `test/` excluded from
  typecheck. Unchanged since.

## Working agreement per phase

Each phase gets a spec in `docs/superpowers/specs/YYYY-MM-DD-<slug>-design.md` and a plan in
`docs/superpowers/plans/YYYY-MM-DD-<slug>.md`, following the conventions those directories already
establish: the agentic-worker blockquote, `**Goal:** / **Architecture:** / **Tech Stack:**`,
`## Global Constraints` (including **NO GIT COMMITS**), then `### Task N` blocks each with `**Files:**`
(`Create:`/`Modify:`/`Delete:`), `**Interfaces:**` (`Consumes:`/`Produces:` with exact signatures),
`- [ ] **Step N:**` checkboxes holding full intended file contents, and `Run:` / `Expected:` pairs for
every command. Tests follow the unit-with-hand-rolled-doubles pattern from `72f976e`. When a module
lands, update `docs/REPO_CONTEXT.md` — which is currently two features and one deletion behind.
