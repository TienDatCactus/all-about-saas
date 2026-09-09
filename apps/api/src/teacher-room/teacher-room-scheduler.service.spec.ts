import { LessThanOrEqual } from 'typeorm';
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

describe('TeacherRoomSchedulerService.sendDailyReminders', () => {
	it('sendDailyReminders emails each distinct owner with a pending session today, formatted as "Name HH:mm–HH:mm"', async () => {
		const slotRepo = mockRepo();
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const userRepo = mockRepo();
		const mailService = { sendEmail: jest.fn() };
		const configService = {
			get: jest.fn().mockReturnValue('https://app.example.com'),
		};

		sessionRepo.find.mockResolvedValue([
			{
				ownerId: 'owner-1',
				startTime: '15:00',
				endTime: '16:00',
				priority: 'high',
				student: { name: 'An' },
			},
			{
				ownerId: 'owner-1',
				startTime: '17:00',
				endTime: '18:00',
				priority: 'normal',
				student: { name: 'Bình' },
			},
		]);
		userRepo.findOne = jest
			.fn()
			.mockResolvedValue({ id: 'owner-1', email: 'teacher@example.com' });

		const service = new TeacherRoomSchedulerService(
			slotRepo as never,
			sessionRepo as never,
			historyRepo as never,
			userRepo as never,
			mailService as never,
			configService as never,
		);

		await service.sendDailyReminders();

		expect(mailService.sendEmail).toHaveBeenCalledTimes(1);
		expect(mailService.sendEmail).toHaveBeenCalledWith(
			{ to: 'teacher@example.com' },
			'teacherRoomReminder',
			expect.objectContaining({
				title: 'Buổi dạy hôm nay chưa chốt trạng thái',
				// HIGH-priority sessions are marked and sorted first in the digest.
				subtitle: expect.stringContaining(
					'[Ưu tiên cao] An 15:00–16:00; Bình 17:00–18:00',
				),
				url: 'https://app.example.com/teacher-room',
			}),
		);
	});

	it('sendDailyReminders still includes a session from several days ago, not just today', async () => {
		const slotRepo = mockRepo();
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const userRepo = mockRepo();
		const mailService = { sendEmail: jest.fn() };
		const configService = {
			get: jest.fn().mockReturnValue('https://app.example.com'),
		};

		sessionRepo.find.mockResolvedValue([
			{
				ownerId: 'owner-1',
				startTime: '15:00',
				endTime: '16:00',
				priority: 'normal',
				student: { name: 'An' },
			},
		]);
		userRepo.findOne = jest
			.fn()
			.mockResolvedValue({ id: 'owner-1', email: 'teacher@example.com' });

		const service = new TeacherRoomSchedulerService(
			slotRepo as never,
			sessionRepo as never,
			historyRepo as never,
			userRepo as never,
			mailService as never,
			configService as never,
		);

		await service.sendDailyReminders();

		// The digest is a backstop: it must keep re-listing anything still
		// unconfirmed, so the date filter is `<= today`, never `=== today`.
		expect(sessionRepo.find).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					scheduledDate: LessThanOrEqual(expect.any(String)),
					status: 'scheduled',
				},
			}),
		);
		expect(mailService.sendEmail).toHaveBeenCalledTimes(1);
	});

	it('sendDailyReminders sends nothing when no session is pending today', async () => {
		const slotRepo = mockRepo();
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const userRepo = mockRepo();
		const mailService = { sendEmail: jest.fn() };
		sessionRepo.find.mockResolvedValue([]);

		const service = new TeacherRoomSchedulerService(
			slotRepo as never,
			sessionRepo as never,
			historyRepo as never,
			userRepo as never,
			mailService as never,
			{ get: jest.fn() } as never,
		);

		await service.sendDailyReminders();

		expect(mailService.sendEmail).not.toHaveBeenCalled();
	});
});

