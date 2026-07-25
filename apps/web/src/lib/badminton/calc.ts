import type {
  ComputedRow,
  ComputedSnapshot,
} from "@/services/badminton/types";

/**
 * Client-side port of the split algorithm for INSTANT preview while editing.
 * The server (apps/api/src/badminton/badminton.calc.ts) stays canonical and
 * recomputes on save — keep these two in sync. (TODO: extract to a shared
 * packages/badminton-calc consumed by both.)
 */

export interface CalcParticipant {
  id: string;
  name: string;
  courtFraction: number; // 0..1
  discount: number; // 0..1
  shuttleCount: number; // whole shuttles
}

export interface CalcInput {
  courtCost: number;
  shuttleUnitPrice: number;
  participants: CalcParticipant[];
}

const ROUND_UNIT = 1000;

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

const roundToUnit = (x: number): number =>
  Math.round(x / ROUND_UNIT) * ROUND_UNIT;

export function computeSplit(
  input: CalcInput,
  computedAt: string = new Date().toISOString(),
): ComputedSnapshot {
  const { courtCost, shuttleUnitPrice, participants } = input;

  const totalCount = sum(participants.map((p) => p.shuttleCount));
  const shuttleCost = shuttleUnitPrice * totalCount;
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

  const totalFraction = sum(participants.map((p) => p.courtFraction));

  // Undiscounted fair share + its court/shuttle breakdown.
  const fair = participants.map((p) => {
    const court =
      totalFraction === 0 ? 0 : (courtCost * p.courtFraction) / totalFraction;
    const shuttle =
      totalCount === 0 ? 0 : (shuttleCost * p.shuttleCount) / totalCount;
    return { court, shuttle, total: court + shuttle };
  });

  // Whole-bill discount redistributed by a single rescale so Σ === expense.
  const eff = participants.map((p, i) => fair[i].total * (1 - p.discount));
  const totalEff = sum(eff);
  const scale = totalEff === 0 ? 0 : expense / totalEff;
  const rawTotal = eff.map((e) => e * scale);

  // Largest-remainder rounding of each total to 1,000 VND, targeting what's
  // actually collectable (Σ rawTotal) so a fully-discounted table collects 0.
  const collectTarget = roundToUnit(sum(rawTotal));
  const base = rawTotal.map((t) => Math.floor(t / ROUND_UNIT) * ROUND_UNIT);
  let increments = Math.round((collectTarget - sum(base)) / ROUND_UNIT);
  increments = Math.max(0, Math.min(participants.length, increments));

  const order = rawTotal
    .map((t, i) => ({ i, remainder: t - base[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);

  const roundedTotal = base.slice();
  for (let k = 0; k < increments; k++) {
    roundedTotal[order[k].i] += ROUND_UNIT;
  }

  const rows: ComputedRow[] = participants.map((p, i) => {
    const total = roundedTotal[i];
    const fairTotal = fair[i].total;
    const court =
      fairTotal === 0 ? 0 : Math.round((total * fair[i].court) / fairTotal);
    const shuttle = total - court;
    return { participantId: p.id, name: p.name, court, shuttle, total };
  });

  return {
    courtCost,
    shuttleCost,
    grandTotal,
    rows,
    roundingResidual: expense - sum(roundedTotal),
    computedAt,
  };
}
