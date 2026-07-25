import { CalcInput, computeSplit } from './badminton.calc';

const AT = '2026-07-25T00:00:00.000Z';

const p = (
  id: string,
  overrides: Partial<{
    courtFraction: number;
    discount: number;
    shuttleCount: number;
  }> = {},
) => ({
  id,
  name: id,
  courtFraction: overrides.courtFraction ?? 1,
  discount: overrides.discount ?? 0,
  shuttleCount: overrides.shuttleCount ?? 0,
});

describe('computeSplit', () => {
  it('derives shuttle cost from unit price × total count', () => {
    const input: CalcInput = {
      courtCost: 100_000,
      shuttleUnitPrice: 1_000,
      participants: [p('A', { shuttleCount: 10 }), p('B', { shuttleCount: 10 })],
    };
    const out = computeSplit(input, AT);
    expect(out.shuttleCost).toBe(20_000);
    expect(out.grandTotal).toBe(120_000);
  });

  it('splits an even, no-discount session exactly', () => {
    const input: CalcInput = {
      courtCost: 100_000,
      shuttleUnitPrice: 1_000,
      participants: [p('A', { shuttleCount: 10 }), p('B', { shuttleCount: 10 })],
    };
    const out = computeSplit(input, AT);
    expect(out.rows).toEqual([
      { participantId: 'A', name: 'A', court: 50_000, shuttle: 10_000, total: 60_000 },
      { participantId: 'B', name: 'B', court: 50_000, shuttle: 10_000, total: 60_000 },
    ]);
    expect(out.roundingResidual).toBe(0);
  });

  it('redistributes a whole-bill discount onto other players (total preserved)', () => {
    const input: CalcInput = {
      courtCost: 100_000,
      shuttleUnitPrice: 1_000,
      participants: [
        p('A', { shuttleCount: 10 }),
        p('B', { shuttleCount: 10, discount: 0.5 }),
      ],
    };
    const out = computeSplit(input, AT);
    // fair = 60k each; B at 50% → eff 60k/30k, scale = 120k/90k = 4/3
    // A = 80k, B = 40k
    expect(out.rows.find((r) => r.participantId === 'A')!.total).toBe(80_000);
    expect(out.rows.find((r) => r.participantId === 'B')!.total).toBe(40_000);
    // discount is on the WHOLE bill: B pays less than A on both dimensions
    const a = out.rows.find((r) => r.participantId === 'A')!;
    const b = out.rows.find((r) => r.participantId === 'B')!;
    expect(b.total).toBeLessThan(a.total);
    expect(a.court + a.shuttle).toBe(a.total);
    expect(b.court + b.shuttle).toBe(b.total);
  });

  it('excludes fraction=0 from court and count=0 from shuttle', () => {
    const input: CalcInput = {
      courtCost: 90_000,
      shuttleUnitPrice: 1_000,
      participants: [
        p('Player', { courtFraction: 1, shuttleCount: 10 }),
        p('CourtOnly', { courtFraction: 1, shuttleCount: 0 }),
        p('ShuttleOnly', { courtFraction: 0, shuttleCount: 10 }),
      ],
    };
    const out = computeSplit(input, AT);
    const shuttleOnly = out.rows.find((r) => r.participantId === 'ShuttleOnly')!;
    const courtOnly = out.rows.find((r) => r.participantId === 'CourtOnly')!;
    expect(shuttleOnly.court).toBe(0); // fraction 0 → no court
    expect(courtOnly.shuttle).toBe(0); // count 0 → no shuttle
  });

  it('applies time-proportional court split', () => {
    const input: CalcInput = {
      courtCost: 100_000,
      shuttleUnitPrice: 0,
      participants: [
        p('Full', { courtFraction: 1, shuttleCount: 0 }),
        p('Half', { courtFraction: 0.5, shuttleCount: 0 }),
      ],
    };
    const out = computeSplit(input, AT);
    // court weights 1 : 0.5 → 66,667 : 33,333, rounded to 1,000 → 67,000 : 33,000
    const full = out.rows.find((r) => r.participantId === 'Full')!;
    const half = out.rows.find((r) => r.participantId === 'Half')!;
    expect(full.total).toBeGreaterThan(half.total);
    expect(full.total + half.total).toBe(out.grandTotal);
  });

  describe('reconciliation invariants (property-style)', () => {
    const cases: CalcInput[] = [
      {
        courtCost: 150_000,
        shuttleUnitPrice: 4_583,
        participants: [
          p('Lam', { shuttleCount: 10 }),
          p('Dat', { shuttleCount: 10 }),
          p('Kien', { shuttleCount: 10 }),
          p('Thai', { shuttleCount: 10 }),
          p('Hieu', { shuttleCount: 8 }),
          p('Truong', { shuttleCount: 8 }),
          p('Trang', { shuttleCount: 8, discount: 0.15 }),
          p('Giang', { shuttleCount: 8, discount: 0.15 }),
        ],
      },
      {
        courtCost: 237_777,
        shuttleUnitPrice: 3_111,
        participants: [
          p('A', { courtFraction: 0.3, shuttleCount: 5, discount: 0.1 }),
          p('B', { courtFraction: 1, shuttleCount: 12 }),
          p('C', { courtFraction: 0.75, shuttleCount: 0, discount: 0.2 }),
          p('D', { courtFraction: 1, shuttleCount: 7 }),
          p('E', { courtFraction: 0, shuttleCount: 3 }),
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
        // residual is the gap between exact expense and the 1,000-rounded collection
        expect(out.roundingResidual).toBe(
          out.courtCost + out.shuttleCost - out.grandTotal,
        );
      },
    );
  });

  it('handles the empty-session and all-discounted edge cases without throwing', () => {
    expect(
      computeSplit(
        { courtCost: 50_000, shuttleUnitPrice: 1_000, participants: [] },
        AT,
      ).rows,
    ).toEqual([]);

    const allFree = computeSplit(
      {
        courtCost: 50_000,
        shuttleUnitPrice: 1_000,
        participants: [p('A', { shuttleCount: 5, discount: 1 })],
      },
      AT,
    );
    // 100% discount → collects nothing; whole expense is the residual
    expect(allFree.rows[0].total).toBe(0);
    expect(allFree.roundingResidual).toBe(allFree.courtCost + allFree.shuttleCost);
  });
});
