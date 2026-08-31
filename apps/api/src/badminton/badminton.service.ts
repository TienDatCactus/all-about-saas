import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { computeSplit } from '@repo/badminton-calc';
import { PaymentMethod } from '../payment-methods/entities/payment-method.entity';
import { BadmintonParticipant } from './entities/badminton-participant.entity';
import { BadmintonSession } from './entities/badminton-session.entity';
import { BaseService } from '../common/services/base.service';
import {
	CreateBadmintonSessionDto,
	ParticipantInputDto,
	UpdateBadmintonSessionDto,
} from './badminton.dto';

/** Mirrors MIN_QUERY in the web autocomplete; enforced here so it cannot be skipped. */
const MIN_SUGGEST_QUERY = 2;

/**
 * Best-effort name out of one linked OAuthAccount's raw provider payload.
 *
 * The three providers wired up today (`google.strategy.ts`,
 * `github.strategy.ts`, `facebook.strategy.ts`) don't agree on shape: GitHub
 * and Facebook stash a combined `displayName`, all three can carry
 * `firstName`/`lastName`, and GitHub alone falls back to a bare `username`.
 * Kept as a pure function, isolated from the query-building code, so the
 * provider-specific field names live in one testable place instead of being
 * scattered across a query builder or a raw-row mapper.
 */
