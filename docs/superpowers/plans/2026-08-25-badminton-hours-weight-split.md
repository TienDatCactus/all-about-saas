# Badminton Hours + Weight-Class Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the instinct-guessed 0..1 `courtFraction`/`shuttleFraction`/`discount` split inputs with two stable, derivable numbers — raw `hoursPlayed` (court) and `shuttleWeight` (shuttle, defaulted from an optional `gender` pick: 6 nam / 4 nữ) — and remove discount entirely.

**Architecture:** `packages/badminton-calc` is the single source of truth for the split math, imported by both `apps/api` and `apps/web` — it changes once, both surfaces follow. The normalization (`courtCost * x_i / Σx`) is already scale-invariant, so raw hours/weights slot in as a drop-in replacement for the old fractions with no change to the division logic — only the discount rescale step is deleted.

**Tech Stack:** TypeScript, NestJS 11 + TypeORM 0.3 + PostgreSQL (`apps/api`), TanStack Start + `@tanstack/react-form` + Zod v4 (`apps/web`), Jest (`apps/api` tests).

**Spec:** [docs/badminton-splitter-spec.md](../../badminton-splitter-spec.md) (v2 changelog, 2026-08-25) — read it alongside this plan; §3-§7 there are the current canonical model.

## Global Constraints

- VND amounts are non-negative integers; `hoursPlayed ≥ 0`; `shuttleWeight ≥ 0`; `gender ∈ {'male','female'} | null`.
- Rounding invariant is a hard test: Σ rounded row totals === `round_to_1000(courtCost + shuttleCost)` for every computed snapshot.
- No discount input anywhere — removed outright, not deferred.
- Migration is destructive (no real production session data to preserve — confirmed by the user).
- `gender` is a UI convenience only (defaults `shuttleWeight`); the calc package never reads it.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/badminton-calc/src/index.ts` | Pure split algorithm + shared types. Modified. |
| `apps/api/src/badminton/badminton.calc.spec.ts` | Golden-number tests for the algorithm above. Modified (rewritten for the new fields/no-discount math). |
| `apps/api/src/badminton/badminton.calc.ts`, `apps/api/src/badminton/types/computed-snapshot.ts` | Dead pre-package-extraction duplicate, zero importers. Deleted. |
| `apps/api/src/badminton/entities/badminton-participant.entity.ts` | TypeORM entity for one session participant. Modified (rename + add `gender`, drop `discount`). |
| `apps/api/src/database/migrations/<ts>-badminton-hours-weight-split.ts` | New migration applying the entity change to a real (already-migrated) database. Created. |
| `apps/api/src/badminton/badminton.dto.ts` | `ParticipantInputDto` (and friends). Modified. |
| `apps/api/src/badminton/dto/create-badminton-session.dto.ts`, `apps/api/src/badminton/dto/participant-input.dto.ts` | Dead duplicate DTOs, zero importers. Deleted. |
| `apps/api/src/badminton/badminton.service.ts` | Maps DTO ↔ entity ↔ calc input at create/update/share-read. Modified. |
| `apps/api/src/badminton/badminton.service.spec.ts` | Service unit tests. Modified (fixtures). |
| `apps/web/src/services/badminton/types.ts` | Zod schemas mirroring the API contract. Modified. |
| `apps/web/src/pages/badminton/lib/form.ts` | Editor form state ↔ API payload ↔ live-preview calc input. Modified. |
| `apps/web/src/pages/badminton/components/player-editor/PlayerRow.tsx` | Per-player input row UI. Modified. |
| `apps/web/src/pages/badminton/components/player-editor/index.tsx` | Table header labels. Modified. |
| `apps/web/src/pages/badminton/share/index.tsx` | Public share page's client-side recompute fallback. Modified. |

---

### Task 1: Shared calc algorithm — drop discount, rename to hours/weight

**Files:**
- Modify: `packages/badminton-calc/src/index.ts`
- Modify: `apps/api/src/badminton/badminton.calc.spec.ts`
- Delete: `apps/api/src/badminton/badminton.calc.ts`
- Delete: `apps/api/src/badminton/types/computed-snapshot.ts`

**Interfaces:**
- Produces (consumed by Task 2's service and Task 3's web form/share page):
  ```ts
  export interface CalcParticipant {
    id: string;
    name: string;
    hoursPlayed: number;
    shuttleWeight: number;
  }
  export interface CalcInput {
    courtCost: number;
    shuttleUnitPrice: number;
    totalShuttleCount: number;
    participants: CalcParticipant[];
  }
  export interface ComputedRow {
    participantId: string;
    name: string;
    court: number;
    shuttle: number;
    total: number;
  }
  export interface ComputedSnapshot {
    courtCost: number;
    shuttleCost: number;
    grandTotal: number;
    rows: ComputedRow[];
    roundingResidual: number;
    computedAt: string;
  }
  export function computeSplit(input: CalcInput, computedAt?: string): ComputedSnapshot;
  ```
  (`ComputedRow`/`ComputedSnapshot` shapes are unchanged from today — only `CalcParticipant`/`CalcInput` lose `courtFraction`/`shuttleFraction`/`discount`.)

- [ ] **Step 1: Confirm the two duplicate clusters are actually dead before touching anything**

```bash
grep -rln "from './badminton.calc'" apps/api/src
grep -rln "from '\./types/computed-snapshot'\|from '\.\./types/computed-snapshot'" apps/api/src
```

Expected: both commands print nothing except the files themselves (i.e. no external importer). This was already verified during design; re-check here in case something changed.

- [ ] **Step 2: Delete the dead duplicate calc implementation**

```bash
rm apps/api/src/badminton/badminton.calc.ts apps/api/src/badminton/types/computed-snapshot.ts
```

- [ ] **Step 3: Rewrite the test file first (red) — new fields, no discount, plus a scale-invariance case**

Replace the full contents of `apps/api/src/badminton/badminton.calc.spec.ts` with:

```ts
import { CalcInput, computeSplit } from '@repo/badminton-calc';

