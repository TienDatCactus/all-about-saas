import { NotFoundException } from '@nestjs/common';
import { TeachingSessionsService } from './teaching-sessions.service';

function mockRepo() {
	return {
		find: jest.fn(async () => []),
		findOne: jest.fn(),
		save: jest.fn(async (x: unknown) => x),
		create: jest.fn((x: unknown) => x),
	};
}

describe('TeachingSessionsService', () => {
	it('findInRange scopes to ownerId and the date range, ordered by date then start time', async () => {
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const studentsService = { findOrCreate: jest.fn() };
		const service = new TeachingSessionsService(
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		await service.findInRange('owner-1', '2026-09-08', '2026-09-14');

		expect(sessionRepo.find).toHaveBeenCalledWith({
			where: { ownerId: 'owner-1', scheduledDate: expect.anything() },
			relations: { student: true },
			order: { scheduledDate: 'ASC', startTime: 'ASC' },
		});
	});

	it('pendingToday only returns SCHEDULED sessions for today, HIGH priority first', async () => {
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const studentsService = { findOrCreate: jest.fn() };
		const service = new TeachingSessionsService(
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);
		const today = new Date().toISOString().slice(0, 10);

		await service.pendingToday('owner-1');

		expect(sessionRepo.find).toHaveBeenCalledWith({
			where: { ownerId: 'owner-1', scheduledDate: today, status: 'scheduled' },
			relations: { student: true },
			// Postgres enum values sort by declaration order, not alphabetically —
			// SessionPriority is declared LOW, NORMAL, HIGH, so DESC puts HIGH first.
			order: { priority: 'DESC', startTime: 'ASC' },
		});
	});

	it('history is scoped by owner-verified session ownership, newest first', async () => {
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		sessionRepo.findOne.mockResolvedValue({ id: 'sess-1', ownerId: 'owner-1' });
		const studentsService = { findOrCreate: jest.fn() };
		const service = new TeachingSessionsService(
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		await service.history('owner-1', 'sess-1');

		expect(sessionRepo.findOne).toHaveBeenCalledWith({
			where: { id: 'sess-1', ownerId: 'owner-1' },
		});
		expect(historyRepo.find).toHaveBeenCalledWith({
			where: { sessionId: 'sess-1' },
			order: { createdAt: 'DESC' },
		});
	});

	it('history rejects with NotFoundException if session not found (guards against cross-tenant disclosure)', async () => {
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		sessionRepo.findOne.mockResolvedValue(null);
		const studentsService = { findOrCreate: jest.fn() };
		const service = new TeachingSessionsService(
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		await expect(service.history('owner-1', 'sess-1')).rejects.toThrow(
			new NotFoundException('Session not found'),
		);
		expect(historyRepo.find).not.toHaveBeenCalled();
	});

	it('createAdHoc resolves studentName via findOrCreate and makes an EXTRA, slotless, SCHEDULED session plus a CREATED history row', async () => {
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const studentsService = { findOrCreate: jest.fn(async () => ({ id: 's1', ownerId: 'owner-1', name: 'An' })) };
		const service = new TeachingSessionsService(sessionRepo as never, historyRepo as never, studentsService as never);

		const session = await service.createAdHoc('owner-1', {
			studentName: 'An', scheduledDate: '2026-09-20', startTime: '10:00', endTime: '11:00',
		});

		expect(studentsService.findOrCreate).toHaveBeenCalledWith('owner-1', 'An');
		expect(sessionRepo.create).toHaveBeenCalledWith(
			expect.objectContaining({
				ownerId: 'owner-1', studentId: 's1', slotId: null, type: 'extra', status: 'scheduled',
			}),
		);
		expect(historyRepo.save).toHaveBeenCalledWith(
			expect.objectContaining({ sessionId: session.id, action: 'created' }),
		);
	});
});
