# Badminton Money Splitter — Spec (v2)

Status: **Draft, ready to build.** Derived from an interview on 2026-07-25,
revised 2026-08-25 (v2: hours + weight-class split, discount removed) and
2026-08-26 (v2.1: shuttleWeight scale + default).
Owner: dtran. Lives in the `all-about-saas` monorepo.

## Changelog

- **v2 (2026-08-25):** The v1 model asked the organizer to type a raw 0..1
  "fraction" for court and shuttle share, and a discount fraction — all three
  by instinct, with no defined way to derive the number. Replaced with:
  court split by raw hours played, shuttle split by a weight-class (default
  6 for nam / 4 for nữ, editable), and discount removed outright. See §3-§5
  and §7, updated in place below; §4's TypeORM sketch and §5's algorithm are
  the current canonical versions.
- **v2.1 (2026-08-26):** `shuttleWeight` is explicitly a 0-10 scale (10 = 100%;
  nam = 6 = 60%, nữ = 4 = 40%), capped at 10, and its default (before any
  gender is picked) is 6 — the nam-equivalent, not a neutral value — since
  most sessions are majority-male and only nữ participants (the minority
  case) need the value touched.

---

## 1. Goal

Let an organizer enter one badminton session's costs and attendees, and get a
per-person split that **always reconciles to the real expense**, with a
copy-to-clipboard summary and a public read-only link so anyone can verify the math.

This is **not** a greenfield toy. It ships as a module inside the existing SaaS
scaffold, reusing the current auth, users, and CASL layers.

---

## 2. Stack reality (important)

The original base plan named Next.js / React Hook Form / Prisma / SQLite. **The repo
uses none of those.** Build against what's actually here:

