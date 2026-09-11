import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, LessThanOrEqual, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { WeeklyScheduleSlot } from './entities/weekly-schedule-slot.entity';
import {
	TeachingSession,
	SessionStatus,
	SessionType,
	SessionPriority,
} from './entities/teaching-session.entity';
import {
	TeachingSessionHistory,
	HistoryAction,
} from './entities/teaching-session-history.entity';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import {
	occurrenceDates,
	combineDateTime,
	todayInTeacherTz,
	TEACHER_TZ,
} from './lib/schedule-dates';

const GENERATION_WEEKS = 6;
const PRE_CLASS_REMINDER_MINUTES = 15;
/** Inside the user's stated 1-2 hour post-class window. */
const POST_CLASS_REMINDER_DELAY_MINUTES = 90;

@Injectable()
export class TeacherRoomSchedulerService {
	constructor(
		@InjectRepository(WeeklyScheduleSlot)
		private readonly slotRepo: Repository<WeeklyScheduleSlot>,
		@InjectRepository(TeachingSession)
		private readonly sessionRepo: Repository<TeachingSession>,
		@InjectRepository(TeachingSessionHistory)
		private readonly historyRepo: Repository<TeachingSessionHistory>,
		@InjectRepository(User) private readonly userRepo: Repository<User>,
		private readonly mailService: MailService,
		private readonly configService: ConfigService,
	) {}

	/** Monday 00:05 Vietnam time — tops up every active slot's generated
	 *  SCHEDULED sessions to a rolling 6-week horizon from `from` (defaults to
	 *  now). */
	@Cron('5 0 * * 1', { timeZone: TEACHER_TZ })
	async topUpWeeklySchedules(from: Date = new Date()) {
		const activeSlots = await this.slotRepo.find({ where: { active: true } });

		for (const slot of activeSlots) {
			const candidateDates = occurrenceDates(
				slot.dayOfWeek,
				from,
				GENERATION_WEEKS,
			);
			const existing = await this.sessionRepo.find({
				where: { slotId: slot.id, scheduledDate: In(candidateDates) },
			});
			const existingDates = new Set(existing.map((s) => s.scheduledDate));
			const missingDates = candidateDates.filter((d) => !existingDates.has(d));

			for (const scheduledDate of missingDates) {
				const session = await this.sessionRepo.save(
					this.sessionRepo.create({
						ownerId: slot.ownerId,
						studentId: slot.studentId,
						slotId: slot.id,
						scheduledDate,
						startTime: slot.startTime,
						endTime: slot.endTime,
						status: SessionStatus.SCHEDULED,
						type: SessionType.REGULAR,
					}),
				);
				await this.historyRepo.save(
					this.historyRepo.create({
						sessionId: session.id,
						action: HistoryAction.CREATED,
						toDate: scheduledDate,
					}),
				);
			}
		}
	}

	/** Every day at 20:00 Vietnam time. */
	@Cron('0 20 * * *', { timeZone: TEACHER_TZ })
	async sendDailyReminders() {
		const today = todayInTeacherTz(new Date());
		const pending = await this.sessionRepo.find({
			where: {
				scheduledDate: LessThanOrEqual(today),
				status: SessionStatus.SCHEDULED,
			},
			relations: { student: true },
			order: { priority: 'DESC', startTime: 'ASC' },
		});

		const byOwner = new Map<string, typeof pending>();
		for (const session of pending) {
			byOwner.set(session.ownerId, [
				...(byOwner.get(session.ownerId) ?? []),
				session,
			]);
		}

		const frontendUrl = this.configService.get<string>('frontendUrl');
		for (const [ownerId, sessions] of byOwner) {
			const owner = await this.userRepo.findOne({ where: { id: ownerId } });
			if (!owner?.email) continue;

			// One row per session, rather than one semicolon-joined sentence — the
			// digest can list any number of stale sessions and still read cleanly.
			const items = sessions.map((s) => ({
				title: `${s.student.name} · ${s.startTime}–${s.endTime}`,
				description:
					s.priority === SessionPriority.HIGH ? 'Ưu tiên cao' : undefined,
			}));

			await this.mailService.sendEmail(
				{ to: owner.email },
				'teacherRoomReminder',
				{
					title: 'Buổi dạy hôm nay chưa chốt trạng thái',
					subtitle: 'Các buổi sau vẫn đang ở trạng thái "chưa chốt":',
					legend:
						'Nhấn nút bên dưới để chốt buổi hôm nay: đánh dấu đã dạy xong, dời lịch, hoặc huỷ nếu không diễn ra. Buổi ghi "Ưu tiên cao" bên dưới đã bị bỏ sót nhiều ngày.',
					url: `${frontendUrl}/teacher-room/timetable`,
					items,
				},
			);
		}
	}

