import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { WeeklyScheduleSlot } from './entities/weekly-schedule-slot.entity';
import {
	TeachingSession,
	SessionStatus,
	SessionType,
} from './entities/teaching-session.entity';
import {
	TeachingSessionHistory,
	HistoryAction,
} from './entities/teaching-session-history.entity';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { occurrenceDates } from './lib/schedule-dates';

const GENERATION_WEEKS = 6;

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

	/** Monday 00:05 server time — tops up every active slot's generated SCHEDULED
	 *  sessions to a rolling 6-week horizon from `from` (defaults to now). */
	@Cron('5 0 * * 1')
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
}
