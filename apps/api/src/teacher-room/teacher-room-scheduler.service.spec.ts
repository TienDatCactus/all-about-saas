import { TeacherRoomSchedulerService } from './teacher-room-scheduler.service';

function mockRepo() {
	return {
		find: jest.fn(async (): Promise<unknown[]> => []),
		findOne: jest.fn(),
		save: jest.fn(async (x: unknown) => x),
		create: jest.fn((x: unknown) => x),
	};
}

describe('TeacherRoomSchedulerService.topUpWeeklySchedules', () => {
	it('generates only the missing future dates for each active slot, skipping ones that already exist', async () => {
		const slotRepo = mockRepo();
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const userRepo = mockRepo();
		slotRepo.find.mockResolvedValue([
			{
				id: 'slot-1',
				ownerId: 'owner-1',
				studentId: 's1',
				dayOfWeek: 2,
				startTime: '15:00',
				endTime: '16:00',
				active: true,
			},
		]);
		// Pretend the first of the 6 candidate Tuesdays already has a row.
		sessionRepo.find.mockResolvedValue([{ scheduledDate: '2026-09-08' }]);

		const service = new TeacherRoomSchedulerService(
			slotRepo as never,
			sessionRepo as never,
			historyRepo as never,
			userRepo as never,
			{ sendEmail: jest.fn() } as never,
			{ get: jest.fn() } as never,
		);

		await service.topUpWeeklySchedules(new Date('2026-09-08T00:00:00.000Z'));

		// 6 candidate Tuesdays minus the 1 that already exists = 5 new sessions.
		expect(sessionRepo.save).toHaveBeenCalledTimes(5);
		expect(historyRepo.save).toHaveBeenCalledTimes(5);
		expect(sessionRepo.save).not.toHaveBeenCalledWith(
			expect.objectContaining({ scheduledDate: '2026-09-08' }),
		);
	});

	it('skips inactive slots entirely', async () => {
		const slotRepo = mockRepo();
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const userRepo = mockRepo();
		slotRepo.find.mockResolvedValue([]); // the query itself filters active:true — see implementation

		const service = new TeacherRoomSchedulerService(
			slotRepo as never,
			sessionRepo as never,
			historyRepo as never,
			userRepo as never,
			{ sendEmail: jest.fn() } as never,
			{ get: jest.fn() } as never,
		);

		await service.topUpWeeklySchedules(new Date('2026-09-08T00:00:00.000Z'));

		expect(slotRepo.find).toHaveBeenCalledWith({ where: { active: true } });
		expect(sessionRepo.save).not.toHaveBeenCalled();
	});
});