const AT = '2026-07-25T00:00:00.000Z';

const p = (
	id: string,
	overrides: Partial<{ hoursPlayed: number; shuttleWeight: number }> = {},
) => ({
	id,
	name: id,
	hoursPlayed: overrides.hoursPlayed ?? 1,
	shuttleWeight: overrides.shuttleWeight ?? 0,
});

describe('computeSplit', () => {
	it('derives shuttle cost from unit price × total shuttle count', () => {
		const input: CalcInput = {
			courtCost: 100_000,
			shuttleUnitPrice: 1_000,
			totalShuttleCount: 20,
			participants: [p('A', { shuttleWeight: 1 }), p('B', { shuttleWeight: 1 })],
		};
		const out = computeSplit(input, AT);
		expect(out.shuttleCost).toBe(20_000);
		expect(out.grandTotal).toBe(120_000);
	});

	it('splits an even session exactly', () => {
		const input: CalcInput = {
			courtCost: 100_000,
			shuttleUnitPrice: 1_000,
			totalShuttleCount: 20,
			participants: [p('A', { shuttleWeight: 1 }), p('B', { shuttleWeight: 1 })],
		};
		const out = computeSplit(input, AT);
		expect(out.rows).toEqual([
			{ participantId: 'A', name: 'A', court: 50_000, shuttle: 10_000, total: 60_000 },
			{ participantId: 'B', name: 'B', court: 50_000, shuttle: 10_000, total: 60_000 },
		]);
		expect(out.roundingResidual).toBe(0);
	});

	it('excludes hoursPlayed=0 from court and shuttleWeight=0 from shuttle', () => {
		const input: CalcInput = {
			courtCost: 90_000,
			shuttleUnitPrice: 1_000,
			totalShuttleCount: 20,
			participants: [
				p('Player', { hoursPlayed: 1, shuttleWeight: 1 }),
				p('CourtOnly', { hoursPlayed: 1, shuttleWeight: 0 }),
				p('ShuttleOnly', { hoursPlayed: 0, shuttleWeight: 1 }),
			],
		};
		const out = computeSplit(input, AT);
		const shuttleOnly = out.rows.find((r) => r.participantId === 'ShuttleOnly')!;
		const courtOnly = out.rows.find((r) => r.participantId === 'CourtOnly')!;
		expect(shuttleOnly.court).toBe(0);
		expect(courtOnly.shuttle).toBe(0);
	});

	it('applies time-proportional court split', () => {
		const input: CalcInput = {
			courtCost: 100_000,
			shuttleUnitPrice: 0,
			totalShuttleCount: 0,
			participants: [
				p('Full', { hoursPlayed: 2, shuttleWeight: 0 }),
				p('Half', { hoursPlayed: 1, shuttleWeight: 0 }),
			],
		};
		const out = computeSplit(input, AT);
		const full = out.rows.find((r) => r.participantId === 'Full')!;
		const half = out.rows.find((r) => r.participantId === 'Half')!;
		expect(full.total).toBeGreaterThan(half.total);
		expect(full.total + half.total).toBe(out.grandTotal);
	});

	it('is scale-invariant: doubling every hoursPlayed/shuttleWeight in lockstep produces the same split', () => {
		const base: CalcInput = {
			courtCost: 150_000,
			shuttleUnitPrice: 2_000,
			totalShuttleCount: 30,
			participants: [
				p('A', { hoursPlayed: 1, shuttleWeight: 6 }),
				p('B', { hoursPlayed: 2, shuttleWeight: 4 }),
			],
		};
		const doubled: CalcInput = {
			...base,
			participants: base.participants.map((pp) => ({
				...pp,
				hoursPlayed: pp.hoursPlayed * 2,
				shuttleWeight: pp.shuttleWeight * 2,
			})),
		};
		expect(computeSplit(doubled, AT).rows).toEqual(computeSplit(base, AT).rows);
	});

	describe('reconciliation invariants (property-style)', () => {
		const cases: CalcInput[] = [
			{
				courtCost: 150_000,
				shuttleUnitPrice: 4_583,
				totalShuttleCount: 70,
				participants: [
					p('Lam', { shuttleWeight: 10 }),
					p('Dat', { shuttleWeight: 10 }),
					p('Kien', { shuttleWeight: 10 }),
					p('Thai', { shuttleWeight: 10 }),
					p('Hieu', { shuttleWeight: 8 }),
					p('Truong', { shuttleWeight: 8 }),
					p('Trang', { shuttleWeight: 8 }),
					p('Giang', { shuttleWeight: 8 }),
				],
			},
			{
				courtCost: 237_777,
				shuttleUnitPrice: 3_111,
				totalShuttleCount: 27,
				participants: [
					p('A', { hoursPlayed: 0.3, shuttleWeight: 5 }),
					p('B', { hoursPlayed: 1, shuttleWeight: 12 }),
					p('C', { hoursPlayed: 0.75, shuttleWeight: 0 }),
					p('D', { hoursPlayed: 1, shuttleWeight: 7 }),
					p('E', { hoursPlayed: 0, shuttleWeight: 3 }),
				],
			},
		];

		it.each(cases.map((c, i) => [i, c] as const))(
			'case %#: Σ totals === grandTotal, all multiples of 1,000, court+shuttle===total',
			(_i, input) => {
				const out = computeSplit(input, AT);
				const totalCollected = out.rows.reduce((a, r) => a + r.total, 0);
				expect(totalCollected).toBe(out.grandTotal);
				for (const r of out.rows) {
					expect(r.total % 1000).toBe(0);
					expect(r.court + r.shuttle).toBe(r.total);
					expect(r.court).toBeGreaterThanOrEqual(0);
					expect(r.shuttle).toBeGreaterThanOrEqual(0);
				}
				expect(out.roundingResidual).toBe(
					out.courtCost + out.shuttleCost - out.grandTotal,
				);
			},
		);
	});

	it('handles the empty-session and zero-weight edge cases without throwing', () => {
		expect(
			computeSplit(
				{ courtCost: 50_000, shuttleUnitPrice: 1_000, totalShuttleCount: 0, participants: [] },
				AT,
			).rows,
		).toEqual([]);

		const noShuttle = computeSplit(
			{
				courtCost: 50_000,
				shuttleUnitPrice: 1_000,
				totalShuttleCount: 5,
				participants: [p('A', { hoursPlayed: 1, shuttleWeight: 0 })],
			},
			AT,
		);
		expect(noShuttle.rows[0].shuttle).toBe(0);
		expect(noShuttle.rows[0].court).toBe(noShuttle.rows[0].total);
	});
});
```

- [ ] **Step 4: Run the test to confirm it fails against the current implementation**

```bash
cd apps/api && npx jest badminton.calc.spec.ts
```

Expected: FAIL — the old `computeSplit` still expects `courtFraction`/`shuttleFraction`/`discount`, so the new field names produce wrong numbers (e.g. every `shuttleWeight`-only participant gets 0 shuttle share because the old code reads `shuttleFraction`, which is `undefined` → `NaN`/0 downstream).

- [ ] **Step 5: Replace `packages/badminton-calc/src/index.ts` with the new algorithm**

```ts
/**
 * Canonical badminton money-split algorithm.
 *
 * This package is the single source of truth for the calculation: the API calls
 * it on save to freeze `BadmintonSession.computed`, and the web app calls it to
 * render the live editing preview. They must never drift, which is exactly why
 * the implementation lives here rather than being copied into both.
 *
 * Pure data in, pure data out — no entity/ORM coupling.
 */

