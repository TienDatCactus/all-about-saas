import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../common/services/base.service';
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
import { CreateWeeklyScheduleSlotDto } from './weekly-slots.dto';
import { occurrenceDates } from './lib/schedule-dates';
import { StudentsService } from './students.service';

const GENERATION_WEEKS = 6;

@Injectable()
export class WeeklySlotsService extends BaseService<WeeklyScheduleSlot> {
	constructor(
		@InjectRepository(WeeklyScheduleSlot)
		private readonly slotRepo: Repository<WeeklyScheduleSlot>,
		@InjectRepository(TeachingSession)
		private readonly sessionRepo: Repository<TeachingSession>,
		@InjectRepository(TeachingSessionHistory)
		private readonly historyRepo: Repository<TeachingSessionHistory>,
		private readonly studentsService: StudentsService,
	) {
		super(slotRepo);
	}

	async createSlot(ownerId: string, dto: CreateWeeklyScheduleSlotDto) {
		const student = await this.studentsService.findOrCreate(
			ownerId,
			dto.studentName,
		);

		const slot = await this.slotRepo.save(
			this.slotRepo.create({
				ownerId,
				studentId: student.id,
				dayOfWeek: dto.dayOfWeek,
				startTime: dto.startTime,
				endTime: dto.endTime,
			}),
		);

		await this.generateSessions(ownerId, slot);
		return slot;
	}

	/** Also called by Task 12's weekly top-up cron. */
	async generateSessions(
		ownerId: string,
		slot: WeeklyScheduleSlot,
		from: Date = new Date(),
	) {
		const dates = occurrenceDates(slot.dayOfWeek, from, GENERATION_WEEKS);
		for (const scheduledDate of dates) {
			const session = await this.sessionRepo.save(
				this.sessionRepo.create({
					ownerId,
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
