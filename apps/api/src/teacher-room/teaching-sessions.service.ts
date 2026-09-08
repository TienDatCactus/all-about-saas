import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
	TeachingSession,
	SessionStatus,
} from './entities/teaching-session.entity';
import { TeachingSessionHistory } from './entities/teaching-session-history.entity';
import { StudentsService } from './students.service';

@Injectable()
export class TeachingSessionsService {
	constructor(
		@InjectRepository(TeachingSession)
		private readonly sessionRepo: Repository<TeachingSession>,
		@InjectRepository(TeachingSessionHistory)
		private readonly historyRepo: Repository<TeachingSessionHistory>,
		// Unused until Task 8's createAdHoc (resolves a free-text studentName the
		// same way WeeklySlotsService does) — declared here so every test in this
		// growing spec file constructs the class with a stable 3-arg shape.
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
}