/** One player's rounded share of one session. All amounts are whole VND. */
export interface ComputedRow {
  participantId: string;
  name: string;
  court: number;
  shuttle: number;
  total: number;
}

/**
 * Frozen result of the split calculation, stored on the session and served to
 * the public share link so the numbers never recompute / drift.
 */
export interface ComputedSnapshot {
  /** Court cost input, VND. */
  courtCost: number;
  /** Derived shuttle cost = shuttleUnitPrice * totalShuttleCount, VND. */
  shuttleCost: number;
  /** courtCost + shuttleCost, rounded to the nearest 1,000 VND. */
  grandTotal: number;
  rows: ComputedRow[];
  /** Exact expense minus sum(rounded totals); absorbed by the organizer. */
  roundingResidual: number;
  /** ISO timestamp the snapshot was computed. */
  computedAt: string;
}

export interface CalcParticipant {
  /** Stable id used to key the output row back to the participant. */
  id: string;
  name: string;
  /**
   * Raw hours played this session. Drives the time-proportional court split.
   * Not a 0..1 fraction — the algorithm divides by the sum, so any consistent
   * unit normalizes correctly, and the number stays valid as the roster changes.
   */
  hoursPlayed: number;
  /** Raw weight for the shared shuttle pot. Same normalization as hoursPlayed. */
  shuttleWeight: number;
}

export interface CalcInput {
  /** Court cost, VND. */
  courtCost: number;
  /** Price per shuttle, VND. */
  shuttleUnitPrice: number;
  /** Total shuttles used in the session (shared pot). shuttleCost = shuttleUnitPrice × this. */
  totalShuttleCount: number;
  participants: CalcParticipant[];
}

const ROUND_UNIT = 1000;

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/** Round to the nearest {@link ROUND_UNIT} (1,000 VND). */
const roundToUnit = (x: number): number =>
  Math.round(x / ROUND_UNIT) * ROUND_UNIT;

/**
 * Compute each player's share of a session.
 *
 * Model (see docs/badminton-splitter-spec.md §5):
 *  - Court fee is split proportionally by each player's `hoursPlayed`.
 *  - Shuttle fee is a shared pot (shuttleCost = unitPrice × totalShuttleCount) split by
 *    each player's `shuttleWeight` — exactly like the court split.
 *  - No discount step: each player's fair share IS their final pre-rounding total.
 *  - Each player's total is rounded to the nearest 1,000 VND using the largest-remainder
 *    method, guaranteeing Σ(rounded totals) === round(expense) exactly.
 *
 * `computedAt` is injectable (rather than always read from the clock) so callers that
 * care about determinism — the API's snapshot tests — can pin it.
 */
