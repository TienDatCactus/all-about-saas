# Removal plan — drop CASL, keep ownership + a coarse role check

**Decision:** remove the CASL/permission layer; replace it with a globally-bound
`JwtAuthGuard` plus service-level ownership scoping (what badminton already
does), and an optional `@Roles('admin')` guard for admin surfaces.

**Do it before Stage 3.** Zero migrations are committed today
(`src/database/migrations/` is empty). Delete now and the `permission` /
`resource_registry` tables never enter the schema. Generate the initial
migration first and removing them later costs a destructive migration on a live
database. This is the cheapest this decision will ever be.

Dated 2026-07-31. Supersedes audit items **C1** and **H3**.

---

## Why — the evidence

| Claim | Evidence |
|---|---|
| CASL has never evaluated a single rule | Nothing seeds roles or permissions anywhere in the repo; the `permission` table is empty in every environment |
| It was fully dead until today | `ability.factory.ts` built rules from `perm.resource`; the column is `perm.subject`, so every rule had `subject: undefined` and every `@CheckPolicies` route denied |
| It guards almost nothing | 4 active `@CheckPolicies`, all `read` (users ×2, roles ×2). 3 more are commented out and were never enabled |
| The real feature never used it | Badminton authorizes with `where: { id, ownerId }` in the service |
| **H3 is already gone** | `PATCH /roles/:id/permissions` no longer exists. `roles.controller.ts` is two GETs; `roles.service.ts` is a bare `BaseService` |
| Half of it is dead code | `ResourceDiscoveryService` is never provided in any module, and its `syncResources()` only `console.log`s. `ResourceRegistry` is never read |
| No frontend impact | `apps/web` never calls `/roles` or `/users` |
| Nothing else needs `role.permissions` | `user.role` is referenced nowhere outside RBAC; a `@Roles()` decorator already exists (unused) at `common/decorator/roles.decorator.ts` |

