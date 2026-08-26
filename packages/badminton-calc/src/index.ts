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
