import { WeeklySlotsService } from './weekly-slots.service';

function mockRepo() {
	return {
		create: jest.fn((x: unknown) => x),
		save: jest.fn(async (x: unknown) => x),
		findOne: jest.fn(),
		find: jest.fn(async () => []),
		merge: jest.fn((entity: object, dto: object) => Object.assign(entity, dto)),
	};
}

function mockStudentsService(
	student = { id: 's1', ownerId: 'owner-1', name: 'An' },
) {
	return { findOrCreate: jest.fn(async () => student) };
}

describe('WeeklySlotsService.createSlot', () => {
	it('resolves studentName via StudentsService.findOrCreate before creating the slot', async () => {
		const slotRepo = mockRepo();
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const studentsService = mockStudentsService();
		const service = new WeeklySlotsService(
			slotRepo as never,
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		await service.createSlot('owner-1', {
			studentName: 'An',
			dayOfWeek: 2,
			startTime: '15:00',
			endTime: '16:00',
		});

		expect(studentsService.findOrCreate).toHaveBeenCalledWith('owner-1', 'An');
		expect(slotRepo.create).toHaveBeenCalledWith(
			expect.objectContaining({ ownerId: 'owner-1', studentId: 's1' }),
		);
	});

	it('generates one SCHEDULED session per matching weekday for the next 6 weeks, plus one CREATED history row each', async () => {
		const slotRepo = mockRepo();
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const studentsService = mockStudentsService();
		const service = new WeeklySlotsService(
			slotRepo as never,
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		await service.createSlot('owner-1', {
			studentName: 'An',
			dayOfWeek: 2,
			startTime: '15:00',
			endTime: '16:00',
		});

		expect(sessionRepo.save).toHaveBeenCalledTimes(6);
		expect(historyRepo.save).toHaveBeenCalledTimes(6);
	});
});

describe('WeeklySlotsService.updateSlot', () => {
	it('cancels future SCHEDULED sessions tied to the slot and regenerates on the new day/time', async () => {
		const slotRepo = mockRepo();
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const studentsService = mockStudentsService();
		// `active` is a non-nullable column defaulting to true, so a slot read
		// back from the DB always carries it — updateSlot branches on it.
		const existingSlot = {
			id: 'slot-1',
			ownerId: 'owner-1',
			studentId: 's1',
			dayOfWeek: 2,
			startTime: '15:00',
			endTime: '16:00',
			active: true,
		};
		slotRepo.findOne.mockResolvedValue(existingSlot);
		sessionRepo.find = jest
			.fn()
			.mockResolvedValueOnce([
				{
					id: 'sess-future-1',
					scheduledDate: '2026-09-15',
					status: 'scheduled',
				},
			])
			// generateSessions' dedup query — the row above was just detached
			// from the slot, so no candidate date is occupied.
			.mockResolvedValueOnce([]);
		const service = new WeeklySlotsService(
			slotRepo as never,
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		await service.updateSlot('owner-1', 'slot-1', {
			dayOfWeek: 3,
			startTime: '17:00',
			endTime: '18:00',
		});

		expect(sessionRepo.save).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'sess-future-1', status: 'cancelled' }),
		);
		expect(historyRepo.save).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: 'sess-future-1',
				action: 'cancelled',
			}),
		);
		const newSessionCreates = sessionRepo.save.mock.calls.filter(
			([arg]) => (arg as Record<string, unknown>).status === 'scheduled',
		);
		expect(newSessionCreates).toHaveLength(6);
	});

	it('detaches slotId from cancelled sessions when only time changes (same dayOfWeek), avoiding a (slotId, scheduledDate) collision on regeneration', async () => {
		const slotRepo = mockRepo();
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const studentsService = mockStudentsService();
		const existingSlot = {
			id: 'slot-1',
			ownerId: 'owner-1',
			studentId: 's1',
			dayOfWeek: 2,
			startTime: '15:00',
			endTime: '16:00',
			active: true,
		};
		slotRepo.findOne.mockResolvedValue(existingSlot);
		sessionRepo.find = jest
			.fn()
			.mockResolvedValueOnce([
				{
					id: 'sess-future-1',
					slotId: 'slot-1',
					scheduledDate: '2026-09-15',
					status: 'scheduled',
				},
			])
			// generateSessions' dedup query is scoped to slotId — the cancelled
			// row above had slotId nulled out, so it frees its date for reuse.
			// That detachment is exactly what this test is about.
			.mockResolvedValueOnce([]);
		const service = new WeeklySlotsService(
			slotRepo as never,
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		await service.updateSlot('owner-1', 'slot-1', {
			startTime: '17:00',
			endTime: '18:00',
		});

		expect(sessionRepo.save).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'sess-future-1',
				status: 'cancelled',
				slotId: null,
			}),
		);
		const newSessionCreates = sessionRepo.save.mock.calls.filter(
			([arg]) => (arg as Record<string, unknown>).status === 'scheduled',
		);
		expect(newSessionCreates).toHaveLength(6);
	});

	it('updateSlot with only {active:false} cancels future sessions and does not regenerate', async () => {
		const slotRepo = mockRepo();
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const studentsService = mockStudentsService();
		slotRepo.findOne.mockResolvedValue({
			id: 'slot-1',
			ownerId: 'owner-1',
			studentId: 's1',
			dayOfWeek: 2,
			startTime: '15:00',
			endTime: '16:00',
			active: true,
		});
		sessionRepo.find = jest
			.fn()
			.mockResolvedValue([
				{ id: 'sess-1', scheduledDate: '2026-09-15', status: 'scheduled' },
			]);
		const service = new WeeklySlotsService(
			slotRepo as never,
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		await service.updateSlot('owner-1', 'slot-1', { active: false });

		expect(historyRepo.save).toHaveBeenCalledWith(
			expect.objectContaining({ note: 'slot deactivated' }),
		);
		const regenerated = sessionRepo.save.mock.calls.filter(
			([arg]) => (arg as Record<string, unknown>).status === 'scheduled',
		);
		expect(regenerated).toHaveLength(0);
	});

	it("does not regenerate when editing an already-inactive slot's schedule", async () => {
		const slotRepo = mockRepo();
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const studentsService = mockStudentsService();
		slotRepo.findOne.mockResolvedValue({
			id: 'slot-1',
			ownerId: 'owner-1',
			studentId: 's1',
			dayOfWeek: 2,
			startTime: '15:00',
			endTime: '16:00',
			active: false,
		});
		sessionRepo.find = jest.fn().mockResolvedValue([]);
		const service = new WeeklySlotsService(
			slotRepo as never,
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		// No `active` in the DTO — the slot stays off, so a day change must
		// not quietly bring its sessions back.
		await service.updateSlot('owner-1', 'slot-1', { dayOfWeek: 3 });

		const regenerated = sessionRepo.save.mock.calls.filter(
			([arg]) => (arg as Record<string, unknown>).status === 'scheduled',
		);
		expect(regenerated).toHaveLength(0);
	});
});

describe('WeeklySlotsService.generateSessions', () => {
	it('skips a candidate date that already has a session for this slot', async () => {
		const slotRepo = mockRepo();
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const studentsService = mockStudentsService();
		sessionRepo.find = jest
			.fn()
			.mockResolvedValue([{ scheduledDate: '2026-09-08' }]);
		const service = new WeeklySlotsService(
			slotRepo as never,
			sessionRepo as never,
			historyRepo as never,
			studentsService as never,
		);

		await service.generateSessions(
			'owner-1',
			{
				id: 'slot-1',
				ownerId: 'owner-1',
				studentId: 's1',
				dayOfWeek: 2,
				startTime: '15:00',
				endTime: '16:00',
			} as never,
			new Date('2026-09-08T00:00:00.000Z'),
		);

		// 6 candidate Tuesdays minus the 1 that already exists = 5 new sessions.
		expect(sessionRepo.save).toHaveBeenCalledTimes(5);
		expect(historyRepo.save).toHaveBeenCalledTimes(5);
		expect(sessionRepo.save).not.toHaveBeenCalledWith(
			expect.objectContaining({ scheduledDate: '2026-09-08' }),
		);
	});
});
