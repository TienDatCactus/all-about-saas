import { Injectable, NotFoundException } from '@nestjs/common';
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
import { CreateAdHocSessionDto } from './teaching-sessions.dto';

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
}