export function resolveOAuthDisplayName(
	profileData: unknown,
): string | undefined {
	if (typeof profileData !== 'object' || profileData === null) {
		return undefined;
	}
	const data = profileData as Record<string, unknown>;

	const displayName = data.displayName;
	if (typeof displayName === 'string' && displayName.trim()) {
		return displayName.trim();
	}

	const firstName = typeof data.firstName === 'string' ? data.firstName : '';
	const lastName = typeof data.lastName === 'string' ? data.lastName : '';
	const fullName = `${firstName} ${lastName}`.trim();
	if (fullName) {
		return fullName;
	}

	const username = data.username;
	if (typeof username === 'string' && username.trim()) {
		return username.trim();
	}

	return undefined;
}

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
		const defaultHoursPlayed = dto.defaultHoursPlayed ?? 1;
		const session = this.sessionRepo.create({
			ownerId,
			playedOn: dto.playedOn,
			title: dto.title,
			courtCost: dto.courtCost,
			shuttleUnitPrice: dto.shuttleUnitPrice,
			totalShuttleCount: dto.totalShuttleCount,
			defaultHoursPlayed,
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
				hoursPlayed: d.hoursPlayed ?? defaultHoursPlayed,
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
			relations: { participants: true, paymentMethod: true },
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

			const existingParticipants = await manager.findBy(BadmintonParticipant, {
				sessionId: id,
			});
			session.participants = existingParticipants;

			// A foreign or unknown paymentMethodId used to reach Object.assign()
			// unchecked: the column would take any uuid the caller sent, so a host
			// could attach a stranger's QR image / phone number to their own share
			// page (and a nonexistent id 500'd on the FK instead of 404-ing). Scoped
			// to the owner, so someone else's method is indistinguishable from a
			// missing one — the same rule the session itself follows.
			if (rest.paymentMethodId !== undefined && rest.paymentMethodId !== null) {
				const method = await manager.findOne(PaymentMethod, {
					where: { id: rest.paymentMethodId, userId: ownerId },
				});
				if (!method) throw new NotFoundException('Payment method not found');
			}

			Object.assign(
				session,
				Object.fromEntries(
					Object.entries(rest).filter(([, v]) => v !== undefined),
				),
			);

			// Rows to hard-delete after the snapshot is recomputed. Empty unless the
			// payload actually drops someone.
			let removedParticipantIds: string[] = [];

			if (participants !== undefined) {
				const reconciled = this.reconcileParticipants(
					session,
					existingParticipants,
					participants,
				);
				session.participants = reconciled.participants;
				removedParticipantIds = reconciled.removedIds;
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

			// Only the rows the payload actually dropped. This used to delete every
			// participant of the session unconditionally, which is what discarded
			// `paid`/`paidAt` on an ordinary "Save changes".
			if (removedParticipantIds.length > 0) {
				await manager.delete(BadmintonParticipant, {
					id: In(removedParticipantIds),
				});
			}
			await manager.save(session);

			// The locked read above can't carry `relations` (see the comment on that
			// query), so `session.paymentMethod` was never populated — only the raw
			// `paymentMethodId` column gets set by the Object.assign above. Re-read
			// within the same transaction so the response reflects the persisted
			// relation the same way findOneOwned() does, instead of leaving callers
			// with a stale `paymentMethod: undefined`.
			const updated = await manager.findOne(BadmintonSession, {
				where: { id: session.id },
				relations: { participants: true, paymentMethod: true },
			});
			if (!updated) throw new NotFoundException('Session not found');
			return updated;
		});
	}

	/**
	 * Diffs an incoming participants payload against the rows already stored for
	 * the session, instead of replacing the lot.
	 *
	 * Matching is by id, and matched rows are MUTATED IN PLACE — which is the
	 * whole point: `paid` and `paidAt` are deliberately absent from the
	 * assignments below, so a host pressing "Save changes" after editing an hour
	 * count no longer wipes everyone's payment status (the previous
	 * delete-all-then-reinsert did exactly that, handing every participant a new
	 * id and a fresh `paid: false`).
	 *
	 * Rows that don't match are INSERTED with an id generated here, never the
	 * client's: an id we don't recognise may well name a participant of somebody
	 * else's session, and TypeORM's cascading save would then re-parent that row
	 * rather than create one. Generating up front is also what lets `computed` be
	 * built before anything is written — the snapshot has to reference the ids the
	 * rows will actually be stored under.
	 *
	 * Nullable-not-undefined assignments for `userId`/`gender`: save() omits
	 * `undefined` properties from the UPDATE, so un-linking a participant from an
	 * account (the web app clears `userId` when you type over a picked name) has
	 * to write an explicit SQL NULL. Same distinction as `paidAt`.
	 */
	private reconcileParticipants(
		session: BadmintonSession,
		existing: BadmintonParticipant[],
		incoming: ParticipantInputDto[],
	): { participants: BadmintonParticipant[]; removedIds: string[] } {
		const unclaimed = new Map(existing.map((p) => [p.id, p]));

		const participants = incoming.map((input) => {
			const match = input.id ? unclaimed.get(input.id) : undefined;
			if (match) {
				// Claimed, so a payload that repeats one id twice gets one updated row
				// and one new row rather than the same entity aliased into two slots.
				unclaimed.delete(match.id);
				match.userId = input.userId ?? null;
				match.name = input.name;
				match.hoursPlayed = input.hoursPlayed ?? session.defaultHoursPlayed;
				match.shuttleWeight = input.shuttleWeight ?? 6;
				match.gender = input.gender ?? null;
				return match;
			}
			return this.participantRepo.create({
				id: randomUUID(),
				userId: input.userId ?? null,
				name: input.name,
				hoursPlayed: input.hoursPlayed ?? session.defaultHoursPlayed,
				shuttleWeight: input.shuttleWeight ?? 6,
				gender: input.gender ?? null,
				sessionId: session.id,
			});
		});

		return {
			participants,
			// Whatever no incoming row claimed was removed by the host.
			removedIds: [...unclaimed.keys()],
		};
	}

	async removeSession(ownerId: string, id: string) {
		const session = await this.findOneOwned(ownerId, id);
		await this.sessionRepo.softRemove(session);
		return { id };
	}

	async setParticipantPaid(
		ownerId: string,
		sessionId: string,
		participantId: string,
		paid: boolean,
	) {
		const session = await this.sessionRepo.findOne({
			where: { id: sessionId, ownerId },
		});
		if (!session) throw new NotFoundException('Session not found');

		const participant = await this.participantRepo.findOne({
			where: { id: participantId, sessionId },
		});
		if (!participant) throw new NotFoundException('Participant not found');

		participant.paid = paid;
		participant.paidAt = paid ? new Date() : null;
		return this.participantRepo.save(participant);
	}

	/** Public, unauthenticated read via the share token. Never exposes owner/user PII. */
	async findByShareToken(shareToken: string) {
		const session = await this.sessionRepo.findOne({
			where: { shareToken },
			relations: { participants: true, paymentMethod: true },
		});
		if (!session) throw new NotFoundException('Session not found');
		return {
			title: session.title,
			playedOn: session.playedOn,
			courtCost: session.courtCost,
			shuttleUnitPrice: session.shuttleUnitPrice,
			totalShuttleCount: session.totalShuttleCount,
			defaultHoursPlayed: session.defaultHoursPlayed,
			participants: session.participants.map((p) => ({
				id: p.id,
				name: p.name,
				hoursPlayed: p.hoursPlayed,
				shuttleWeight: p.shuttleWeight,
				gender: p.gender,
				paid: p.paid,
				paidAt: p.paidAt ? p.paidAt.toISOString() : null,
			})),
			computed: session.computed,
			paymentMethod: session.paymentMethod
				? {
						type: session.paymentMethod.type,
						label: session.paymentMethod.label,
						imageUrl: session.paymentMethod.imageUrl,
						phoneNumber: session.paymentMethod.phoneNumber,
					}
				: null,
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
			// `oauthAccounts` is a mapped OneToMany, so a user with several linked
			// providers produces several joined rows here. getMany()'s hydration
			// groups those back into one User with an `oauthAccounts` array (keyed
			// off `u.id`), so this stays a single row per matched user in the
			// response below — no manual group-by needed.
			.leftJoin('u.oauthAccounts', 'oauth')
			.where('u.email ILIKE :pattern', { pattern })
			.orWhere('profile.displayName ILIKE :pattern', { pattern })
			// profile.displayName is essentially always empty (nothing ever writes
			// it), so without these a registered user could only be found by email
			// even though their real name is sitting unused in the OAuth provider's
			// profileData — matching resolveOAuthDisplayName's own field order.
			.orWhere(`oauth."profileData"->>'displayName' ILIKE :pattern`, {
				pattern,
			})
			.orWhere(
				`CONCAT(oauth."profileData"->>'firstName', ' ', oauth."profileData"->>'lastName') ILIKE :pattern`,
				{ pattern },
			)
			.orWhere(`oauth."profileData"->>'username' ILIKE :pattern`, { pattern })
			// u.email was missing from this list while the mapping below used it as
			// the fallback label, so a user with no display name came back with
			// `name: undefined` and the autocomplete rendered a blank, unpickable row.
			.select([
				'u.id',
				'u.email',
				'profile.displayName',
				'oauth.id',
				'oauth.profileData',
			])
			// take()/skip() (not limit()/offset()) so TypeORM paginates by distinct
			// root entity: a plain LIMIT is applied to the flat SQL row set, and
			// with the one-to-many oauth join above that would cut a multi-provider
			// user's rows mid-way — or drop matched users entirely — well before 8
			// distinct people are collected.
			.take(8)
			.getMany();

		return {
			users: users.map((u) => {
				const oauthName = (u.oauthAccounts ?? [])
					.map((account) => resolveOAuthDisplayName(account.profileData))
					.find((name): name is string => Boolean(name));

				return {
					userId: u.id,
					// The email is used as a label of last resort, but is not returned
					// as its own field — it was always undefined there anyway, and
					// nothing consumes it. Note this endpoint still reveals an address
					// to any authenticated caller who guesses part of it; narrowing
					// that to exact email match is a product decision, not a bug fix.
					name: u.profile?.displayName ?? oauthName ?? u.email,
				};
			}),
		};
	}

	private generateShareToken(): string {
		return randomBytes(16).toString('base64url'); // 22 chars, unguessable
	}
}