export function computeSplit(
  input: CalcInput,
  computedAt: string = new Date().toISOString(),
): ComputedSnapshot {
  const { courtCost, shuttleUnitPrice, totalShuttleCount, participants } = input;

  const shuttleCost = shuttleUnitPrice * totalShuttleCount;
  const expense = courtCost + shuttleCost;
  const grandTotal = roundToUnit(expense);

  if (participants.length === 0) {
    return {
      courtCost,
      shuttleCost,
      grandTotal,
      rows: [],
      roundingResidual: expense,
      computedAt,
    };
  }

  const totalHours = sum(participants.map((p) => p.hoursPlayed));
  const totalWeight = sum(participants.map((p) => p.shuttleWeight));

  // Fair share per player, and its court/shuttle breakdown. Both pots are split by
  // each player's respective raw weight. No discount step in v2 — `total` here is
  // the final pre-rounding amount.
  const fair = participants.map((participant) => {
    const court =
      totalHours === 0 ? 0 : (courtCost * participant.hoursPlayed) / totalHours;
    const shuttle =
      totalWeight === 0
        ? 0
        : (shuttleCost * participant.shuttleWeight) / totalWeight;
    return { participant, court, shuttle, total: court + shuttle };
  });

  // Largest-remainder rounding of each fair total to 1,000 VND.
  const scaled = fair.map((f, i) => {
    const raw = f.total;
    const base = Math.floor(raw / ROUND_UNIT) * ROUND_UNIT;
    return { fair: f, i, raw, base, remainder: raw - base };
  });
  const collectTarget = roundToUnit(sum(scaled.map((s) => s.raw)));
  let increments = Math.round(
    (collectTarget - sum(scaled.map((s) => s.base))) / ROUND_UNIT,
  );
  increments = Math.max(0, Math.min(participants.length, increments));

  const roundUp = new Set(
    [...scaled]
      .sort((a, b) => b.remainder - a.remainder || a.i - b.i)
      .slice(0, increments)
      .map((s) => s.i),
  );

  // Split each rounded total back into court/shuttle for display, preserving the
  // fair court:shuttle ratio. court + shuttle === total per row.
  const rows: ComputedRow[] = scaled.map(({ fair: f, i, base }) => {
    const total = roundUp.has(i) ? base + ROUND_UNIT : base;
    const court = f.total === 0 ? 0 : Math.round((total * f.court) / f.total);
    const shuttle = total - court;
    return {
      participantId: f.participant.id,
      name: f.participant.name,
      court,
      shuttle,
      total,
    };
  });

  return {
    courtCost,
    shuttleCost,
    grandTotal,
    rows,
    roundingResidual: expense - sum(rows.map((r) => r.total)),
    computedAt,
  };
}
```

- [ ] **Step 6: Run the test again to confirm it passes**

```bash
cd apps/api && npx jest badminton.calc.spec.ts
```

Expected: PASS, all suites green.

- [ ] **Step 7: Commit**

```bash
git add packages/badminton-calc/src/index.ts apps/api/src/badminton/badminton.calc.spec.ts
git rm apps/api/src/badminton/badminton.calc.ts apps/api/src/badminton/types/computed-snapshot.ts
git commit -m "feat(badminton-calc): replace fraction/discount split with hours+weight"
```

---

### Task 2: API layer — entity, migration, DTO, service

**Files:**
- Modify: `apps/api/src/badminton/entities/badminton-participant.entity.ts`
- Create: `apps/api/src/database/migrations/<generated-timestamp>-badminton-hours-weight-split.ts`
- Modify: `apps/api/src/badminton/badminton.dto.ts`
- Delete: `apps/api/src/badminton/dto/create-badminton-session.dto.ts`
- Delete: `apps/api/src/badminton/dto/participant-input.dto.ts`
- Modify: `apps/api/src/badminton/badminton.service.ts`
- Modify: `apps/api/src/badminton/badminton.service.spec.ts`

**Interfaces:**
- Consumes: `CalcInput`/`CalcParticipant`/`computeSplit` from Task 1 (`@repo/badminton-calc`) — `{ id, name, hoursPlayed, shuttleWeight }`.
- Produces (consumed by Task 3's web schema/form):
  - `ParticipantInputDto` fields: `userId?: string`, `name: string`, `hoursPlayed?: number`, `shuttleWeight?: number`, `gender?: 'male' | 'female'`.
  - `BadmintonParticipant` entity columns: `hoursPlayed: number` (default 1), `shuttleWeight: number` (default 1), `gender?: 'male' | 'female'`.

- [ ] **Step 1: Confirm the dead DTO duplicates are unused**

```bash
grep -rln "create-badminton-session.dto\|participant-input.dto" apps/api/src --include="*.ts" | grep -v "^apps/api/src/badminton/dto/"
```

Expected: no output (nothing outside `dto/` imports them).

- [ ] **Step 2: Delete the dead duplicate DTOs**

```bash
rm apps/api/src/badminton/dto/create-badminton-session.dto.ts apps/api/src/badminton/dto/participant-input.dto.ts
```

- [ ] **Step 3: Update the entity**

Replace the split-input columns at the bottom of `apps/api/src/badminton/entities/badminton-participant.entity.ts` (everything from the `name` column down) so the file reads:

Matches the existing enum-column convention in this codebase (see `OAuthProvider` in `apps/api/src/users/entities/oauth-account.entity.ts`): a real TS enum, not a bare union type.

```ts
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteBaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { BadmintonSession } from './badminton-session.entity';

export enum ParticipantGender {
	MALE = 'male',
	FEMALE = 'female',
}

/**
 * One attendee of one {@link BadmintonSession}. Identity is EITHER a linked app
 * user ({@link userId}) OR a free-text guest — in both cases {@link name} holds
 * the display name (a snapshot for linked users, so it survives account deletion).
 *
 * The partial unique index blocks the same account appearing twice in a session,
 * while still allowing many free-text (null-userId) rows.
 */
