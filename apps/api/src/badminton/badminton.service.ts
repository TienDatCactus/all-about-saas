import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { computeSplit } from '@repo/badminton-calc';
import { BadmintonParticipant } from './entities/badminton-participant.entity';
import { BadmintonSession } from './entities/badminton-session.entity';
import { BaseService } from '../common/services/base.service';
import {
	CreateBadmintonSessionDto,
	UpdateBadmintonSessionDto,
} from './badminton.dto';

/** Mirrors MIN_QUERY in the web autocomplete; enforced here so it cannot be skipped. */
const MIN_SUGGEST_QUERY = 2;

@Injectable()
export class BadmintonService extends BaseService<BadmintonSession> {
	constructor(
		@InjectRepository(BadmintonSession)
		private readonly sessionRepo: Repository<BadmintonSession>,
		@InjectRepository(BadmintonParticipant)
		private readonly participantRepo: Repository<BadmintonParticipant>,
		@InjectRepository(User)
		private readonly usersRepo: Repository<User>,
		private readonly dataSource: DataSource,
	) {
		super(sessionRepo);
	}

	async createSession(ownerId: string, dto: CreateBadmintonSessionDto) {
		const session = this.sessionRepo.create({
			ownerId,
			playedOn: dto.playedOn,
			title: dto.title,
			courtCost: dto.courtCost,
			shuttleUnitPrice: dto.shuttleUnitPrice,
			totalShuttleCount: dto.totalShuttleCount,
			shareToken: this.generateShareToken(),
		});

		const { participants } = dto;
		// Attach after the session object exists so each child carries the relation
		// reference — TypeORM then resolves the FK at insert time on both paths.

		session.participants = participants.map((d) =>
			this.participantRepo.create({
				id: randomUUID(),
				userId: d.userId,
				name: d.name,
				hoursPlayed: d.hoursPlayed ?? 1,
				shuttleWeight: d.shuttleWeight ?? 6,
				gender: d.gender,
				sessionId: session.id,
			}),
		);
		session.computed = computeSplit(
			{
				courtCost: session.courtCost,
				shuttleUnitPrice: session.shuttleUnitPrice,
				totalShuttleCount: session.totalShuttleCount,
				participants: session.participants.map((p) => ({
					id: p.id,
					name: p.name,
					hoursPlayed: Number(p.hoursPlayed) || 0,
					shuttleWeight: Number(p.shuttleWeight) || 0,
				})),
			},
			new Date().toISOString(),
		);
		return this.sessionRepo.save(session);
	}

	async findOneOwned(ownerId: string, id: string) {
		const session = await this.sessionRepo.findOne({
			where: { id, ownerId },
			relations: { participants: true },
		});
		if (!session) throw new NotFoundException('Session not found');
		return session;
	}

	async updateSession(
		ownerId: string,
		id: string,
		dto: UpdateBadmintonSessionDto,
	) {
		const { participants, ...rest } = dto;

		// The whole read-modify-write runs in one transaction, and the session row
		// is locked FOR UPDATE up front. Without the lock, two concurrent updates
		// both read the old state, then their delete/insert pairs interleave: the
		// second DELETE runs on a snapshot that predates the first INSERT, so both
		// participant sets survive while `computed` only describes one of them.
		return this.dataSource.transaction(async (manager) => {
			// Locked separately from its relation: Postgres rejects FOR UPDATE on
			// the nullable side of the outer join that `relations` would generate.
			const session = await manager.findOne(BadmintonSession, {
				where: { id, ownerId },
				lock: { mode: 'pessimistic_write' },
			});
			if (!session) throw new NotFoundException('Session not found');

			session.participants = await manager.findBy(BadmintonParticipant, {
				sessionId: id,
			});

			Object.assign(
				session,
				Object.fromEntries(
					Object.entries(rest).filter(([, v]) => v !== undefined),
				),
			);

			if (participants !== undefined) {
				// Same id + default discipline as createSession(): the snapshot is
				// computed before the INSERT, so rows must reference ids we choose
				// up front.
				session.participants = participants.map((p) =>
					this.participantRepo.create({
						id: randomUUID(),
						userId: p.userId,
						name: p.name,
						hoursPlayed: p.hoursPlayed ?? 1,
						shuttleWeight: p.shuttleWeight ?? 6,
						gender: p.gender,
						sessionId: session.id,
					}),
				);
			}

			session.computed = computeSplit(
				{
					courtCost: session.courtCost,
					shuttleUnitPrice: session.shuttleUnitPrice,
					totalShuttleCount: session.totalShuttleCount,
					participants: session.participants.map((p) => ({
						id: p.id,
						name: p.name,
						hoursPlayed: Number(p.hoursPlayed) || 0,
						shuttleWeight: Number(p.shuttleWeight) || 0,
					})),
				},
				new Date().toISOString(),
			);

			if (participants !== undefined) {
				await manager.delete(BadmintonParticipant, { sessionId: session.id });
			}
			return manager.save(session);
		});
	}

	async removeSession(ownerId: string, id: string) {
		const session = await this.findOneOwned(ownerId, id);
		await this.sessionRepo.softRemove(session);
		return { id };
	}

	/** Public, unauthenticated read via the share token. Never exposes owner/user PII. */
	async findByShareToken(shareToken: string) {
		const session = await this.sessionRepo.findOne({
			where: { shareToken },
			relations: { participants: true },
		});
		if (!session) throw new NotFoundException('Session not found');
		return {
			title: session.title,
			playedOn: session.playedOn,
			courtCost: session.courtCost,
			shuttleUnitPrice: session.shuttleUnitPrice,
			totalShuttleCount: session.totalShuttleCount,
			participants: session.participants.map((p) => ({
				id: p.id,
				name: p.name,
				hoursPlayed: p.hoursPlayed,
				shuttleWeight: p.shuttleWeight,
				gender: p.gender,
			})),
			computed: session.computed,
		};
	}

	/**
	 * Autocomplete for the participant field: registered users (by email / display name)
	 * plus free-text guest names this owner has used before.
	 */
	async suggestParticipants(q: string) {
		// `%%` matches every user in the table, so an empty or one-character query
		// turned this into a bulk directory read for any authenticated caller. The
		// web input already waits for two characters; this makes that a rule rather
		// than a client-side courtesy.
		const term = q.trim();
		if (term.length < MIN_SUGGEST_QUERY) {
			return { users: [] };
		}
		const pattern = `%${term}%`;

		const users = await this.usersRepo
			.createQueryBuilder('u')
			.leftJoin('u.profile', 'profile')
			.where('u.email ILIKE :pattern', { pattern })
			.orWhere('profile.displayName ILIKE :pattern', { pattern })
			// u.email was missing from this list while the mapping below used it as
			// the fallback label, so a user with no display name came back with
			// `name: undefined` and the autocomplete rendered a blank, unpickable row.
			.select(['u.id', 'u.email', 'profile.displayName'])
			.limit(8)
			.getMany();

		return {
			users: users.map((u) => ({
				userId: u.id,
				// The email is used as a label of last resort, but is not returned as
				// its own field — it was always undefined there anyway, and nothing
				// consumes it. Note this endpoint still reveals an address to any
				// authenticated caller who guesses part of it; narrowing that to exact
				// email match is a product decision, not a bug fix.
				name: u.profile?.displayName ?? u.email,
			})),
		};
	}

	private generateShareToken(): string {
		return randomBytes(16).toString('base64url'); // 22 chars, unguessable
	}
}
