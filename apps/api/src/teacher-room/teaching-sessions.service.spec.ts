import { NotFoundException } from '@nestjs/common';
import { SessionPriority } from './entities/teaching-session.entity';
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
		const studentsService = {
			findOrCreate: jest.fn(async () => ({
				id: 's1',
				ownerId: 'owner-1',
				name: 'An',
			})),
		};
		const service = new TeachingSessionsService(
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		const session = await service.createAdHoc('owner-1', {
			studentName: 'An',
			scheduledDate: '2026-09-20',
			startTime: '10:00',
			endTime: '11:00',
		});

		expect(studentsService.findOrCreate).toHaveBeenCalledWith('owner-1', 'An');
		expect(sessionRepo.create).toHaveBeenCalledWith(
			expect.objectContaining({
				ownerId: 'owner-1',
				studentId: 's1',
				slotId: null,
				type: 'extra',
				status: 'scheduled',
			}),
		);
		expect(historyRepo.save).toHaveBeenCalledWith(
			expect.objectContaining({ sessionId: session.id, action: 'created' }),
		);
	});

	it('reschedule moves the date, flips REGULAR to MAKEUP, keeps SCHEDULED, and logs from/to', async () => {
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		sessionRepo.findOne.mockResolvedValue({
			id: 'sess-1',
			ownerId: 'owner-1',
			scheduledDate: '2026-09-15',
			type: 'regular',
			status: 'scheduled',
		});
		const studentsService = { findOrCreate: jest.fn() };
		const service = new TeachingSessionsService(
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		const updated = await service.reschedule('owner-1', 'sess-1', {
			newDate: '2026-09-17',
			note: 'ốm',
		});

		expect(updated).toEqual(
			expect.objectContaining({
				scheduledDate: '2026-09-17',
				type: 'makeup',
				status: 'scheduled',
			}),
		);
		expect(historyRepo.save).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: 'sess-1',
				action: 'rescheduled',
				fromDate: '2026-09-15',
				toDate: '2026-09-17',
				note: 'ốm',
			}),
		);
	});

	it("reschedule leaves an already-MAKEUP or EXTRA session's type unchanged", async () => {
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		sessionRepo.findOne.mockResolvedValue({
			id: 'sess-2',
			ownerId: 'owner-1',
			scheduledDate: '2026-09-15',
			type: 'extra',
			status: 'scheduled',
		});
		const studentsService = { findOrCreate: jest.fn() };
		const service = new TeachingSessionsService(
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		const updated = await service.reschedule('owner-1', 'sess-2', {
			newDate: '2026-09-18',
		});

		expect(updated.type).toBe('extra');
	});

	it('cancel sets status CANCELLED and logs it', async () => {
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		sessionRepo.findOne.mockResolvedValue({
			id: 'sess-1',
			ownerId: 'owner-1',
			status: 'scheduled',
		});
		const studentsService = { findOrCreate: jest.fn() };
		const service = new TeachingSessionsService(
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		const updated = await service.cancel('owner-1', 'sess-1', { note: 'nghỉ' });

		expect(updated.status).toBe('cancelled');
		expect(historyRepo.save).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: 'sess-1',
				action: 'cancelled',
				note: 'nghỉ',
			}),
		);
	});

	it('complete sets status COMPLETED, stamps confirmedAt, and logs it', async () => {
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		sessionRepo.findOne.mockResolvedValue({
			id: 'sess-1',
			ownerId: 'owner-1',
			status: 'scheduled',
			confirmedAt: null,
		});
		const studentsService = { findOrCreate: jest.fn() };
		const service = new TeachingSessionsService(
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		const updated = await service.complete('owner-1', 'sess-1', {});

		expect(updated.status).toBe('completed');
		expect(updated.confirmedAt).toBeInstanceOf(Date);
		expect(historyRepo.save).toHaveBeenCalledWith(
			expect.objectContaining({ sessionId: 'sess-1', action: 'completed' }),
		);
	});

	it('reopen sets status SCHEDULED, clears confirmedAt, and logs REOPENED', async () => {
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		sessionRepo.findOne.mockResolvedValue({
			id: 'sess-1',
			ownerId: 'owner-1',
			status: 'completed',
			confirmedAt: new Date('2026-09-08'),
		});
		const studentsService = { findOrCreate: jest.fn() };
		const service = new TeachingSessionsService(
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		const updated = await service.reopen('owner-1', 'sess-1', {});

		expect(updated.status).toBe('scheduled');
		expect(updated.confirmedAt).toBeNull();
		expect(historyRepo.save).toHaveBeenCalledWith(
			expect.objectContaining({ sessionId: 'sess-1', action: 'reopened' }),
		);
	});

	it('setPriority updates priority on a SCHEDULED session and logs it', async () => {
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		sessionRepo.findOne.mockResolvedValue({
			id: 'sess-1',
			ownerId: 'owner-1',
			status: 'scheduled',
			priority: 'normal',
		});
		const studentsService = { findOrCreate: jest.fn() };
		const service = new TeachingSessionsService(
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		const updated = await service.setPriority('owner-1', 'sess-1', {
			priority: SessionPriority.HIGH,
		});

		expect(updated.priority).toBe('high');
		expect(historyRepo.save).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: 'sess-1',
				action: 'priority_changed',
				note: 'normal -> high',
			}),
		);
	});

	it('setPriority rejects a non-SCHEDULED session', async () => {
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		sessionRepo.findOne.mockResolvedValue({
			id: 'sess-1',
			ownerId: 'owner-1',
			status: 'completed',
			priority: 'normal',
		});
		const studentsService = { findOrCreate: jest.fn() };
		const service = new TeachingSessionsService(
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		await expect(
			service.setPriority('owner-1', 'sess-1', {
				priority: SessionPriority.HIGH,
			}),
		).rejects.toThrow('Only a scheduled session can have its priority changed');
	});
});