@Entity()
@Index(['sessionId', 'userId'], { unique: true, where: '"userId" IS NOT NULL' })
export class BadmintonParticipant extends SoftDeleteBaseEntity {
	@ManyToOne(() => BadmintonSession, (s) => s.participants, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'sessionId' })
	session!: BadmintonSession;

	@Column('uuid')
	@Index()
	sessionId!: string;

	/** Linked app user, if this participant is a registered account. Optional. */
	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'userId' })
	user?: User;

	@Column('uuid', { nullable: true })
	@Index()
	userId?: string;

	/** Display name: free-text guest name, or a snapshot of the linked user's name. */
	@Column()
	name!: string;

	/** Raw hours played this session. Drives the time-proportional court split; 0 = excluded from court. */
	@Column('float', { default: 1 })
	hoursPlayed!: number;

	/** Raw weight for the shared shuttle pot; 0 = excluded from shuttle fee. */
	@Column('float', { default: 1 })
	shuttleWeight!: number;

	/** UI convenience only — sets the default shuttleWeight (6 nam / 4 nữ). Never read by the calc package. */
	@Column({ type: 'enum', enum: ParticipantGender, nullable: true })
	gender?: ParticipantGender;
}
```

- [ ] **Step 4: Scaffold and write the migration**

```bash
cd apps/api && npm run typeorm -- migration:create src/database/migrations/badminton-hours-weight-split
```

(The `migration:create` package.json script hardcodes its path to `.../manual`, so call the underlying `typeorm` script directly with the real name instead.) This prints the created file's path, e.g. `src/database/migrations/1787..."-badminton-hours-weight-split.ts`. Open it and replace its contents (keep the auto-generated class name/timestamp exactly as TypeORM wrote them — only fill in the `up`/`down` bodies):

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class BadmintonHoursWeightSplit<GENERATED_TIMESTAMP> implements MigrationInterface {
	name = 'BadmintonHoursWeightSplit<GENERATED_TIMESTAMP>';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" RENAME COLUMN "courtFraction" TO "hoursPlayed"`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" RENAME COLUMN "shuttleFraction" TO "shuttleWeight"`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" DROP COLUMN "discount"`,
		);
		await queryRunner.query(
			`CREATE TYPE "public"."badminton_participant_gender_enum" AS ENUM('male', 'female')`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" ADD "gender" "public"."badminton_participant_gender_enum"`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" DROP COLUMN "gender"`,
		);
		await queryRunner.query(
			`DROP TYPE "public"."badminton_participant_gender_enum"`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" ADD "discount" double precision NOT NULL DEFAULT '0'`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" RENAME COLUMN "shuttleWeight" TO "shuttleFraction"`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" RENAME COLUMN "hoursPlayed" TO "courtFraction"`,
		);
	}
}
```

Replace `<GENERATED_TIMESTAMP>` with whatever TypeORM actually generated (it's already in the class name/`name` field it scaffolded — don't hand-invent a timestamp).

- [ ] **Step 5: Run the migration up, then down, against the local dev database, to prove both directions work**

```bash
cd apps/api && npm run migration:run
npm run migration:revert
npm run migration:run
```

Expected: each command exits 0 with no SQL errors. After the final `migration:run`, `\d badminton_participant` in `psql` should show `hoursPlayed`, `shuttleWeight`, `gender` and no `courtFraction`/`shuttleFraction`/`discount`.

- [ ] **Step 6: Update the DTO**

In `apps/api/src/badminton/badminton.dto.ts`, replace the `ParticipantInputDto` class with:

```ts
export class ParticipantInputDto {
	/** Linked app user id, if this participant is a registered account. Omit for a free-text guest. */
	@IsOptional()
	@IsUUID()
	userId?: string;

	/** Display name — a free-text guest name, or a snapshot of the linked user's name. */
	@IsString()
	@MaxLength(120)
	name!: string;

	/** Raw hours played this session (drives the time-proportional court split). Defaults to 1. */
	@IsOptional()
	@IsNumber()
	@Min(0)
	hoursPlayed?: number;

	/** Raw weight for the shared shuttle pot. Defaults to 1. */
	@IsOptional()
	@IsNumber()
	@Min(0)
	shuttleWeight?: number;

	/** UI convenience only — the web app uses this to default shuttleWeight (6 nam / 4 nữ). */
	@IsOptional()
	@IsEnum(ParticipantGender)
	gender?: ParticipantGender;
}
```

Add the import for the enum from Task 2 Step 3's entity file, near the top of `badminton.dto.ts`:

```ts
import { ParticipantGender } from './entities/badminton-participant.entity';
```

This drops the `@Max(1)` decorators (no longer a 0..1 fraction) and the `discount` field. `Max` was only ever used on the three fraction/discount fields just removed, so it's now unused — change the import line

```ts
import { IsNumber, IsUUID, Max } from 'class-validator';
```

to

```ts
import { IsEnum, IsNumber, IsUUID } from 'class-validator';
```

(confirm first with `grep -n "Max(" apps/api/src/badminton/badminton.dto.ts` — expect no output after this step's edit).

- [ ] **Step 7: Update the service's three field-mapping sites**

In `apps/api/src/badminton/badminton.service.ts`:

In `createSession`, the participant-create mapping becomes:
```ts
		session.participants = participants.map((d) =>
			this.participantRepo.create({
				id: randomUUID(),
				userId: d.userId,
				name: d.name,
				hoursPlayed: d.hoursPlayed ?? 1,
				shuttleWeight: d.shuttleWeight ?? 1,
				gender: d.gender,
				sessionId: session.id,
			}),
		);
```
and the `computeSplit` call's `participants` mapping becomes:
```ts
				participants: session.participants.map((p) => ({
					id: p.id,
					name: p.name,
					hoursPlayed: p.hoursPlayed,
					shuttleWeight: p.shuttleWeight,
				})),
```

In `updateSession`, the participant-replace mapping becomes:
```ts
				session.participants = participants.map((p) =>
					this.participantRepo.create({
						id: randomUUID(),
						userId: p.userId,
						name: p.name,
						hoursPlayed: p.hoursPlayed ?? 1,
						shuttleWeight: p.shuttleWeight ?? 1,
						gender: p.gender,
						sessionId: session.id,
					}),
				);
```
and its own `computeSplit` call's `participants` mapping becomes the same two-field shape as above:
```ts
					participants: session.participants.map((p) => ({
						id: p.id,
						name: p.name,
						hoursPlayed: p.hoursPlayed,
						shuttleWeight: p.shuttleWeight,
					})),
```

In `findByShareToken`, the returned `participants` mapping becomes:
```ts
			participants: session.participants.map((p) => ({
				id: p.id,
				name: p.name,
				hoursPlayed: p.hoursPlayed,
				shuttleWeight: p.shuttleWeight,
				gender: p.gender,
			})),
```

- [ ] **Step 8: Update the service spec fixtures (red → green)**

In `apps/api/src/badminton/badminton.service.spec.ts`, apply these replacements:

- In the first `it()` block ("create: sets owner, generates a share token..."), the `dto.participants` array has two entries: `{ name: 'A', shuttleFraction: 0.5 }` and `{ name: 'B', shuttleFraction: 0.5 }` → rename both to `shuttleWeight: 0.5`.
- The defaults test: rename it to `'create: applies field defaults (hoursPlayed=1, shuttleWeight=1)'` and change its body to:
  ```ts
  		const saved: any = await service.createSession('owner-1', dto);
  		const p = saved.participants[0];
  		expect(p.hoursPlayed).toBe(1);
  		expect(p.shuttleWeight).toBe(1);
  ```
- Every inline participant fixture object of the shape `{ id: ..., name: ..., courtFraction: 1, discount: 0, shuttleFraction: 1 }` (there are three: in the "recomputes the snapshot" test, the "replacement participants" test, and the "findByShareToken" test — `grep -n "courtFraction: 1," apps/api/src/badminton/badminton.service.spec.ts` finds all three) → `{ id: ..., name: ..., hoursPlayed: 1, shuttleWeight: 1 }` (drop `discount`, rename the other two).
- The three post-update assertions `expect(res.participants[0].courtFraction).toBe(1)`, `expect(res.participants[0].discount).toBe(0)`, `expect(res.participants[0].shuttleFraction).toBe(1)` → two assertions: `expect(res.participants[0].hoursPlayed).toBe(1)` and `expect(res.participants[0].shuttleWeight).toBe(1)`.

Run this before implementing Step 6/7 to see it fail against the old service, if you want the strict red-green order — since Steps 6-8 land together here, running the suite once after all three is the pragmatic checkpoint (see Step 9).

- [ ] **Step 9: Run the API test suite and typecheck**

```bash
cd apps/api && npx jest badminton && npm run check-types
```

Expected: all `badminton.*.spec.ts` suites pass, `tsc --noEmit` reports no errors.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/badminton apps/api/src/database/migrations
git commit -m "feat(api): badminton hours+weight split — entity, migration, dto, service"
```

---

### Task 3: Web layer — schema, form, player UI, share page

**Files:**
- Modify: `apps/web/src/services/badminton/types.ts`
- Modify: `apps/web/src/pages/badminton/lib/form.ts`
- Modify: `apps/web/src/pages/badminton/components/player-editor/PlayerRow.tsx`
- Modify: `apps/web/src/pages/badminton/components/player-editor/index.tsx`
- Modify: `apps/web/src/pages/badminton/share/index.tsx`

**Interfaces:**
- Consumes: Task 2's API contract — `ParticipantInput`/`SessionParticipant` now carry `hoursPlayed?: number`, `shuttleWeight?: number`, `gender?: 'male' | 'female'` (no `discount`, no `*Fraction`). Task 1's `computeSplit` (`@repo/badminton-calc`) now takes `{ id, name, hoursPlayed, shuttleWeight }` per participant.
- Produces: `EditorPlayer` shape used by `PlayerRow`/`PlayerEditor`: `{ id, userId?, name, hoursPlayed: number, shuttleWeight: number, gender?: 'male' | 'female' }`.

- [ ] **Step 1: Update the Zod schemas**

In `apps/web/src/services/badminton/types.ts`, replace `ParticipantInputSchema` with:

```ts
export const ParticipantInputSchema = z.object({
  userId: z.uuid().optional(),
  name: z.string().min(1, "Name is required").max(120),
  hoursPlayed: z.number().min(0).optional(),
  shuttleWeight: z.number().min(0).optional(),
  gender: z.enum(["male", "female"]).optional(),
})
```

and replace `SessionParticipantSchema` with:

```ts
export const SessionParticipantSchema = z.object({
  id: z.string(),
  // Guests have no account and the column is nullable, so JSON carries null.
  userId: z.string().nullish(),
  name: z.string(),
  hoursPlayed: z.number(),
  shuttleWeight: z.number(),
  gender: z.enum(["male", "female"]).nullish(),
})
```

(`ParticipantInput`/`SessionParticipant` type aliases below them are `z.infer`, so they update automatically — no manual type edits needed.)

- [ ] **Step 2: Update the form module**

Replace the full contents of `apps/web/src/pages/badminton/lib/form.ts` with:

```ts
import { computeSplit } from "@repo/badminton-calc"
import type {
  BadmintonSession,
  CreateSessionIn,
} from "@/services/badminton/types"

/** A player as edited in the form. hoursPlayed/shuttleWeight are raw units, not percentages. */
export interface EditorPlayer {
  id: string
  userId?: string
  name: string
  hoursPlayed: number
  shuttleWeight: number
  gender?: "male" | "female"
}

export interface EditorValues {
  title: string
  playedOn: string
  courtCost: number
  shuttleUnitPrice: number
  totalShuttleCount: number
  players: Array<EditorPlayer>
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

const nonNegative = (n: number) => Math.max(0, n || 0)
const wholeShuttles = (n: unknown) => Math.max(0, Math.trunc(Number(n)) || 0)
export const todayIso = () => new Date().toISOString().slice(0, 10)

/** nam:6 / nữ:4 default, per docs/badminton-splitter-spec.md §3. */
export function defaultShuttleWeight(gender?: "male" | "female"): number {
  if (gender === "male") return 6
  if (gender === "female") return 4
  return 1
}

/** Random-keyed player for client-side adds (after mount). */
export function newPlayer(name = ""): EditorPlayer {
  return {
    id: uid(),
    name,
    hoursPlayed: 1,
    shuttleWeight: 1,
  }
}

/** Deterministic-keyed player for the initial render, so SSR and client match. */
function seedPlayer(index: number): EditorPlayer {
  return {
    id: `seed-${index}`,
    name: "",
    hoursPlayed: 1,
    shuttleWeight: 1,
  }
}

export function defaultValues(): EditorValues {
  return {
    title: "",
    playedOn: todayIso(),
    courtCost: 0,
    shuttleUnitPrice: 0,
    totalShuttleCount: 0,
    players: [seedPlayer(0), seedPlayer(1)],
  }
}

export function sessionToValues(s: BadmintonSession): EditorValues {
  return {
    title: s.title ?? "",
    playedOn: s.playedOn,
    courtCost: s.courtCost,
    shuttleUnitPrice: s.shuttleUnitPrice,
    totalShuttleCount: s.totalShuttleCount,
    players: (s.participants ?? []).map((p) => ({
      id: p.id,
      userId: p.userId ?? undefined,
      name: p.name,
      hoursPlayed: p.hoursPlayed,
      shuttleWeight: p.shuttleWeight,
      gender: p.gender ?? undefined,
    })),
  }
}

export function valuesToComputed(v: EditorValues) {
  return computeSplit({
    courtCost: v.courtCost || 0,
    shuttleUnitPrice: v.shuttleUnitPrice || 0,
    totalShuttleCount: wholeShuttles(v.totalShuttleCount),
    participants: v.players.map((p) => ({
      id: p.id,
      name: p.name.trim() || "Unnamed",
      hoursPlayed: nonNegative(p.hoursPlayed),
      shuttleWeight: nonNegative(p.shuttleWeight),
    })),
  })
}

export function valuesToPayload(v: EditorValues): CreateSessionIn {
  return {
    playedOn: v.playedOn,
    title: v.title.trim() || undefined,
    courtCost: v.courtCost,
    shuttleUnitPrice: v.shuttleUnitPrice,
    totalShuttleCount: wholeShuttles(v.totalShuttleCount),
    participants: v.players.reduce<any>((acc, p) => {
      const name = p.name.trim()

      if (!name) return acc

      acc.push({
        userId: p.userId,
        name: name || "Unnamed",
        hoursPlayed: nonNegative(p.hoursPlayed),
        shuttleWeight: nonNegative(p.shuttleWeight),
        gender: p.gender,
      })

      return acc
    }, []),
  }
}

export function hasNamedPlayer(v: EditorValues): boolean {
  return v.players.some((p) => p.name.trim().length > 0)
}
```

(`clamp01` is gone — these are no longer 0..1 fractions, just non-negative numbers. `defaultShuttleWeight` is new, used by `PlayerRow` in Step 3.)

- [ ] **Step 3: Update `PlayerRow.tsx`**

Replace the "Shuttle %" and "Court %" `TableCell`s, and delete the "Discount %" `TableCell`, in `apps/web/src/pages/badminton/components/player-editor/PlayerRow.tsx`. The file's imports gain `defaultShuttleWeight` and its `Button` gets one more use (the gender toggle):

```tsx
import { TrashIcon } from "@phosphor-icons/react"
import { PlayerNameInput } from "./PlayerNameInput"
import type React from "react"
import { AddonInput as Input } from "@/components/custom/addon-input"
import { FormField } from "@/components/custom/form-field"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { defaultShuttleWeight } from "../../lib/form"

interface PlayerRowProps {
  form: any
  index: number
  canRemove: boolean
  onRemove: () => void
}

/**
 * Wire a numeric TanStack Form field to a text/number `<input>` while keeping the
 * stored value a real `number`. `input.value` is always a string, so spreading
 * the default `inputProps` stored `"3"` / `""` — which the API's `@IsInt()`/`@Min(0)`
 * validators then reject. Coerce on every change and clamp to the field's bounds.
 */
function numberFieldProps(
  field: any,
  isInvalid: boolean,
  {
    integer = false,
    min,
    max,
  }: { integer?: boolean; min?: number; max?: number } = {}
) {
  return {
    name: field.name,
    "aria-invalid": isInvalid,
    value: field.state.value ?? "",
    onBlur: field.handleBlur,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      let n = e.target.valueAsNumber
      if (Number.isNaN(n)) n = min ?? 0
      if (integer) n = Math.trunc(n)
      if (min !== undefined) n = Math.max(min, n)
      if (max !== undefined) n = Math.min(max, n)
      field.handleChange(n)
    },
  }
}

export function PlayerRow({
  form,
  index,
  canRemove,
  onRemove,
}: PlayerRowProps) {
  const base = `players[${index}]`
  return (
    <TableRow key={base}>
      <TableCell>
        <FormField form={form} label="Name" name={`${base}.name`}>
          {({ field, isInvalid }) => (
            <PlayerNameInput
              id={`${base}-name`}
              name={field.name}
              value={field.state.value ?? ""}
              onValueChange={(next) => {
                field.handleChange(next)

                form.setFieldValue(`${base}.userId`, undefined)
              }}
              onPickUser={(userId, pickedName) => {
                field.handleChange(pickedName)
                form.setFieldValue(`${base}.userId`, userId)
              }}
              onBlur={field.handleBlur}
              aria-invalid={isInvalid}
            />
          )}
        </FormField>
      </TableCell>

      <TableCell>
        <FormField
          form={form}
          label="Hours played"
          name={`${base}.hoursPlayed`}
        >
          {({ field, isInvalid }) => (
            <Input
              id={`${base}-hours`}
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              endAddon="h"
              className="text-right tabular-nums"
              {...numberFieldProps(field, isInvalid, { min: 0 })}
            />
          )}
        </FormField>
      </TableCell>

      <TableCell>
        <div className="stack-row items-end gap-2">
          <FormField
            form={form}
            label="Shuttle weight"
            name={`${base}.shuttleWeight`}
          >
            {({ field, isInvalid }) => (
              <Input
                id={`${base}-shuttle-weight`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className="text-right tabular-nums"
                {...numberFieldProps(field, isInvalid, { min: 0 })}
              />
            )}
          </FormField>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              form.setFieldValue(`${base}.gender`, "male")
              form.setFieldValue(`${base}.shuttleWeight`, defaultShuttleWeight("male"))
            }}
          >
            Nam
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              form.setFieldValue(`${base}.gender`, "female")
              form.setFieldValue(`${base}.shuttleWeight`, defaultShuttleWeight("female"))
            }}
          >
            Nữ
          </Button>
        </div>
      </TableCell>

      <TableCell className="align-bottom">
        <Button
          type="button"
          variant="destructive"
          size="icon"
          aria-label="Remove player"
          onClick={onRemove}
          disabled={!canRemove}
        >
          <TrashIcon />
        </Button>
      </TableCell>
    </TableRow>
  )
}
```

- [ ] **Step 4: Update the table headers in `player-editor/index.tsx`**

In `apps/web/src/pages/badminton/components/player-editor/index.tsx`, replace:

```tsx
                <TableCell className="text-right">Shuttle %</TableCell>
                <TableCell className="text-right">Court %</TableCell>
                <TableCell className="text-right">Discount %</TableCell>