	/** Every 10 minutes: fires the pre-class and post-class reminders for today's
	 *  still-SCHEDULED sessions. Each *ReminderSentAt guard makes the send
	 *  idempotent across polls — a 10-minute cadence means at most a 10-minute
	 *  delay past the trigger instant, not a missed or duplicated send. */
	@Cron(CronExpression.EVERY_10_MINUTES)
	async sendUpcomingAndFollowupReminders(now: Date = new Date()) {
		const today = todayInTeacherTz(now);
		const frontendUrl = this.configService.get<string>('frontendUrl');

		const upcoming = await this.sessionRepo.find({
			where: {
				scheduledDate: today,
				status: SessionStatus.SCHEDULED,
				preReminderSentAt: IsNull(),
			},
			relations: { student: true },
		});
		for (const session of upcoming) {
			const remindAt = new Date(
				combineDateTime(session.scheduledDate, session.startTime).getTime() -
					PRE_CLASS_REMINDER_MINUTES * 60_000,
			);
			if (now < remindAt) continue;

			const owner = await this.userRepo.findOne({
				where: { id: session.ownerId },
			});
			if (owner?.email) {
				// Carry forward anything else unconfirmed for this same student — the
				// daily digest already nags about it indefinitely, but surfacing it
				// here too means the teacher sees it right before their next class
				// with that student, not only in the end-of-day list.
				const staleSessions = await this.sessionRepo.find({
					where: {
						ownerId: session.ownerId,
						studentId: session.studentId,
						status: SessionStatus.SCHEDULED,
						scheduledDate: LessThan(today),
					},
				});
				const staleNote =
					staleSessions.length > 0
						? ` Ngoài ra bạn còn ${staleSessions.length} buổi trước đó với ${session.student.name} chưa note.`
						: '';

				await this.mailService.sendEmail(
					{ to: owner.email },
					'teacherRoomReminder',
					{
						title: 'Sắp đến giờ dạy',
						subtitle: `Buổi với ${session.student.name} bắt đầu lúc ${session.startTime} hôm nay.${staleNote}`,
						legend:
							'Nhớ chuẩn bị bài. Sau khi dạy xong, nhớ quay lại chốt trạng thái buổi này.',
						url: `${frontendUrl}/teacher-room/timetable`,
					},
				);
			}
			session.preReminderSentAt = now;
			await this.sessionRepo.save(session);
		}

		const finishing = await this.sessionRepo.find({
			where: {
				scheduledDate: today,
				status: SessionStatus.SCHEDULED,
				postReminderSentAt: IsNull(),
			},
			relations: { student: true },
		});
		for (const session of finishing) {
			const endAt = combineDateTime(session.scheduledDate, session.endTime);
			const remindAt = new Date(
				endAt.getTime() + POST_CLASS_REMINDER_DELAY_MINUTES * 60_000,
			);
			if (now < remindAt) continue;

			const owner = await this.userRepo.findOne({
				where: { id: session.ownerId },
			});
			if (owner?.email) {
				await this.mailService.sendEmail(
					{ to: owner.email },
					'teacherRoomReminder',
					{
						title: 'Buổi dạy vừa kết thúc',
						subtitle: `Buổi với ${session.student.name} (${session.startTime}–${session.endTime}) vừa kết thúc và chưa chốt trạng thái.`,
						legend:
							'Nhấn nút bên dưới để đánh dấu đã dạy xong, dời lịch, hoặc huỷ.',
						url: `${frontendUrl}/teacher-room/timetable`,
					},
				);
			}
			session.postReminderSentAt = now;
			await this.sessionRepo.save(session);
		}
	}
}
