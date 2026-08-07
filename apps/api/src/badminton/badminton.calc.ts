import type { ComputedRow, ComputedSnapshot } from './types/computed-snapshot';

/**
 * Split-calculation inputs. Pure data — no entity/ORM coupling, so this function
 * can move to a shared `packages/badminton-calc` later and be reused by the web app.
 */
export interface CalcParticipant {
	/** Stable id used to key the output row back to the participant. */
	id: string;
	name: string;
	/** Played fraction of the session, 0..1. Drives the time-proportional court split. */
	courtFraction: number;
	/** Whole-bill discount, 0..1 (e.g. 0.15). Redistributed onto other players. */
	discount: number;
	/** This player's weight for the shared shuttle pot, 0..1. Split works like courtFraction. */
	shuttleFraction: number;
}

export interface CalcInput {
	/** Court cost, VND. */
	courtCost: number;
	/** Price per shuttle, VND. */
	shuttleUnitPrice: number;
	/** Total shuttles used in the session (shared pot). shuttleCost = shuttleUnitPrice × this. */
	totalShuttleCount: number;
	participants: CalcParticipanArray<T>;
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
 *  - Court fee is split time-proportionally by `courtFraction`.
 *  - Shuttle fee is a shared pot (shuttleCost = unitPrice × totalShuttleCount) split by
 *    each player's `shuttleFraction` weight — exactly like the court split.
 *  - A player's discount reduces their WHOLE bill (court + shuttle); the shortfall is
 *    redistributed proportionally onto everyone via a single rescale, so the collected
 *    amount still equals the expense.
 *  - Each player's total is rounded to the nearest 1,000 VND using the largest-remainder
 *    method, guaranteeing Σ(rounded totals) === round(expense) exactly.
 *
 * `computedAt` is injected (not read from the clock) to keep this function pure/testable.
 */
export function computeSplit(
	input: CalcInput,
	computedAt: string,
): ComputedSnapshot {
	const { courtCost, shuttleUnitPrice, totalShuttleCount, participants } =
		input;

	const shuttleCost = shuttleUnitPrice * totalShuttleCount;
	const expense = courtCost + shuttleCost;
	const grandTotal = roundToUnit(expense);

	if (participants.length === 0) {
		return {
			courtCost,
			shuttleCost,
			grandTotal,
			rows: [],
			roundingResidual: expense - 0,
			computedAt,
		};
	}

	const totalFraction = sum(participants.map((p) => p.courtFraction));
	const totalShuttleFraction = sum(participants.map((p) => p.shuttleFraction));

	// Undiscounted fair share per player, and its court/shuttle breakdown. Both the
	// court pot and the shuttle pot are split by each player's respective weight.
	const fair = participants.map((p) => {
		const court =
			totalFraction === 0 ? 0 : (courtCost * p.courtFraction) / totalFraction;
		const shuttle =
			totalShuttleFraction === 0
				? 0
				: (shuttleCost * p.shuttleFraction) / totalShuttleFraction;
		return { court, shuttle, total: court + shuttle };
	});

	// Whole-bill discount, redistributed by a single rescale so Σ === expense.
	const eff = participants.map((p, i) => fair[i].total * (1 - p.discount));
	const totalEff = sum(eff);
	const scale = totalEff === 0 ? 0 : expense / totalEff;
	const rawTotal = eff.map((e) => e * scale);

	// Largest-remainder rounding of the per-player total to 1,000 VND. The target is
	// what's actually collectable (Σ rawTotal) — equal to round(expense) in every normal
	// case, but 0 in the degenerate "everyone fully discounted" case, so we don't invent
	// a payment nobody owes.
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

	// Split each rounded total back into court/shuttle for display, preserving the
	// pre-discount court:shuttle ratio. court + shuttle === total per row.
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