describe('TeacherRoomSchedulerService.sendUpcomingAndFollowupReminders', () => {
	it('sendUpcomingAndFollowupReminders emails the pre-class reminder once startTime is within the window, then marks it sent', async () => {
		const slotRepo = mockRepo();
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const userRepo = mockRepo();
		const mailService = { sendEmail: jest.fn() };
		const configService = {
			get: jest.fn().mockReturnValue('https://app.example.com'),
		};

		// "Now" is 14:50 Vietnam time (07:50 UTC); session starts at 15:00 —
		// inside the 15-minute pre-class window.
		const now = new Date('2026-09-08T07:50:00.000Z');
		const session = {
			id: 'sess-1',
			ownerId: 'owner-1',
			scheduledDate: '2026-09-08',
			startTime: '15:00',
			endTime: '16:00',
			preReminderSentAt: null,
			postReminderSentAt: 'sent',
			student: { name: 'An' },
		};
		sessionRepo.find = jest
			.fn()
			// Order: upcoming query, then the stale-session lookup this send path
			// always runs once it decides to email (see the carryover test below —
			// the brief's own draft of this test omitted that 3rd call), then the
			// finishing query (postReminderSentAt IS NULL) — already sent.
			.mockResolvedValueOnce([session])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);
		userRepo.findOne = jest
			.fn()
			.mockResolvedValue({ id: 'owner-1', email: 'teacher@example.com' });

		const service = new TeacherRoomSchedulerService(
			slotRepo as never,
			sessionRepo as never,
			historyRepo as never,
			userRepo as never,
			mailService as never,
			configService as never,
		);

		await service.sendUpcomingAndFollowupReminders(now);

		expect(mailService.sendEmail).toHaveBeenCalledWith(
			{ to: 'teacher@example.com' },
			'teacherRoomReminder',
			expect.objectContaining({
				title: 'Sắp đến giờ dạy',
				subtitle: expect.stringContaining('An'),
				url: 'https://app.example.com/teacher-room',
			}),
		);
		expect(sessionRepo.save).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'sess-1', preReminderSentAt: now }),
		);
	});

	it('does not send the pre-class reminder before the window opens', async () => {
		const slotRepo = mockRepo();
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const userRepo = mockRepo();
		const mailService = { sendEmail: jest.fn() };

		// "Now" is 14:00 Vietnam time (07:00 UTC); session starts at 15:00 —
		// outside the 15-minute window.
		const now = new Date('2026-09-08T07:00:00.000Z');
		const session = {
			id: 'sess-1',
			ownerId: 'owner-1',
			scheduledDate: '2026-09-08',
			startTime: '15:00',
			endTime: '16:00',
			preReminderSentAt: null,
			postReminderSentAt: null,
			student: { name: 'An' },
		};
		sessionRepo.find = jest
			.fn()
			.mockResolvedValueOnce([session])
			.mockResolvedValueOnce([session]);

		const service = new TeacherRoomSchedulerService(
			slotRepo as never,
			sessionRepo as never,
			historyRepo as never,
			userRepo as never,
			mailService as never,
			{ get: jest.fn() } as never,
		);

		await service.sendUpcomingAndFollowupReminders(now);

		expect(mailService.sendEmail).not.toHaveBeenCalled();
		expect(sessionRepo.save).not.toHaveBeenCalled();
	});

	it('does not send the post-class follow-up right when class ends — waits out the 90-minute delay', async () => {
		const slotRepo = mockRepo();
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const userRepo = mockRepo();
		const mailService = { sendEmail: jest.fn() };

		// "Now" is 16:10 Vietnam time (09:10 UTC); session ended at 16:00 —
		// only 10 minutes ago, inside the 90-minute delay.
		const now = new Date('2026-09-08T09:10:00.000Z');
		const session = {
			id: 'sess-1',
			ownerId: 'owner-1',
			scheduledDate: '2026-09-08',
			startTime: '15:00',
			endTime: '16:00',
			preReminderSentAt: 'sent',
			postReminderSentAt: null,
			student: { name: 'An' },
		};
		sessionRepo.find = jest
			.fn()
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([session]);

		const service = new TeacherRoomSchedulerService(
			slotRepo as never,
			sessionRepo as never,
			historyRepo as never,
			userRepo as never,
			mailService as never,
			{ get: jest.fn() } as never,
		);

		await service.sendUpcomingAndFollowupReminders(now);

		expect(mailService.sendEmail).not.toHaveBeenCalled();
		expect(sessionRepo.save).not.toHaveBeenCalled();
	});

	it('sends the post-class follow-up once the 90-minute delay has elapsed, then marks it sent', async () => {
		const slotRepo = mockRepo();
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const userRepo = mockRepo();
		const mailService = { sendEmail: jest.fn() };
		const configService = {
			get: jest.fn().mockReturnValue('https://app.example.com'),
		};

		// "Now" is 17:35 Vietnam time (10:35 UTC); session ended at 16:00 —
		// 95 minutes ago, past the 90-minute delay.
		const now = new Date('2026-09-08T10:35:00.000Z');
		const session = {
			id: 'sess-1',
			ownerId: 'owner-1',
			scheduledDate: '2026-09-08',
			startTime: '15:00',
			endTime: '16:00',
			preReminderSentAt: 'sent',
			postReminderSentAt: null,
			student: { name: 'An' },
		};
		sessionRepo.find = jest
			.fn()
			.mockResolvedValueOnce([]) // upcoming query — already sent
			.mockResolvedValueOnce([session]); // finishing query
		userRepo.findOne = jest
			.fn()
			.mockResolvedValue({ id: 'owner-1', email: 'teacher@example.com' });

		const service = new TeacherRoomSchedulerService(
			slotRepo as never,
			sessionRepo as never,
			historyRepo as never,
			userRepo as never,
			mailService as never,
			configService as never,
		);

		await service.sendUpcomingAndFollowupReminders(now);

		expect(mailService.sendEmail).toHaveBeenCalledWith(
			{ to: 'teacher@example.com' },
			'teacherRoomReminder',
			expect.objectContaining({ title: 'Buổi dạy vừa kết thúc' }),
		);
		expect(sessionRepo.save).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'sess-1', postReminderSentAt: now }),
		);
	});

	it("carries a note about the student's older unconfirmed sessions into the next pre-class reminder", async () => {
		const slotRepo = mockRepo();
		const sessionRepo = mockRepo();
		const historyRepo = mockRepo();
		const userRepo = mockRepo();
		const mailService = { sendEmail: jest.fn() };
		const configService = {
			get: jest.fn().mockReturnValue('https://app.example.com'),
		};

		// 14:50 Vietnam time (07:50 UTC) — upcoming session at 15:00 today.
		const now = new Date('2026-09-10T07:50:00.000Z');
		const upcomingSession = {
			id: 'sess-2',
			ownerId: 'owner-1',
			studentId: 'student-1',
			scheduledDate: '2026-09-10',
			startTime: '15:00',
			endTime: '16:00',
			preReminderSentAt: null,
			postReminderSentAt: null,
			student: { name: 'An' },
		};
		const staleSession = {
			id: 'sess-1',
			ownerId: 'owner-1',
			studentId: 'student-1',
			scheduledDate: '2026-09-08',
			status: 'scheduled',
		};
		sessionRepo.find = jest
			.fn()
			.mockResolvedValueOnce([upcomingSession]) // upcoming query
			.mockResolvedValueOnce([staleSession]) // stale-session lookup for this student, scoped inside the loop
			.mockResolvedValueOnce([]); // finishing query
		userRepo.findOne = jest
			.fn()
			.mockResolvedValue({ id: 'owner-1', email: 'teacher@example.com' });

		const service = new TeacherRoomSchedulerService(
			slotRepo as never,
			sessionRepo as never,
			historyRepo as never,
			userRepo as never,
			mailService as never,
			configService as never,
		);

		await service.sendUpcomingAndFollowupReminders(now);

		expect(mailService.sendEmail).toHaveBeenCalledWith(
			{ to: 'teacher@example.com' },
			'teacherRoomReminder',
			expect.objectContaining({
				subtitle: expect.stringContaining(
					'còn 1 buổi trước đó với An chưa note',
				),
			}),
		);
	});
});
