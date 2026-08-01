/**
 * Frozen result of the split calculation, stored on {@link BadmintonSession.computed}
 * and served to the public share link so the numbers never recompute / drift.
 *
 * NOTE: this is the canonical output shape of the split algorithm. Once the shared
 * `packages/badminton-calc` package exists, this type should move there and be
 * imported by both the API and the web app. It lives here for now so the entity
 * has a type to reference while we build the schema first.
 */

/** One player's rounded share of one session. All amounts are whole VND. */
export interface ComputedRow {
	participantId: string;
	name: string;
	court: number;
	shuttle: number;
	total: number;
}

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