```

with:

```tsx
                <TableCell className="text-right">Hours played</TableCell>
                <TableCell className="text-right">Shuttle weight</TableCell>
```

(Matches the new column order from Step 3: hours first, then shuttle weight + gender toggle.)

- [ ] **Step 5: Update the share page's recompute fallback**

In `apps/web/src/pages/badminton/share/index.tsx`, replace the `participants` mapping inside `toComputed`:

```ts
    participants: session.participants.map((p) => ({
      id: p.id,
      name: p.name,
      hoursPlayed: p.hoursPlayed,
      shuttleWeight: p.shuttleWeight,
    })),
```

- [ ] **Step 6: Typecheck**

```bash
cd apps/web && npm run check-types
```

Expected: no errors. If any remain, they're almost certainly a leftover `courtFraction`/`shuttleFraction`/`discount`/`*Percent` reference this plan missed — grep for those four strings under `apps/web/src` and fix in place.

- [ ] **Step 7: Manual smoke test in the browser**

```bash
# from repo root, with the API running separately (npm run dev --workspace api)
npm run dev --workspace web
```

Open the app, sign in, go to `/badminton/new`:
1. Set Court cost = 150,000, Shuttle unit price = 1,000, Total shuttles = 20.
2. Add two players. Player 1: hours = 2, click "Nam" (shuttle weight should snap to 6). Player 2: hours = 2, click "Nữ" (shuttle weight should snap to 4).
3. Confirm the live preview table shows Player 1 paying more than Player 2 (higher shuttle weight, equal hours) and no "Discount %" column anywhere.
4. Save, then open the session's public share link and confirm the same numbers render there.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/services/badminton/types.ts apps/web/src/pages/badminton
git commit -m "feat(web): badminton hours+weight split UI"
```

---

## Self-Review Notes

- **Spec coverage:** §3 (court=hours, shuttle=weight-class, discount removed) → Tasks 1-3. §4 (entity fields) → Task 2 Step 3. §5 (algorithm) → Task 1 Step 5. §6 (editor UI description) → Task 3 Steps 3-4. §7 (validation: non-negative, no discount) → Task 2 Step 6 (DTO), Task 3 Step 1 (Zod). Dead-code cleanup found during design → Task 1 Steps 1-2, Task 2 Steps 1-2.
- **Type consistency check:** `CalcParticipant`/`CalcInput` (Task 1) → service's `computeSplit` calls (Task 2 Step 7) → web's `valuesToComputed`/share fallback (Task 3 Steps 2, 5) all use the same two field names, `hoursPlayed`/`shuttleWeight`, with no drift.
- **No placeholders:** every step above shows the literal file content or command to run; none deferred to "similar to Task N."
