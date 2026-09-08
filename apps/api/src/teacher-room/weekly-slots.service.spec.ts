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
