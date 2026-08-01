# Production-Hardening Log

Every change made during the production-readiness effort (2026-07-25 → 2026-08-01), in the
order it landed: **what** was done, **where** it lives, **why** it matters, and what it
fixed. Source of truth for line-level detail is the commit trail on `feat/badminton-split`;
this file is the narrative index over it.

Audit basis: [production-readiness-audit.md](./production-readiness-audit.md) (C=critical,
H=high, M=medium, L=low). Container-run findings: [docker-and-env.md](./docker-and-env.md).

---

## Stage 1 — Security quick wins

| What | Where | Why |
|---|---|---|
| Boot-time env validation (zod) | `apps/api/src/common/config/env.validation.ts` | The app used to boot with `JWT_SECRET=undefined` and sign forgeable tokens. Now a missing/malformed variable crashes startup **naming the offender** — including the seconds-vs-`"15m"` trap, the >1-year "you passed milliseconds" trap, half-configured OAuth providers, and the `REFRESH_EXPIRES_IN` vs `JWT_REFRESH_EXPIRES_IN` rename that had silently ignored the user's real config. (C2) |
| Throttling actually enforced | `app.module.ts` (`APP_GUARD`), `auth.controller.ts` (`@Throttle`) | `ThrottlerModule` was registered but **no guard was bound** — login brute-force was unlimited. Now global 10/min plus 5/min on login/signup/reset, 3/min on outbound email, 20/min on refresh. (C4) |
| Swagger off in production | `main.ts` | The full API schema (every route, DTO, auth flow) was served to anonymous callers — free reconnaissance. (H4) |
| CORS allowlist | `main.ts` | `enableCors()` reflected any origin **with credentials** — any site could read authenticated responses. Now an explicit `FRONTEND_URL` allowlist, and env validation makes that variable mandatory in production. (H5) |
| Error detail withheld in prod | `common/filter/http-exception.filter.ts` | 500s shipped raw driver internals (SQL text, constraint names). Production now returns a `traceId` and logs the detail server-side, tied together by that id. (M5) |
| helmet once, before Swagger | `main.ts` | Was applied twice, ordered after Swagger, and per-route logic skipped GETs. (M6) |

## Stage 2 — RBAC: fixed by deletion

| What | Where | Why |
|---|---|---|
| CASL removed entirely (−176 LOC), basic RBAC kept | `apps/api/src` (former `casl/`), `common/guard/roles.guard.ts` | The CASL layer was **dead and unsafe at once**: a `resource` vs `subject` column mismatch meant every rule compiled to `subject: undefined`, so every `@CheckPolicies` route denied — and fixing that would have silently turned "read your own" into "read all", because conditions were never evaluated against loaded objects. For an app this size, role names + service-level ownership checks (`ownerId` filters that already existed) are the honest model. Plan first (`docs/casl-removal-plan.md`), then executed. (C1, H3) |
| Default-deny auth | `app.module.ts` (`JwtAuthGuard` as `APP_GUARD`), `@Public()` opt-outs | Auth used to be opt-in per controller — forget a decorator, ship an open route. Now every route requires a JWT unless explicitly `@Public()`, and the OAuth legs are marked public because a login flow cannot require a login. (H2) |

## Stage 3 — Shippable

