import { buildWriteTools } from './write-tools';

describe('buildWriteTools', () => {
	it('createBadmintonSession returns a draft, never writes', async () => {
		const tools = buildWriteTools();
		const args = {
			playedOn: '2026-09-10',
			courtCost: 200_000,
			shuttleUnitPrice: 12_000,
			totalShuttleCount: 10,
			participants: [{ name: 'An' }, { name: 'Binh' }],
		};

		// `as any`: ToolExecutionOptions requires a `context` field this test
		// doesn't need — same harmless cast Task 5's read-tools.spec.ts uses for
		// the identical reason (verified against @ai-sdk/provider-utils's types).
		const result = await tools.createBadmintonSession.execute!(args, {
			toolCallId: 't1',
			messages: [],
		} as any);

		expect(result).toEqual({
			requiresConfirmation: true,
			action: 'createBadmintonSession',
			args,
			summary: expect.stringContaining('2026-09-10'),
		});
	});

	it('setParticipantPaid returns a draft, never writes', async () => {
		const tools = buildWriteTools();
		const args = { sessionId: 's1', participantId: 'p1', paid: true };

		const result = await tools.setParticipantPaid.execute!(args, {
			toolCallId: 't2',
			messages: [],
		} as any);

		expect(result).toEqual({
			requiresConfirmation: true,
			action: 'setParticipantPaid',
			args,
			summary: expect.stringContaining('paid'),
		});
	});
});