| Concern       | Use                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| Web app       | `apps/web` — **TanStack Start** (Vite + Nitro SSR), `@tanstack/react-router`                           |
| Forms         | **`@tanstack/react-form`** + **Zod v4**                                                                |
| UI            | shadcn v4 on Base UI + Radix, Tailwind v4, `sonner` toasts                                             |
| Summary table | Plain shadcn `<Table>` for v1 (an 8-row table doesn't need TanStack Table; skip the dep)               |
| API           | `apps/api` — **NestJS 11 + TypeORM 0.3 + PostgreSQL**                                                  |
| Auth / RBAC   | Reuse existing JWT/SSO auth, `users`, and **CASL**                                                     |
| Shared calc   | New workspace package `packages/badminton-calc` — one pure implementation imported by BOTH web and api |

The shared calc package is the key architectural call: the split algorithm must
produce identical numbers on the client (instant preview) and the server (canonical
snapshot for the share link). One source of truth prevents drift.

---

## 3. Locked decisions (from interview)

| Area             | Decision                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| Scope            | **Full integrated**: Nest API module + Postgres persistence, tied to existing users/CASL                       |
| Court fee        | **Time-proportional** via each player's raw hours played (`hoursPlayed`, default 1) — not a %, a stable per-person fact that stays correct as the roster changes |
| Shuttle cost     | **Unit price × count** → total shuttle cost is _derived_, not typed                                            |
| Shuttle split    | **Weight-proportional** via each player's `shuttleWeight`, a 0-10 scale (10 = 100%; nam = 6 = 60%, nữ = 4 = 40%), max 10; defaults to 6 (nam-equivalent) before any `gender` pick, since only the nữ (minority) case needs touching; editable per player |
| Discount         | **Removed in v2.** No discount input anywhere; collected == expense always, no redistribution step. |
| Rounding         | Round each share to **nearest 1,000 VND**, distribute leftover by **largest-remainder**                        |
| Player identity  | Participant is **either a linked app user (`userId`) or a free-text name**; UI resolves via autocomplete       |
| History/stats    | Key off `userId` when linked; free-text names are ephemeral. **All analytics deferred** past v1                |
| Guests           | Free-text names are the guest path (quick-add, no account needed)                                              |
| Access           | **Login required to create/edit**; **public unguessable read-only link** to view/verify                        |
| Settlement       | **Calc + copy only** in v1 — no paid/unpaid tracking, no bank QR                                               |
| Locale           | **VND**, English UI, Vietnamese number formatting (`150.000`)                                                  |

### Explicitly deferred (design so they drop in later, don't build now)

Saved analytics dashboard (total spent per player, avg/session, games played) ·
paid/unpaid settlement · VietQR generation · Excel/PDF export · dark mode polish ·
i18n / Vietnamese UI · reusable player roster with default hours/weight-class per person.

### v2 idea — court-fee "satisfaction" reaction (optional)

A lightweight per-player reaction on their computed **court** share so the group can
signal agreement before settling — e.g. a 👍 / 👎 (or thumbs / "seems fair" / "too much")
tap on each row. Purpose: surface disputes about the time-proportional court split
_before_ money changes hands, not a hard vote that changes the math. Optional, **v2**.
Rough shape when built: a `reaction` value per participant (nullable enum) plus who/when,
likely on the public share view so non-owners can react. Does **not** affect the
calculation — purely social confirmation.

---

## 4. Data model (TypeORM)

```ts
// A single session, owned by the authed organizer.
@Entity()
class BadmintonSession {
  @PrimaryGeneratedColumn("uuid") id: string;

  @ManyToOne(() => User) owner: User; // creator; only they can edit
  @Column() ownerId: string;

  @Column({ type: "date" }) playedOn: string;
  @Column({ nullable: true }) title?: string;

  // Money inputs (VND, integer — no decimals in VND).
  @Column("int") courtCost: number; // e.g. 150000
  @Column("int") shuttleUnitPrice: number; // e.g. per shuttle; shuttleCost is derived

  // Public read-only sharing.
  @Column({ unique: true }) shareToken: string; // unguessable, e.g. 22-char nanoid

  // Canonical computed snapshot, frozen at last save, served to the public link
  // so the share view never recomputes / drifts.
  @Column({ type: "jsonb", nullable: true }) computed?: ComputedSnapshot;

  @OneToMany(() => SessionParticipant, (p) => p.session, { cascade: true })
  participants: SessionParticipanArray<T>;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

// One attendee in one session. Identity is EITHER a linked user OR a free-text name.
@Entity()
class SessionParticipant {
  @PrimaryGeneratedColumn("uuid") id: string;

  @ManyToOne(() => BadmintonSession, (s) => s.participants, {
    onDelete: "CASCADE",
  })
  session: BadmintonSession;
  @Column() sessionId: string;

  // Linked account (enables future history/stats) — nullable.
  @ManyToOne(() => User, { nullable: true }) user?: User;
  @Column({ nullable: true }) userId?: string;

  // Display name: required. For free-text guests this is the whole identity;
  // for linked users it's a snapshot of their name at session time.
  @Column() name: string;

  // Split inputs (v2).
  @Column("float", { default: 1 }) hoursPlayed: number; // raw hours, 0 = excluded from court
  @Column("float", { default: 6 }) shuttleWeight: number; // 0-10 scale, shared shuttle pot; 0 = excluded; default 6 = nam-equivalent
  @Column({ type: "enum", enum: ["male", "female"], nullable: true }) gender?: "male" | "female"; // UI convenience only — sets the default shuttleWeight (6/4), not read by the calc package
}
// Session-level: @Column('int', { default: 0 }) totalShuttleCount — the shared shuttle pot.
```

`ComputedSnapshot` (stored jsonb, also the copy-to-clipboard source):

```ts
type ComputedRow = {
  participantId: string;
  name: string;
  court: number; // rounded VND
  shuttle: number; // rounded VND
  total: number; // court + shuttle, rounded
};
type ComputedSnapshot = {
  courtCost: number;
  shuttleCost: number; // derived = shuttleUnitPrice * totalShuttleCount
  grandTotal: number; // courtCost + shuttleCost, rounded to 1000
  rows: ComputedRow[];
  roundingResidual: number; // exact expense − Σ rounded totals, absorbed by organizer
  computedAt: string;
};
```

No separate `Player`/roster entity in v1 (per the "free-text or user account" decision).
Regulars surface through the autocomplete pulling from `users` + names the organizer
has used before — not a stored roster.

---

## 5. Calculation algorithm (canonical)

Lives in `packages/badminton-calc`, pure, no I/O. Inputs are the session + participants;
output is `ComputedSnapshot`.

```
Inputs:
  courtCost                              // VND int
  shuttleUnitPrice                       // VND int
  totalShuttleCount                      // shared pot, int
  participants[i]: { hoursPlayed h_i, shuttleWeight w_i }

Derived:
  shuttleCost = shuttleUnitPrice * totalShuttleCount

Court (time-proportional):
  totalHours = Σ h_i
  courtRaw_i = totalHours == 0 ? 0 : courtCost * h_i / totalHours
  // h_i = 0 ⇒ pays nothing for court ("exclude from court" = set hours 0)

Shuttle (weight-proportional, shared pot):
  totalWeight = Σ w_i
  shuttleRaw_i = totalWeight == 0 ? 0 : shuttleCost * w_i / totalWeight
  // w_i = 0 ⇒ pays nothing for shuttles ("exclude from shuttle" = set weight 0)

Fair share (Σ over players == courtCost + shuttleCost == expense; no discount step in v2):
  fair_i = courtRaw_i + shuttleRaw_i
  rawTotal_i = fair_i

Rounding (largest-remainder @ 1,000 VND):
  target      = round_to_1000(courtCost + shuttleCost)
  base_i      = floor(rawTotal_i / 1000) * 1000
  leftover    = (target − Σ base_i) / 1000        // # of 1,000-increments to hand out
  // sort players by descending fractional remainder (rawTotal_i − base_i);
  // give +1000 to the top `leftover` of them.
  total_i     = base_i + (got_increment_i ? 1000 : 0)

  // Σ total_i == target exactly. roundingResidual = (courtCost+shuttleCost) − target
  // is the ≤999 VND gap from rounding the grand total; assign to the organizer's row.

Split total_i back into court/shuttle for display proportionally to raw parts.
```

Note on units: `hoursPlayed`/`shuttleWeight` are raw numbers, not normalized 0..1
fractions — the `/ totalHours` and `/ totalWeight` divisions normalize automatically,
so any consistent unit works and the split stays correct as players are added or
removed (a v1 fraction had to be manually re-eyeballed whenever the roster changed).

### Worked example

Court 150,000; 8 players, `hoursPlayed` all `2` (a full session). Shuttle total
330,000 (derived from unitPrice × Σcount). Weight-class: 4 nam (`shuttleWeight = 6`),
4 nữ (`shuttleWeight = 4`).

Court: `150,000 / 8 = 18,750` each (equal hours ⇒ equal split).
Shuttle: total weight `= 4×6 + 4×4 = 40`; nam share `330,000 × 6/40 = 49,500` each,
nữ share `330,000 × 4/40 = 33,000` each.
`fair_i = court + shuttle`: nam `68,250`, nữ `51,750`. Rounded to nearest 1,000 VND via
largest-remainder; Σ rounded == round_to_1000(480,000) exactly. Golden-number values
are pinned in the calc package's tests.

---

## 6. Surfaces

### API (`apps/api`, new `badminton` module, CASL-guarded)

- `POST   /badminton/sessions` — create (auth). Body = session + participants array. Generates `shareToken`, computes + stores snapshot.
- `GET    /badminton/sessions` — list mine (auth).
- `GET    /badminton/sessions/:id` — read mine (auth, CASL `read` own).
- `PATCH  /badminton/sessions/:id` — edit + recompute snapshot (auth, CASL `update` own).
- `DELETE /badminton/sessions/:id` — (auth, CASL `delete` own).
- `GET    /badminton/participants/suggest?q=` — autocomplete: matches existing `users` + prior free-text names (auth).
- `GET    /public/badminton/sessions/:shareToken` — **no auth**, returns frozen `ComputedSnapshot` + read-only inputs. Never exposes owner PII beyond display names.

Server recomputes on every write using `packages/badminton-calc` — client numbers are a preview, server snapshot is canonical.

### Web (`apps/web`, TanStack Start routes)

- `/badminton` — my sessions list + "New session".
- `/badminton/sessions/$id` — editor: money inputs, participant rows (autocomplete name/user, hours played, gender + shuttle weight), live preview table (client calc), Save, "Copy summary", "Copy share link".
- `/s/$shareToken` — public read-only verification view (SSR from the public endpoint).

Copy-to-clipboard emits a plain-text / markdown table built from the snapshot.

---

## 7. Validation & edge rules

- VND amounts: non-negative integers. `hoursPlayed ≥ 0`, `shuttleWeight ∈ [0, 10]`, `gender ∈ {'male','female'} | null`, `totalShuttleCount` integer ≥ 0.
- `Σ hoursPlayed == 0` ⇒ no one charged court; that pot's cost is absorbed into `roundingResidual` instead of collected (same mechanism as `Σ shuttleWeight == 0` below, not a separate rule).
- `Σ shuttleWeight == 0` (everyone excluded) ⇒ shuttle shares all 0, same absorption; surface a warning in the UI when this makes `roundingResidual` exceed the normal ≤999 VND rounding gap (i.e. a whole pot went uncollected, not just a rounding remainder).
- A participant needs a `name`; `userId` optional.
- Rounding invariant is a hard test **only when both axes have a nonzero total** (`Σ hoursPlayed > 0` and `Σ shuttleWeight > 0` whenever that axis's cost is nonzero): **Σ rounded totals == round_to_1000(expense)**. The two bullets above are the documented exception — when an axis's total is zero, its pot is not collected at all, and `roundingResidual` carries the full uncollected amount rather than the normal sub-1,000 gap. A test should pin this exception explicitly so it reads as documented behavior, not an untested gap.
- Share token: unguessable (nanoid ≥ 22 chars), rotatable later.
- No discount input anywhere in v2 — removed outright, not deferred.

---

## 8. Suggested build phases

1. **`packages/badminton-calc`** — pure algorithm + Zod schemas + rounding-invariant unit tests. (No UI, fully testable.)
2. **API module** — entities, migration, CRUD, CASL rules, public share endpoint, suggest endpoint.
3. **Web editor** — `/badminton` list + `$id` editor with live preview + copy + share link.
4. **Public view** — `/s/$shareToken` SSR read-only.
5. **Polish** — empty/warning states, VND formatting, toasts.

Deferred phases (later): analytics dashboard · settlement + VietQR · export · i18n/VI · dark mode.
