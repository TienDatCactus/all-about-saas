import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
	TeachingSession,
	SessionStatus,
	SessionType,
} from './entities/teaching-session.entity';
import {
	TeachingSessionHistory,
	HistoryAction,
} from './entities/teaching-session-history.entity';
import { StudentsService } from './students.service';
import {
	CancelSessionDto,
	CompleteSessionDto,
	CreateAdHocSessionDto,
	ReopenSessionDto,
	RescheduleSessionDto,
	SetPrioritySessionDto,
} from './teaching-sessions.dto';

@Injectable()
export class TeachingSessionsService {
	constructor(
		@InjectRepository(TeachingSession)
		private readonly sessionRepo: Repository<TeachingSession>,
		@InjectRepository(TeachingSessionHistory)
		private readonly historyRepo: Repository<TeachingSessionHistory>,
		// Resolves a free-text studentName in createAdHoc, same as WeeklySlotsService.createSlot.
		private readonly studentsService: StudentsService,
	) {}

	findInRange(ownerId: string, from: string, to: string) {
		return this.sessionRepo.find({
			where: { ownerId, scheduledDate: Between(from, to) },
			relations: { student: true },
			order: { scheduledDate: 'ASC', startTime: 'ASC' },
		});
	}

	/** Server-TZ 'today' — a known simplification (see spec). HIGH priority surfaces first. */
	pendingToday(ownerId: string) {
		const today = new Date().toISOString().slice(0, 10);
		return this.sessionRepo.find({
			where: { ownerId, scheduledDate: today, status: SessionStatus.SCHEDULED },
			relations: { student: true },
			order: { priority: 'DESC', startTime: 'ASC' },
		});
	}

	async history(ownerId: string, sessionId: string) {
		const session = await this.sessionRepo.findOne({
			where: { id: sessionId, ownerId },
		});
		if (!session) throw new NotFoundException('Session not found');
		return this.historyRepo.find({
			where: { sessionId },
			order: { createdAt: 'DESC' },
		});
	}

	async createAdHoc(ownerId: string, dto: CreateAdHocSessionDto) {
		const student = await this.studentsService.findOrCreate(
			ownerId,
			dto.studentName,
		);

		const session = await this.sessionRepo.save(
			this.sessionRepo.create({
				ownerId,
				studentId: student.id,
				slotId: null,
				scheduledDate: dto.scheduledDate,
				startTime: dto.startTime,
				endTime: dto.endTime,
				status: SessionStatus.SCHEDULED,
				type: SessionType.EXTRA,
				note: dto.note,
			}),
		);
		await this.historyRepo.save(
			this.historyRepo.create({
				sessionId: session.id,
				action: HistoryAction.CREATED,
			}),
		);
		return session;
	}

	async reschedule(ownerId: string, id: string, dto: RescheduleSessionDto) {
		const session = await this.sessionRepo.findOne({ where: { id, ownerId } });
		if (!session) throw new NotFoundException('Session not found');

		const fromDate = session.scheduledDate;
		session.scheduledDate = dto.newDate;
		if (dto.newStartTime) session.startTime = dto.newStartTime;
		if (dto.newEndTime) session.endTime = dto.newEndTime;
		if (session.type === SessionType.REGULAR) session.type = SessionType.MAKEUP;
		session.status = SessionStatus.SCHEDULED;
		await this.sessionRepo.save(session);

		await this.historyRepo.save(
			this.historyRepo.create({
				sessionId: id,
				action: HistoryAction.RESCHEDULED,
				fromDate,
				toDate: dto.newDate,
				note: dto.note,
			}),
		);
		return session;
	}

	private async transition(
		ownerId: string,
		id: string,
		status: SessionStatus,
		action: HistoryAction,
		note?: string,
		mutate?: (session: TeachingSession) => void,
	) {
		const session = await this.sessionRepo.findOne({ where: { id, ownerId } });
		if (!session) throw new NotFoundException('Session not found');

		session.status = status;
		mutate?.(session);
		const saved = await this.sessionRepo.save(session);

		await this.historyRepo.save(
			this.historyRepo.create({ sessionId: id, action, note }),
		);
		return saved;
	}

	cancel(ownerId: string, id: string, dto: CancelSessionDto) {
		return this.transition(
			ownerId,
			id,
			SessionStatus.CANCELLED,
			HistoryAction.CANCELLED,
			dto.note,
		);
	}

	complete(ownerId: string, id: string, dto: CompleteSessionDto) {
		return this.transition(
			ownerId,
			id,
			SessionStatus.COMPLETED,
			HistoryAction.COMPLETED,
			dto.note,
			(session) => {
				session.confirmedAt = new Date();
			},
		);
	}

	reopen(ownerId: string, id: string, dto: ReopenSessionDto) {
		return this.transition(
			ownerId,
			id,
			SessionStatus.SCHEDULED,
			HistoryAction.REOPENED,
			dto.note,
			(session) => {
				session.confirmedAt = null;
			},
		);
	}

	async setPriority(ownerId: string, id: string, dto: SetPrioritySessionDto) {
		const session = await this.sessionRepo.findOne({ where: { id, ownerId } });
		if (!session) throw new NotFoundException('Session not found');
		if (session.status !== SessionStatus.SCHEDULED) {
			throw new BadRequestException(
				'Only a scheduled session can have its priority changed',
			);
		}

		const from = session.priority;
		session.priority = dto.priority;
		const saved = await this.sessionRepo.save(session);

		await this.historyRepo.save(
			this.historyRepo.create({
				sessionId: id,
				action: HistoryAction.PRIORITY_CHANGED,
				note: `${from} -> ${dto.priority}`,
			}),
		);
		return saved;
	}
}
