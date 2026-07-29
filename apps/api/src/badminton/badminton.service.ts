import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { computeSplit, type CalcInput } from './badminton.calc';
import { CreateBadmintonSessionDto } from './dto/create-badminton-session.dto';
import { ParticipantInputDto } from './dto/participant-input.dto';
import { UpdateBadmintonSessionDto } from './dto/update-badminton-session.dto';
import { BadmintonParticipant } from './entities/badminton-participant.entity';
import { BadmintonSession } from './entities/badminton-session.entity';

@Injectable()
export class BadmintonService {
	constructor(
		@InjectRepository(BadmintonSession)
		private readonly sessionRepo: Repository<BadmintonSession>,
		@InjectRepository(BadmintonParticipant)
		private readonly participantRepo: Repository<BadmintonParticipant>,
		@InjectRepository(User)
		private readonly usersRepo: Repository<User>,
	) {}

	async create(ownerId: string, dto: CreateBadmintonSessionDto) {
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
				courtFraction: d.courtFraction ?? 1,
				discount: d.discount ?? 0,
				shuttleFraction: d.shuttleFraction ?? 1,
				session,
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
					courtFraction: p.courtFraction,
					discount: p.discount,
					shuttleFraction: p.shuttleFraction,
				})),
			},
			new Date().toISOString(),
		);
		return this.sessionRepo.save(session);
	}

	async findAllByOwner(ownerId: string) {
		return this.sessionRepo.find({
			where: { ownerId },
			order: { playedOn: 'DESC', createdAt: 'DESC' },
		});
	}

	async findOneOwned(ownerId: string, id: string) {
		const session = await this.sessionRepo.findOne({
			where: { id, ownerId },
			relations: { participants: true },
		});
		if (!session) throw new NotFoundException('Session not found');
		return session;
	}

	async update(ownerId: string, id: string, dto: UpdateBadmintonSessionDto) {
		const session = await this.findOneOwned(ownerId, id);

		const { participants, ...rest } = dto;

		Object.assign(
			session,
			Object.fromEntries(
				Object.entries(rest).filter(([, v]) => v !== undefined),
			),
		);
		Logger.debug(
			`Updating session ${id} with data: ${JSON.stringify(session)}`,
		);
		if (participants !== undefined) {
			await this.participantRepo
				.delete({
					sessionId: session.id,
				})
				.then(() => {
					session.participants = participants.map((p) =>
						this.participantRepo.create({
							...p,
							session,
							sessionId: session.id,
						}),
					);
				});
		}

		session.computed = computeSplit(
			{
				courtCost: session.courtCost,
				shuttleUnitPrice: session.shuttleUnitPrice,
				totalShuttleCount: session.totalShuttleCount,
				participants: session.participants.map((p) => ({
					id: p.id,
					name: p.name,
					courtFraction: p.courtFraction,
					discount: p.discount,
					shuttleFraction: p.shuttleFraction,
				})),
			},
			new Date().toISOString(),
		);

		return this.sessionRepo.save(session);
	}

	async remove(ownerId: string, id: string) {
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
				courtFraction: p.courtFraction,
				discount: p.discount,
				shuttleFraction: p.shuttleFraction,
			})),
			computed: session.computed,
		};
	}

	/**
	 * Autocomplete for the participant field: registered users (by email / display name)
	 * plus free-text guest names this owner has used before.
	 */
	async suggestParticipants(ownerId: string, q: string) {
		const term = `%${q}%`;

		const users = await this.usersRepo
			.createQueryBuilder('u')
			.leftJoin('u.profile', 'profile')
			.where('u.email ILIKE :term', { term })
			.orWhere('profile.displayName ILIKE :term', { term })
			.select(['u.id', 'u.email', 'profile.displayName'])
			.limit(8)
			.getMany();

		const guestRows = await this.participantRepo
			.createQueryBuilder('p')
			.innerJoin('p.session', 's')
			.where('s.ownerId = :ownerId', { ownerId })
			.andWhere('p.userId IS NULL')
			.andWhere('p.name ILIKE :term', { term })
			.select('DISTINCT p.name', 'name')
			.limit(8)
			.getRawMany<{ name: string }>();

		return {
			users: users.map((u) => ({
				userId: u.id,
				name: u.profile?.displayName ?? u.email,
				email: u.email,
			})),
			guests: guestRows.map((g) => g.name),
		};
	}

	private generateShareToken(): string {
		return randomBytes(16).toString('base64url'); // 22 chars, unguessable
	}
}
