# Badminton Money Splitter — Spec (v1)

Status: **Draft, ready to build.** Derived from an interview on 2026-07-25.
Owner: dtran. Lives in the `all-about-saas` monorepo.

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

| Concern | Use |
|---|---|
| Web app | `apps/web` — **TanStack Start** (Vite + Nitro SSR), `@tanstack/react-router` |
| Forms | **`@tanstack/react-form`** + **Zod v4** |
| UI | shadcn v4 on Base UI + Radix, Tailwind v4, `sonner` toasts |
| Summary table | Plain shadcn `<Table>` for v1 (an 8-row table doesn't need TanStack Table; skip the dep) |
| API | `apps/api` — **NestJS 11 + TypeORM 0.3 + PostgreSQL** |
| Auth / RBAC | Reuse existing JWT/SSO auth, `users`, and **CASL** |
| Shared calc | New workspace package `packages/badminton-calc` — one pure implementation imported by BOTH web and api |

The shared calc package is the key architectural call: the split algorithm must
produce identical numbers on the client (instant preview) and the server (canonical
snapshot for the share link). One source of truth prevents drift.

---

## 3. Locked decisions (from interview)

| Area | Decision |
|---|---|
| Scope | **Full integrated**: Nest API module + Postgres persistence, tied to existing users/CASL |
| Court fee | **Time-proportional** via a per-player played-fraction (0–100%, default 100%) |
| Shuttle cost | **Unit price × count** → total shuttle cost is *derived*, not typed |
| Discount effect | **Redistributed** onto everyone else, so collected == expense. Applies to the **whole bill** (court + shuttle) |
| Discount storage | **Per-session only** — not stored on any player profile |
| Rounding | Round each share to **nearest 1,000 VND**, distribute leftover by **largest-remainder** |
| Player identity | Participant is **either a linked app user (`userId`) or a free-text name**; UI resolves via autocomplete |
| History/stats | Key off `userId` when linked; free-text names are ephemeral. **All analytics deferred** past v1 |
| Guests | Free-text names are the guest path (quick-add, no account needed) |
| Access | **Login required to create/edit**; **public unguessable read-only link** to view/verify |
| Settlement | **Calc + copy only** in v1 — no paid/unpaid tracking, no bank QR |
| Locale | **VND**, English UI, Vietnamese number formatting (`150.000`) |

### Explicitly deferred (design so they drop in later, don't build now)
Saved analytics dashboard (total spent per player, avg/session, games played) ·
paid/unpaid settlement · VietQR generation · Excel/PDF export · dark mode polish ·
i18n / Vietnamese UI · reusable player roster with default discounts.

### v2 idea — court-fee "satisfaction" reaction (optional)
A lightweight per-player reaction on their computed **court** share so the group can
signal agreement before settling — e.g. a 👍 / 👎 (or thumbs / "seems fair" / "too much")
tap on each row. Purpose: surface disputes about the time-proportional court split
*before* money changes hands, not a hard vote that changes the math. Optional, **v2**.
Rough shape when built: a `reaction` value per participant (nullable enum) plus who/when,
likely on the public share view so non-owners can react. Does **not** affect the
calculation — purely social confirmation.

---

## 4. Data model (TypeORM)

```ts
// A single session, owned by the authed organizer.
@Entity()
class BadmintonSession {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => User) owner: User;      // creator; only they can edit
  @Column() ownerId: string;

  @Column({ type: 'date' }) playedOn: string;
  @Column({ nullable: true }) title?: string;

  // Money inputs (VND, integer — no decimals in VND).
  @Column('int') courtCost: number;         // e.g. 150000
  @Column('int') shuttleUnitPrice: number;  // e.g. per shuttle; shuttleCost is derived

  // Public read-only sharing.
  @Column({ unique: true }) shareToken: string;   // unguessable, e.g. 22-char nanoid

  // Canonical computed snapshot, frozen at last save, served to the public link
  // so the share view never recomputes / drifts.
  @Column({ type: 'jsonb', nullable: true }) computed?: ComputedSnapshot;

  @OneToMany(() => SessionParticipant, p => p.session, { cascade: true })
  participants: SessionParticipant[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

// One attendee in one session. Identity is EITHER a linked user OR a free-text name.
@Entity()
class SessionParticipant {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => BadmintonSession, s => s.participants, { onDelete: 'CASCADE' })
  session: BadmintonSession;
  @Column() sessionId: string;

  // Linked account (enables future history/stats) — nullable.
  @ManyToOne(() => User, { nullable: true }) user?: User;
  @Column({ nullable: true }) userId?: string;

  // Display name: required. For free-text guests this is the whole identity;
  // for linked users it's a snapshot of their name at session time.
  @Column() name: string;

  // Split inputs.
  @Column('float', { default: 1 }) courtFraction: number;    // 0..1, 0 = excluded from court
  @Column('float', { default: 1 }) shuttleFraction: number;  // 0..1 weight for the shared shuttle pot; 0 = excluded
  @Column('float', { default: 0 }) discount: number;         // 0..1, e.g. 0.15
}
// Session-level: @Column('int', { default: 0 }) totalShuttleCount — the shared shuttle pot.
```

`ComputedSnapshot` (stored jsonb, also the copy-to-clipboard source):

```ts
type ComputedRow = {
  participantId: string;
  name: string;
  court: number;    // rounded VND
  shuttle: number;  // rounded VND
  total: number;    // court + shuttle, rounded
};
type ComputedSnapshot = {
  courtCost: number;
  shuttleCost: number;       // derived = shuttleUnitPrice * totalShuttleCount
  grandTotal: number;        // courtCost + shuttleCost, rounded to 1000
  rows: ComputedRow[];
  roundingResidual: number;  // exact expense − Σ rounded totals, absorbed by organizer
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
  participants[i]: { courtFraction f_i, shuttleFraction s_i, discount d_i }

Derived:
  shuttleCost = shuttleUnitPrice * totalShuttleCount

Court (time-proportional):
  totalFraction = Σ f_i
  courtRaw_i    = totalFraction == 0 ? 0 : courtCost * f_i / totalFraction
  // f_i = 0 ⇒ pays nothing for court ("exclude from court" = set fraction 0)

Shuttle (weight-proportional, shared pot, no discount yet):
  totalShuttleFraction = Σ s_i
  shuttleRaw_i = totalShuttleFraction == 0 ? 0 : shuttleCost * s_i / totalShuttleFraction
  // s_i = 0 ⇒ pays nothing for shuttles ("exclude from shuttle" = set weight 0)

Undiscounted fair share (Σ over players == courtCost + shuttleCost == expense):
  fair_i = courtRaw_i + shuttleRaw_i

Whole-bill discount, redistributed to preserve the total:
  eff_i    = fair_i * (1 - d_i)          // discount lowers the WHOLE bill, not just shuttle
  scale    = expense / Σ eff_j            // rescale so the shortfall spreads onto everyone
  rawTotal_i = eff_i * scale
  // A discount lowers player i's court AND shuttle share; the redistribution is
  // proportional across all players. Σ rawTotal_i == expense exactly.
  // (For the court/shuttle display columns, split rawTotal_i back in the
  //  courtRaw_i : shuttleRaw_i ratio.)

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

### Worked example

Court 150,000; 8 players all at fraction 1.0. Shuttle total 330,000 (derived from
unitPrice × Σcount). Counts `10,10,10,10,8,8,8,8`; two players at 15% discount.

Undiscounted fair shares: court `150,000/8 = 18,750` each; shuttle by count share of
330,000. Each player's `fair_i = court + shuttle`. Then the 15% discount is applied to
those two players' **whole** `fair_i` and the pool is rescaled so Σ still = 480,000.

Note: this **intentionally differs** from the original prompt's example table
(66,164), which discounted shuttle only. Whole-bill discounting lowers the two
discounted players' court share as well, pushing their totals lower and everyone
else's slightly higher. Final shares are rounded to clean thousands via
largest-remainder. Golden-number values will be pinned in the calc package's tests.

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
- `/badminton/sessions/$id` — editor: money inputs, participant rows (autocomplete name/user, fraction %, shuttle count, discount %), live preview table (client calc), Save, "Copy summary", "Copy share link".
- `/s/$shareToken` — public read-only verification view (SSR from the public endpoint).

Copy-to-clipboard emits a plain-text / markdown table built from the snapshot.

---

## 7. Validation & edge rules
- VND amounts: non-negative integers. `courtFraction ∈ [0,1]`, `discount ∈ [0,1)`, `shuttleFraction ∈ [0,1]`, `totalShuttleCount` integer ≥ 0.
- `Σ courtFraction == 0` ⇒ no one charged court (allowed; court effectively free/absorbed elsewhere).
- `Σ effectiveWeight == 0` (everyone 0 shuttles or 100% discount) ⇒ shuttle shares all 0; surface a warning.
- A participant needs a `name`; `userId` optional.
- Rounding invariant is a hard test: **Σ rounded totals == round_to_1000(expense)** for every computed snapshot.
- Share token: unguessable (nanoid ≥ 22 chars), rotatable later.
- Discount scope is **whole bill** (court + shuttle) — confirmed. All open items resolved.

---

## 8. Suggested build phases
1. **`packages/badminton-calc`** — pure algorithm + Zod schemas + rounding-invariant unit tests. (No UI, fully testable.)
2. **API module** — entities, migration, CRUD, CASL rules, public share endpoint, suggest endpoint.
3. **Web editor** — `/badminton` list + `$id` editor with live preview + copy + share link.
4. **Public view** — `/s/$shareToken` SSR read-only.
5. **Polish** — empty/warning states, VND formatting, toasts.

Deferred phases (later): analytics dashboard · settlement + VietQR · export · i18n/VI · dark mode.