Cost of keeping it: 483 LOC across 10 files — and its *natural* usage is unsafe.
Making it safe required a guard that fails closed plus helpers that refuse to
translate conditions, because `ability.can(action, 'User')` on a bare string
returns `true` for a permission meaning "your own user" (BOLA, OWASP API #1).

---

## Two problems found while mapping routes (neither is in the audit)

### P1 — `POST /mail/try` is completely unauthenticated 🔴
`mail.controller.ts` has **no `@UseGuards`, no `@Public()`**, and there is no
global guard. Anyone on the internet can POST it and make the server send mail.
It is a fixed-recipient test endpoint (`multivncraft@gmail.com`, `welcome`
template).

**Fix:** delete the endpoint. If a manual mail test is wanted, make it
non-production-only *and* authenticated. Binding the global guard (below) closes
it either way — this is the single strongest argument for doing H2 first.

### P2 — binding the global guard breaks three OAuth routes ⚠️
`@Public()` is applied inconsistently. These lack it and would start requiring a
JWT — which is impossible for a login flow:

- `GET /auth/github/callback`
- `GET /auth/facebook`
- `GET /auth/facebook/callback`

(`/auth/google`, `/auth/google/callback`, `/auth/github` already have it.)

**Fix:** add `@Public()` to all three **before** binding the guard, or OAuth
login breaks the moment H2 lands.

---

## Inventory

### Delete
| Path | Note |
|---|---|
| `src/casl/ability.factory.ts` | |
| `src/casl/ability.factory.spec.ts` | written today; its insight moves to badminton ownership tests |
| `src/casl/ability.helpers.ts` | written today |
| `src/casl/policy-parser.ts` | `JSON.stringify` → regex → `JSON.parse` templating |
| `src/casl/casl.module.ts` | |
| `src/casl/entities/permission.entity.ts` | table never populated |
| `src/casl/entities/resource-registry.entity.ts` | never read |
| `src/casl/services/resource-discovery.service.ts` | never wired; only `console.log`s |
| `src/common/guard/policies.guard.ts` | |
| `src/common/decorator/check-policies.decorator.ts` | |
| `src/common/decorator/resource.decorator.ts` | metadata never consumed after the above goes |
| `src/mail/mail.controller.ts` | P1 — plus `MailModule` controller registration |
| `@casl/ability` dependency | `apps/api/package.json` |

### Modify
| Path | Change |
|---|---|
| `src/app.module.ts` | drop `CaslModule`; bind `JwtAuthGuard` as `APP_GUARD` (H2) |
| `src/auth/auth.controller.ts` | `@Public()` on the three OAuth routes (P2) |
| `src/roles/entities/role.entity.ts` | drop the `permissions` relation; keep `name` |
| `src/roles/roles.module.ts` | drop `Permission` from `forFeature` |
| `src/roles/roles.controller.ts` | `@CheckPolicies` → `@Roles('admin')`, drop `PoliciesGuard` |
| `src/users/users.controller.ts` | see open question below; keep the 404-not-403 behaviour |
| `src/badminton/badminton.controller.ts` | drop `PoliciesGuard` from 3 routes; delete 3 commented `@CheckPolicies` |
| `src/common/guard/roles.guard.ts` | **new**, ~20 lines, reads `user.role.name` |

### Keep
- `Role` entity (`name` only) and `RolesModule` — feeds `@Roles('admin')`
- `common/decorator/roles.decorator.ts` — already exists, finally used
- `JwtAuthGuard`, `@Public()` — these become the whole authentication story
- Badminton's service-level `ownerId` scoping — now the documented convention

### Zero-risk detail
Badminton's `GET/PATCH/DELETE /sessions/:id` list `PoliciesGuard` but carry **no
`@CheckPolicies`**, and the guard returns `true` when no handlers are present.
Removing it from those three routes is a **no-op**.

---

## Ordered steps

Sequenced so the build and dev loop never break.

1. **`@Public()` on the three OAuth routes** (P2). Must precede step 3.
2. **Delete `/mail/try`** and its controller registration (P1).
3. **Bind `JwtAuthGuard` globally** as `APP_GUARD` (H2). This is the actual
   security win of Stage 2 and is independent of CASL.
   *Verify here before continuing:* login → protected route → OAuth start.
4. **Add `RolesGuard`** + switch `roles.controller` to `@Roles('admin')`.
5. **Resolve the users routes** (open question below).
6. **Strip `PoliciesGuard` / `@CheckPolicies`** from badminton and any remaining
   controller; delete the commented-out policy lines.
7. **Delete the CASL files** and drop `CaslModule` from `app.module`.
8. **Drop `Role.permissions`** and `Permission` from `roles.module` `forFeature`.
9. **Remove `@casl/ability`** from `apps/api/package.json`; reinstall.
10. **Document the convention** — ownership belongs in the service query
    (`where: { id, ownerId }`), never in a guard.

`autoLoadEntities: true` means deleting the entity files is enough to keep the
tables out of the generated schema; no migration needed because none exist yet.

---

## Open question — what authorizes `/users`?

`GET /users` and `GET /users/:id` currently deny everything (no permissions
seeded ⇒ fail closed). After removal they need an explicit rule. Pick one:

- **A — admin-only.** `@Roles('admin')` on both. Keeps a user-management
  surface. Requires an `admin` role to exist (nothing seeds one today).
- **B — self-only.** Replace both with `GET /users/me` reading `req.user.id`;
  delete the list route. Smallest surface, matches an app whose only real
  resource is owner-scoped.

**Recommendation: B.** There is no admin UI, nothing seeds an admin role, and
the frontend never calls these routes. A is one decorator away whenever an admin
screen actually appears.

---

## Verification

Per step, not just at the end:

- `npx tsc --noEmit` clean (baseline: only the pre-existing
  `app.controller.spec.ts` `getHello` error)
- `npx jest` — badminton (19) and env validation (11) must stay green
- **New ownership tests** replacing the deleted CASL specs: a session owned by
  another user must 404 on read/update/delete
- **Runtime, with Postgres up:** login → `GET /badminton/sessions` 200 → another
  owner's session 404 → OAuth start redirects (not 401) → `POST /mail/try` 404
- Confirm no route is left unguarded: re-run the route/guard inventory and check
  every route is either `@Public()` or covered by the global guard

## Rollback

Steps 1–3 are independent and worth keeping regardless. Steps 7–9 are the
irreversible-ish part; they are a single commit and `git revert`-able. No
database change is involved, because the tables being removed were never
created by a migration and were never populated.

## Out of scope

- **M2** refresh-token rotation/hashing, **M4** current-password proof — real,
  unrelated to CASL, tracked in Stage 5
- Multi-user shared sessions. If that arrives, a `session_member` table with a
  role column covers it; it does not require a rules engine
