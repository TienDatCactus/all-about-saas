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
			participants: [
				p('A', { shuttleWeight: 1 }),
				p('B', { shuttleWeight: 1 }),
			],
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
			participants: [
				p('A', { shuttleWeight: 1 }),
				p('B', { shuttleWeight: 1 }),
			],
		};
		const out = computeSplit(input, AT);
		expect(out.rows).toEqual([
			{
				participantId: 'A',
				name: 'A',
				court: 50_000,
				shuttle: 10_000,
				total: 60_000,
			},
			{
				participantId: 'B',
				name: 'B',
				court: 50_000,
				shuttle: 10_000,
				total: 60_000,
			},
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
		const shuttleOnly = out.rows.find(
			(r) => r.participantId === 'ShuttleOnly',
		)!;
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

	it('documents that a zero-hoursPlayed session absorbs the entire court pot into roundingResidual (not just a rounding remainder)', () => {
		const input: CalcInput = {
			courtCost: 100_000,
			shuttleUnitPrice: 1_000,
			totalShuttleCount: 20,
			participants: [
				p('A', { hoursPlayed: 0, shuttleWeight: 1 }),
				p('B', { hoursPlayed: 0, shuttleWeight: 1 }),
			],
		};
		const out = computeSplit(input, AT);
		const totalCollected = out.rows.reduce((a, r) => a + r.total, 0);
		expect(totalCollected).toBe(20_000);
		expect(out.grandTotal).toBe(120_000);
		expect(out.roundingResidual).toBe(100_000);
	});

	it('handles the empty-session and zero-weight edge cases without throwing', () => {
		expect(
			computeSplit(
				{
					courtCost: 50_000,
					shuttleUnitPrice: 1_000,
					totalShuttleCount: 0,
					participants: [],
				},
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
