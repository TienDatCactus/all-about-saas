import { tool } from 'ai';
import { z } from 'zod';

export interface PendingAction {
	requiresConfirmation: true;
	action: 'createBadmintonSession' | 'setParticipantPaid';
	args: Record<string, unknown>;
	summary: string;
}

const createBadmintonSessionInput = z.object({
	playedOn: z.string().describe('YYYY-MM-DD'),
	title: z.string().max(120).optional(),
	courtCost: z.number().int().min(0),
	shuttleUnitPrice: z.number().int().min(0),
	totalShuttleCount: z.number().int().min(0),
	participants: z
		.array(
			z.object({
				name: z.string().max(120),
				hoursPlayed: z.number().min(0).optional(),
				shuttleWeight: z.number().min(0).max(10).optional(),
			}),
		)
		.min(1),
});

const setParticipantPaidInput = z.object({
	sessionId: z.string().uuid(),
	participantId: z.string().uuid(),
	paid: z.boolean(),
});

/** Every tool here only drafts an action — `ChatService.onFinish` persists the
 *  draft as `pending`, and only `POST /ai/chat/confirm` may execute it. */
export function buildWriteTools() {
	return {
		createBadmintonSession: tool({
			description:
				'Propose creating a new badminton session. This does NOT save anything — tell the user what you are about to create and that they must confirm.',
			inputSchema: createBadmintonSessionInput,
			execute: async (args): Promise<PendingAction> => ({
				requiresConfirmation: true,
				action: 'createBadmintonSession',
				args,
				summary: `Create a session on ${args.playedOn} with ${args.participants.length} participant(s), court cost ${args.courtCost}₫`,
			}),
		}),

		setParticipantPaid: tool({
			description:
				'Propose marking a participant as paid or unpaid. This does NOT save anything — the user must confirm.',
			inputSchema: setParticipantPaidInput,
			execute: async (args): Promise<PendingAction> => ({
				requiresConfirmation: true,
				action: 'setParticipantPaid',
				args,
				summary: `Mark the participant as ${args.paid ? 'paid' : 'unpaid'}`,
			}),
		}),
	};
}
