import { NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatMessageRole, ToolCallState } from './entities/chat-message.entity';

function mockRepo() {
	return {
		findOne: jest.fn(),
		save: jest.fn(async (x: unknown) => x),
		create: jest.fn((x: unknown) => x),
	};
}

/** Mirrors `apps/api/src/badminton/badminton.service.spec.ts`'s `mockDataSource()` —
 *  `transaction()` runs the callback against a shared manager, which is the seam
 *  `confirmAction`'s pessimistic-locked read goes through. */
function mockDataSource() {
	const manager = {
		findOne: jest.fn(),
		save: jest.fn(async (x: unknown) => x),
		create: jest.fn((_entity: unknown, x: unknown) => x),
	};
	const dataSource = {
		transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
	};
	return { manager, dataSource };
}

describe('ChatService', () => {
	let chatMessageRepo: ReturnType<typeof mockRepo>;
	let badmintonService: {
		createSession: jest.Mock;
		setParticipantPaid: jest.Mock;
	};
	let ragService: { search: jest.Mock };
	let manager: ReturnType<typeof mockDataSource>['manager'];
	let dataSource: ReturnType<typeof mockDataSource>['dataSource'];
	let service: ChatService;

	beforeEach(() => {
		chatMessageRepo = mockRepo();
		badmintonService = {
			createSession: jest.fn(),
			setParticipantPaid: jest.fn(),
		};
		ragService = { search: jest.fn() };
		({ manager, dataSource } = mockDataSource());
		service = new ChatService(
			chatMessageRepo as never,
			badmintonService as never,
			ragService as never,
			dataSource as never,
		);
	});

	describe('getPendingAction', () => {
		it('reports nothing pending when the last message is not pending', async () => {
			chatMessageRepo.findOne.mockResolvedValue(null);
			await expect(
				service.getPendingAction('user-1', 'thread-1'),
			).resolves.toEqual({
				pending: false,
			});
		});

		it('reports the summary of a pending row', async () => {
			chatMessageRepo.findOne.mockResolvedValue({
				toolCallState: ToolCallState.PENDING,
				content: 'Create a session on 2026-09-10 with 2 participants',
				createdAt: new Date(),
			});
			await expect(
				service.getPendingAction('user-1', 'thread-1'),
			).resolves.toEqual({
				pending: true,
				summary: 'Create a session on 2026-09-10 with 2 participants',
			});
		});

		it('reports nothing pending once the row is past its 15-minute window', async () => {
			chatMessageRepo.findOne.mockResolvedValue({
				toolCallState: ToolCallState.PENDING,
				content: 'stale',
				createdAt: new Date(Date.now() - 16 * 60 * 1000),
			});
			await expect(
				service.getPendingAction('user-1', 'thread-1'),
			).resolves.toEqual({
				pending: false,
			});
		});
	});

	describe('confirmAction', () => {
		it('rejects when there is no pending row', async () => {
			manager.findOne.mockResolvedValue(null);
			await expect(
				service.confirmAction('user-1', {
					threadId: 'thread-1',
					approve: true,
				}),
			).rejects.toThrow(NotFoundException);
		});

		it('rejects and flips state to rejected when the pending row is past its 15-minute window', async () => {
			manager.findOne.mockResolvedValue({
				id: 'msg-1',
				toolCallState: ToolCallState.PENDING,
				toolCall: { name: 'createBadmintonSession', args: {} },
				createdAt: new Date(Date.now() - 16 * 60 * 1000),
			});

			await expect(
				service.confirmAction('user-1', {
					threadId: 'thread-1',
					approve: true,
				}),
			).rejects.toThrow(NotFoundException);
			expect(badmintonService.createSession).not.toHaveBeenCalled();
			expect(manager.save).toHaveBeenCalledWith(
				expect.objectContaining({ toolCallState: ToolCallState.REJECTED }),
			);
		});

		it('executes createBadmintonSession, flips state to executed, and appends a tool message', async () => {
			manager.findOne.mockResolvedValue({
				id: 'msg-1',
				threadId: 'thread-1',
				toolCallState: ToolCallState.PENDING,
				toolCall: {
					name: 'createBadmintonSession',
					args: { playedOn: '2026-09-10', participants: [] },
				},
				createdAt: new Date(),
			});
			badmintonService.createSession.mockResolvedValue({ id: 'session-1' });

			const result = await service.confirmAction('user-1', {
				threadId: 'thread-1',
				approve: true,
			});

			// Pessimistic lock is the double-confirm-race guard — a mock can't prove
			// the lock actually serializes concurrent transactions, but it can prove
			// the code asks for one.
			expect(manager.findOne).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
			);
			expect(badmintonService.createSession).toHaveBeenCalledWith('user-1', {
				playedOn: '2026-09-10',
				participants: [],
			});
			// Two saves: the pending row flipped to executed, and the new tool-role
			// audit message.
			expect(manager.save).toHaveBeenCalledWith(
				expect.objectContaining({ toolCallState: ToolCallState.EXECUTED }),
			);
			expect(manager.save).toHaveBeenCalledWith(
				expect.objectContaining({
					role: ChatMessageRole.TOOL,
					content: expect.stringContaining('session-1'),
				}),
			);
			expect(result.message).toContain('session-1');
			expect(result.toolCallState).toBe(ToolCallState.EXECUTED);
		});

		it('flips state to rejected without calling the domain service when approve is false', async () => {
			manager.findOne.mockResolvedValue({
				id: 'msg-1',
				toolCallState: ToolCallState.PENDING,
				toolCall: {
					name: 'setParticipantPaid',
					args: { sessionId: 's1', participantId: 'p1', paid: true },
				},
				createdAt: new Date(),
			});

			const result = await service.confirmAction('user-1', {
				threadId: 'thread-1',
				approve: false,
			});

			expect(badmintonService.setParticipantPaid).not.toHaveBeenCalled();
			expect(manager.save).toHaveBeenCalledWith(
				expect.objectContaining({ toolCallState: ToolCallState.REJECTED }),
			);
			expect(result.message).toMatch(/cancel/i);
		});
	});
});