| What | Where | Why |
|---|---|---|
| Migration tooling repaired | `apps/api/src/common/config/data-source.ts`, `package.json` scripts | The CLI pointed at a directory that didn't exist and loaded no env — it tried localhost as the OS user. Now `dotenv` + `__dirname`-relative `{ts,js}` globs, so it works both via ts-node locally and compiled inside the image (a `src/**/*.ts` glob would have found **zero** migrations in the container and reported success). (C3) |
| Production Dockerfiles | `apps/api/Dockerfile`, `apps/web/Dockerfile` | Multi-stage on the user's `turbo prune --docker` pattern. Six bugs fixed vs the old draft, worst two: wrong prune scope (`api` → `@app/api`, instant failure) and a glibc-builder/musl-runner split that built clean and **crashed on first login** because bcrypt is a native module. (C5) |
| Prod compose + Caddy TLS | `docker-compose.prod.yml`, `Caddyfile` | Postgres unpublished, only the proxy exposed; one-shot `migrate` service gates the API on `service_completed_successfully` so the app never starts against an un-migrated schema; Caddy gets automatic Let's Encrypt. (C5) |
| Graceful shutdown | `main.ts` `enableShutdownHooks()` | `docker stop` was hard-killing in-flight requests and the DB pool. (H6) |
| Health split: liveness vs readiness | `app.controller.ts` | `/health` never touches the DB (Docker restarts on exit; a restart can't fix a DB outage — tying them together creates restart loops). `/health/ready` does `SELECT 1` and 503s. Replaced a static `'OK'` that made broken instances look healthy. (M9; see task #6 for the sequel) |
| Backup script with restore test | `scripts/backup-db.sh` | `pg_dump -Fc` + retention + `--verify-latest`, which restores the newest dump into a scratch DB and counts tables — "a backup you have never restored is a hypothesis". (H8, first half) |

## Stage 4 — Pipeline

| What | Where | Why |
|---|---|---|
| `check-types` made real | all four workspaces' `package.json` | `turbo run check-types` had covered **only** `packages/badminton-calc` — web named the script differently, api had none. Fixing the name immediately surfaced 6 real type errors. (H9) |
| CI workflow | `.github/workflows/ci.yml` | Required gates: check-types + lint + build + test, plus a docker-build job. Web lint began as an explicitly-labelled non-blocking job (~300-error backlog) rather than a silent `fail-on-error:false` — the deal being it becomes required once burned down (kept: see task #7). (H9) |
| Dependency hygiene | `apps/web/package.json`, root | Phantom `@tanstack/react-query` declared; `nitro`/`vite-plus`/`@nestjs/mapped-types` pinned off `latest`/`*`. (M11, M12) |
| Two real bugs found by the cleanup | `auth.controller.ts`, `auth.service.spec.ts` | Refresh with no cookie threw a bare `Error` → **500** instead of 401 (client couldn't tell it just needed to log in). A test mock supplied ms where the code expects seconds — sessions "expiring" in 2045; production code was right, the spec was wrong, and the >1-year env-validator bound now catches the real-world version of that mistake. |

## Stage 5 — Auth hardening + response contracts (`64a60e0`)

| What | Where | Why |
|---|---|---|
| Refresh tokens hashed + rotated + replay-detected | `auth/entities/session.entity.ts`, `auth/services/auth.service.ts`, `tokens.service.ts` | Tokens were stored **plaintext** and never rotated. Now: sha256 at rest (indexable, and a 256-bit JWT needs no slow hash), rotation retires the old row and inserts the new one in a transaction, and a spent token presented outside a 10s grace window revokes **every** session — inside the window it's read as a lost race between browser tabs, not theft. `jti` added because HS256 is deterministic: two logins in the same second minted byte-identical tokens. New tokens inherit the original expiry (no sliding window for stolen tokens); expired rows are pruned in the same transaction. (M2) |
| Current-password proof on change | `auth.controller.ts`, `change-password.dto.ts` | With the access token in localStorage, one XSS was a full account takeover. Knowing the current password is the second factor; every other session is revoked on success. Also fixed en route: the endpoint was **500ing on every call** (`select:false` password column fed `undefined` to bcrypt). (M4) |
| Anti-enumeration, including timing | `auth.service.ts`, `users.service.ts` | Signup and reset answered differently for existing addresses — a membership oracle. Messages are now identical **and** a throwaway bcrypt hash is compared when the user doesn't exist, because <1ms vs ~300ms is an oracle no message-wording fixes. (M3) |
| OAuth CSRF `state` | `common/guard/oauth-state.ts` (+ 3 guards), 9 tests | Double-submit cookie, timing-safe compare, single-use, `sameSite:lax` (strict would withhold the cookie on the provider's cross-site redirect back). Chosen over passport's `state:true`, which requires express-session. Library behaviour verified in `passport-oauth2` source, not assumed. (M1) |
| Password policy | `auth/dto/password.constraints.ts`, DTOs, web mirror | 8-char min (OWASP), bcrypt cost 12, 72-byte max (bcrypt truncates silently past it). Login DTOs deliberately keep **no** composition rules — enforcing the new floor on submitted passwords would lock out accounts created under the old rule. Double-hash guard added on the entity. (L1) |
| Response validation at the web boundary | `apps/web/src/lib/utils/parse-response.ts`, `services/badminton/*` | `http.get<T>() as Promise<T>` was an assertion, not a check. zod schemas are now both the type and the runtime check; converting the hand-written interfaces exposed three live mismatches: the list endpoint never sent fields its type promised, a jsonb sub-projection that could crash the list page, and a suggest query that never selected the email it used as a fallback label. Also: empty suggest query matched the whole user table — now a 2-char server-side minimum. (M14, badminton half) |
| Secrets as mounted files | `common/config/file-secrets.ts`, compose `secrets:`, `secrets/README.md` | Env vars leak into `docker inspect`, `/proc/<pid>/environ`, and child processes; files don't. `*_FILE` convention matches the official Postgres image; explicit allowlist so a random `FOO_FILE` is never treated as a path. (M10) |
| DB SSL/pool, synchronize refusal, body limit, `@ResponseMessage` | `database.ts`, `env.validation.ts`, `main.ts`, `transform.interceptor.ts` | Env-driven TLS with `rejectUnauthorized` as a **separate deliberate switch**; `DATABASE_SYNCHRONIZE=true` refused in production (it can drop columns with no migration to revert); explicit 100kb body limit (required `bodyParser:false` — express skips an already-parsed body, so a later `app.use` limit is decoration); envelope messages moved to a decorator so a resource's own `message` field is never silently deleted. (M7, L2, L3, L6) |

## First real container run (`222148a`) — six bugs only runtime could show

| What | Where | Why |
|---|---|---|
| Initial migration, self-contained | `apps/api/src/database/migrations/1785518575724-init.ts` | Generated on a scratch DB (dev's `synchronize` would have produced an empty diff), then verified apply→revert→re-apply. Made self-contained by hand: every PK defaults to `uuid_generate_v4()` and TypeORM's driver had been installing `uuid-ossp` itself on connect — invisible in migration history and **impossible on managed Postgres** where the app role can't `CREATE EXTENSION`. `installExtensions:false` keeps schema changes inside migrations. (C3 completed) |
| Three phantom dependencies declared | `packages/*/package.json`, `apps/api/package.json` | `@repo/typescript-config` (extended by two packages, declared by nobody), `@types/react`, `dotenv` — all resolved on the host via hoisting, all missing from `turbo prune`'s output, all fatal inside the image. |
| CA bundle for the web builder | `apps/web/Dockerfile` | vite-plus's Rust binary initialises an HTTP client before doing anything; `node:24-slim` ships no CA store → instant panic. Node has its own CAs, which is why nothing else ever noticed. |
| API image 1.44GB → 726MB | `apps/api/Dockerfile` | The runner copied the builder's whole tree — jest, Nest CLI, eslint all shipped to production as attack surface. Now a fresh `--omit=dev` install (which also required `husky \|\| true` in root `prepare`, and broke the migration job's hoisting-dependent absolute path → `npm run migration:run:prod`). |
| Secret trailing-CR bug | `common/config/file-secrets.ts` + `file-secrets.spec.ts` (10 tests) | Git-Bash `openssl` writes CRLF; the reader stripped `\r?\n` but not a bare `\r`, while the Postgres image strips all — so the DB was initialised with one password and the API sent another, with nothing visible on either side. Rule extracted: **being less forgiving than the other reader of the same file is the bug.** |
| `resolveFileSecrets` moved to import time | `app.module.ts` | `ConfigModule.forRoot` runs `validate` during the **import** of the module — before `bootstrap()`'s first statement — so the bootstrap-time call ran too late and the container crash-looped with the secret correctly mounted. |
| `/health/ready` was killing the process | `app.controller.ts`, `http-exception.filter.ts` | Its `@Res()` form returned the Express `Response` as the handler value → `ClassSerializerInterceptor` tried to serialise it → the filter wrote a 500 onto an already-sent response → `ERR_INTERNAL_ASSERTION`, process dead — **on every 15s healthcheck poll**. Its unit tests passed throughout because the mocked `res` bypassed the real serializer. Fixed the endpoint (plain object / thrown 503) and the filter (bails on `headersSent`, so no future route can take the API down this way). Verified live: full stack healthy, 0 restarts, login 400 / refresh 401. |

## Web lint burn-down (`50307e1`) — 319 problems → 0 errors, now a required gate

| What | Where | Why |
|---|---|---|
| 1 fatal + 262 autofix + 35 by hand, zero `eslint-disable` added | `apps/web/**` | Real bugs among them: `StatefulButton` cancelled its own spinner on the frame it appeared (boolean compared `!== undefined`); `input-otp` optional-chained the wrong operand and threw the exact TypeError it looked like it prevented; `HttpClient`'s singleton type lied about initialization; an uncaught clipboard rejection; four submit handlers shadowing `form` two lines above it. |
| turbo cache fix | `turbo.json` | Web builds to `.output/`, turbo cached `dist/**` — a "FULL TURBO" hit restored **nothing**, leaving stale or absent output. |
| CI gate flipped | `.github/workflows/ci.yml` | `lint-web-backlog` deleted; web lint is now blocking, which was the stated deal when the non-blocking job was introduced. |

## API strict mode + rxjs dedupe + passport types (`eeec70c`)

| What | Where | Why |
|---|---|---|
| `strict: true`, no sub-flag left off (94 errors → 0) | `apps/api/tsconfig.json` + 32 files | The backend — auth, sessions, DB — was the *less* type-checked half of the repo. Measured per flag: `noImplicitAny` 24, `strictPropertyInitialization` 70, rest 0. `!` vs `?` on entities now encodes NOT NULL vs nullable at a glance. |
| **OAuth account takeover** found by typing `req` | `auth.service.ts` (`oauthAccess`) | `email` was typed `string` but OAuth profiles legitimately omit it (Facebook-by-phone, GitHub private email). `undefined` flowed into `findOne({email})` and TypeORM **drops undefined conditions** — `SELECT … LIMIT 1` matched an arbitrary user and minted *their* tokens for whoever completed the flow. Now a 400 before the lookup; strategies also stopped throwing on `profile.emails[0]`. The single highest-value find of the effort. |
| Passwordless-account 500s + oracle | `changePassword`, `resetPasswordWithToken` | `User.password` typed `string` on a nullable column — OAuth-only accounts 500ed on both endpoints, and the 500 itself leaked "this account has no password". Both now take the normal failure path. |
| rxjs: 5 copies → 1 | root `package.json` `overrides`, `apps/api/tsconfig.json` | `@angular-devkit/*` pins `=7.8.1`, workspace resolved `7.8.2` — two structurally distinct `Observable` types; the old `paths` hack forced the compiler onto one while the runtime loaded both. Exact-pin override (`^` provably does not collapse the tree — measured) leaves one copy; hack deleted. (M13, L5) |
| Real `@types` for passport | `apps/api/package.json`, `strategy/google.strategy.ts` | The 139-line hand-written shim replaced; `passport-google-oauth` swapped for a direct dep on `passport-google-oauth20` — the wrapper only re-exported that class, and its stale types described a pre-2.0 API. (H11) |

## Production-dep vulnerabilities (`7f245e5`)

| What | Where | Why |
|---|---|---|
| 3 of 7 fixed; the rest documented, not faked | root `package.json`, lockfile | `@hono/node-server`, `@modelcontextprotocol/sdk`, `fast-uri` updated cleanly. `js-yaml` under swagger: npm's overrides are **not honored** in this workspaces tree (three forms tried; one produced a resolution that satisfied *no* declared range — a lying lockfile is worse than a flagged one) → reverted, waiting on `@nestjs/swagger`; the endpoint is prod-disabled anyway. `brace-expansion`: no fixed release exists in majors 1–4, and 5.x changed its CJS export shape (verified by loading both) so a forced override breaks every `minimatch` at runtime. Every reachable consumer expands compile-time constants, not user input. |

## react-email out of production (`cb66058`)

| What | Where | Why |
|---|---|---|
| Imports → `@react-email/components`; `react-email` → devDep | `packages/transactional/*` | `react-email` bundles the CLI **and a Next.js preview server** — `next` was shipping inside a 726MB API image that never serves React. |
| Render-diff verification, regressions fixed | `emails/_components/layout.tsx` | The swap was **not** output-neutral: the published 1.0.12 is ~2 months older than the code react-email bundles (no dist-tag carries it). It dropped `lang`/`dir` from `<body>` (restored explicitly; they inherit) and moved Container padding onto the `<table>` — which **Outlook's Word engine ignores** (restored onto a real `<td>` via Row/Column, after reading 1.0.12's source to confirm where props land). Method: render both templates before/after with fixed props and diff the HTML — email regressions are invisible until a user gets a broken message. |
| Collateral win | — | Losing react-email's tree also removed the whole `brace-expansion → glob → minimatch → typeorm` audit chain: prod audit went 6 → 2, both remaining items unreachable in production. |

## Log caps for real (`34477ba`)

| What | Where | Why |
|---|---|---|
| `x-logging` anchor actually referenced | `docker-compose.prod.yml` (all 5 services) | The anchor was defined at the bottom of the file and referenced by nothing — and YAML aliases can only point backwards, so even a reference wouldn't have resolved. Every container ran with unbounded json-file logs: on a single VPS, a full disk on a timer. Found while answering "what's left?", which is exactly what re-audits are for. |

## H8 second half — backup sidecar (this round)

| What | Where | Why |
|---|---|---|
| Scheduled dump ships with the stack | `docker-compose.prod.yml` (`backup` service) | The script's host-cron approach exists only if the operator remembers it; a sidecar cannot be forgotten. Same `postgres:16-alpine` image (pg_dump major always matches the server), password from the mounted secret (CR/LF-stripped), dump → `.part` → size check → rename so a half-written dump can never look real, retention pruning, first dump at startup so a fresh deploy gets a baseline immediately. `$$`-escaped for compose interpolation; loop syntax-checked with `sh -n`; rendered config verified. |
| Offsite + verify remain the script's job | `scripts/backup-db.sh` (header rewritten) | A dump on the same disk as the database does not survive the failure it exists for — `BACKUP_REMOTE`/rclone hook plus `--verify-latest` stay host-side, documented as the required second leg. |

## H1 defense-in-depth — CSP at the proxy (this round)

| What | Where | Why |
|---|---|---|
| Content-Security-Policy + frame denial | `Caddyfile` (web block) | With the access token moving to JS memory (below), the CSP's `connect-src 'self' https://API_DOMAIN` means an injected script can't ship the token anywhere else even if injection succeeds; `object-src 'none'`, `base-uri`, `form-action`, `frame-ancestors 'none'` close the non-script routes. `script-src` keeps `'unsafe-inline'` because the SSR framework hydrates via inline scripts — the honest upgrade path is nonce-based CSP at the framework level, not deleting the keyword and breaking every page. *Caddy-validate pending: Docker daemon down at edit time.* |

## Hook + promise lint, unchecked index (`a5944a8`)

| What | Where | Why |
|---|---|---|
| `eslint-plugin-react-hooks` (both rules as errors) | `apps/web/eslint.config.js` | The React app had **zero** hook linting. Immediate payoff: a real stale-closure bug in `calendar.tsx` — after switching to the years view, both nav buttons still captured `navView === "days"` and paged months instead of year ranges. One narrow, pre-justified disable in the whole app. |
| `no-floating-promises` + `no-misused-promises` | `apps/web/eslint.config.js`, 39 sites | One real bug: the stateful button floated `onClick?.(event)`, so async handlers' rejections were **silently dropped and `onError` never fired**, contradicting its own JSDoc. The other 38: deliberate fire-and-forget sites now explicitly `void` with inline rationale — intent made visible instead of accidental. |
| `noUncheckedIndexedAccess` everywhere | `apps/web/tsconfig.json`, `packages/badminton-calc/src/index.ts` | The planned calc-package opt-out **could not work**: the package exports types from `./src`, so web's `tsc` compiles the calc source under web's flags. The 9 sites were fixed by zipping the parallel arrays into per-player records — zero `!`, zero fallback values, float ops in identical order, verified against the API's calc snapshot suite (financial math; values must not move). |
| Dead scaffold removed | `custom/data/select.tsx` (deleted) | Nothing imported it; four `SelectItem`s shared `value="1"` — a real defect had it ever shipped. |

## H1 — access token out of localStorage (this round)

| What | Where | Why |
|---|---|---|
| Token in module memory only | `apps/web/src/lib/utils/access-token.ts` (new), `http.ts`, `services/auth/queries.ts` | localStorage is readable by any XSS with one synchronous call, from any tab, any time later. Module memory narrows that to "code running in this document, while it runs" — and the CSP's `connect-src` (above) means even that code has nowhere to send it. The last unresolved High from the audit. |
| Rehydration = the existing interceptor | `http.ts` | No boot ceremony: after a reload memory is empty, the first protected call 401s, and the already-shared-in-flight refresh exchange (httpOnly cookie → new token → retry original request) rehydrates it. The refresh cookie is the durable credential; the in-memory token is a 15-minute convenience. |
| Legacy purge | `access-token.ts` module load | Users who logged in before this change still had a token **sitting** in localStorage; "no longer read" is not "gone". Purged once on load. |
| Bonus dead bug removed | `services/auth/queries.ts` | The signup mutation stored its **void** response under the token key — never a token, always `undefined`. Deleted with a comment explaining why signup deliberately has no success handler. |
| **Follow-up: SSR safety** | `lib/utils/local-storage.ts`, `lib/utils/access-token.ts` | The first cut called `storage.remove()` at module load, which the app also evaluates **on the server**, where `localStorage` does not exist — `ReferenceError` logged on every SSR module load. Reported from a running dev server, not caught by typecheck, lint or any test, because none of them render on a server. Two fixes: `storage` no-ops when there is no `window` (a no-op is the honest server behaviour; the try/catch stays for real failures like quota or Safari private mode), and — the more important half — **the token store now refuses to hold a value on the server at all.** A module-scope variable is shared by every concurrent SSR request, so one visitor's token would be handed to the next visitor's render. Nothing does that today (no route uses `loader`/`beforeLoad`/`createServerFn`), but the day someone adds a server-side authenticated fetch, the failure would be a silent cross-user token leak. Reads return undefined server-side, writes warn and drop. Verified by rendering three routes against a real dev server: 200s, zero SSR errors. |

## M14 remainder — auth responses parsed (this round)

| What | Where | Why |
|---|---|---|
| `login`/`refresh` responses zod-parsed | `services/auth/api.ts` | The old `{ accessToken: string } \| string` union plus a `typeof` coin-flip wasn't a contract — it was two guesses. `AccessTokenSchema` + `parseResponse` means drift fails loudly at the boundary instead of handing a garbage "token" to the `Authorization` header. Completes M14: every data-returning endpoint in the web app is now schema-checked. |

---

## Standing decisions and watch-list

- **Dev keeps `synchronize`** (guarded): flipping dev to migrations would break existing dev volumes (`migration:run` against an already-synced schema fails on existing objects). Production refuses it at boot; that is the load-bearing half. (L2)
- **M15 (real auth test suite) skipped by explicit instruction** — though ~35 targeted tests landed anyway where they verified new security controls (rotation/replay, OAuth state, file secrets, health).
- **Watch:** `@nestjs/swagger` release (unpins `js-yaml`), `brace-expansion` upstream fix lines, TypeORM relation properties typed `!` but undefined-unless-joined (documented type lie), `signJwt(payload: any)` — decoded JWT payloads are not runtime-validated, `test/` excluded from typecheck.
- **Docker-dependent tail:** rebuild images (expect well under 726MB post-react-email), `caddy validate` the new CSP block, run the backup sidecar once and `--verify-latest` against its output, and click through login → reload → auto-refresh in a served build to confirm the in-memory token flow end-to-end (the interceptor logic is unchanged — only its store moved — but browser-level verification is the standard this log holds everything else to).
