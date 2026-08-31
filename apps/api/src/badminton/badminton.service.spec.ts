import { NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { BadmintonService } from './badminton.service';
import {
	BadmintonParticipant,
	ParticipantGender,
} from './entities/badminton-participant.entity';
import { BadmintonSession } from './entities/badminton-session.entity';
import { PaymentMethod } from '../payment-methods/entities/payment-method.entity';
import { CreateBadmintonSessionDto } from './badminton.dto';

/** Minimal TypeORM Repository stub — create() echoes its input, save() echoes the entity. */
function mockRepo() {
	return {
		create: jest.fn((x: unknown) => x),
		save: jest.fn(async (x: unknown) => x),
		find: jest.fn(),
		findOne: jest.fn(),
		softRemove: jest.fn(async (x: unknown) => x),
		createQueryBuilder: jest.fn(),
	};
}

/**
 * DataSource stub whose transaction() runs the callback with a shared manager.
 * updateSession() now does its locked read through this manager, so findOne is
 * the seam tests use to supply the existing session.
 */
function mockDataSource() {
	const manager = {
		findOne: jest.fn(),
		// The return type is widened by hand: `async () => []` infers `never[]`,
		// which then refuses the concrete participant rows the upsert tests supply.
		findBy: jest.fn(async (): Promise<unknown[]> => []),
		delete: jest.fn(),
		save: jest.fn(async (x: unknown) => x),
	};
	const dataSource = {
		transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
	};
	return { manager, dataSource };
}

describe('BadmintonService', () => {
	let service: BadmintonService;
	let sessionRepo: ReturnType<typeof mockRepo>;
	let participantRepo: ReturnType<typeof mockRepo>;
	let usersRepo: ReturnType<typeof mockRepo>;
	let manager: ReturnType<typeof mockDataSource>['manager'];
	let dataSource: ReturnType<typeof mockDataSource>['dataSource'];

	beforeEach(() => {
		sessionRepo = mockRepo();
		participantRepo = mockRepo();
		usersRepo = mockRepo();
		({ manager, dataSource } = mockDataSource());
		service = new BadmintonService(
			sessionRepo as never,
			participantRepo as never,
			usersRepo as never,
			dataSource as never,
		);
	});

	it('create: sets owner, generates a share token, and stores a reconciled snapshot', async () => {
		const dto: CreateBadmintonSessionDto = {
			playedOn: '2026-07-25',
			courtCost: 100_000,
			shuttleUnitPrice: 1_000,
			totalShuttleCount: 20,
			participants: [
				{ name: 'A', shuttleWeight: 6 },
				{ name: 'B', shuttleWeight: 4 },
			],
		};

		const saved: any = await service.createSession('owner-1', dto);

		expect(saved.ownerId).toBe('owner-1');
		expect(typeof saved.shareToken).toBe('string');
		expect(saved.shareToken.length).toBeGreaterThanOrEqual(20);
		expect(saved.computed.rows).toHaveLength(2);
		// reconciliation invariant survives the service path
		const collected = saved.computed.rows.reduce(
			(a: number, r: any) => a + r.total,
			0,
		);
		expect(collected).toBe(saved.computed.grandTotal);
		// each participant got a generated id
		expect(saved.participants.every((p: any) => typeof p.id === 'string')).toBe(
			true,
		);
		expect(sessionRepo.save).toHaveBeenCalledTimes(1);
	});

	it('create: applies field defaults (hoursPlayed=1, shuttleWeight=6 — nam-equivalent)', async () => {
		const dto: CreateBadmintonSessionDto = {
			playedOn: '2026-07-25',
			courtCost: 50_000,
			shuttleUnitPrice: 1_000,
			totalShuttleCount: 0,
			participants: [{ name: 'Solo' }],
		};
		const saved: any = await service.createSession('owner-1', dto);
		const p = saved.participants[0];
		expect(p.hoursPlayed).toBe(1);
		expect(p.shuttleWeight).toBe(6);
	});

	it('create: a participant with no hoursPlayed falls back to the caller-supplied defaultHoursPlayed, not the hardcoded 1', async () => {
		const dto: CreateBadmintonSessionDto = {
			playedOn: '2026-07-25',
			courtCost: 50_000,
			shuttleUnitPrice: 1_000,
			totalShuttleCount: 0,
			defaultHoursPlayed: 2.5,
			participants: [{ name: 'Solo' }],
		};
		const saved: any = await service.createSession('owner-1', dto);
		expect(saved.defaultHoursPlayed).toBe(2.5);
		expect(saved.participants[0].hoursPlayed).toBe(2.5);
	});

	it('create: falls back to 1 when neither the participant nor the DTO supplies hoursPlayed/defaultHoursPlayed', async () => {
		const dto: CreateBadmintonSessionDto = {
			playedOn: '2026-07-25',
			courtCost: 50_000,
			shuttleUnitPrice: 1_000,
			totalShuttleCount: 0,
			participants: [{ name: 'Solo' }],
		};
		const saved: any = await service.createSession('owner-1', dto);
		expect(saved.defaultHoursPlayed).toBe(1);
		expect(saved.participants[0].hoursPlayed).toBe(1);
	});

	it('create: stores gender when provided (UI convenience field, not read by the calc)', async () => {
		const dto: CreateBadmintonSessionDto = {
			playedOn: '2026-07-25',
			courtCost: 50_000,
			shuttleUnitPrice: 1_000,
			totalShuttleCount: 0,
			participants: [
				{ name: 'A', gender: ParticipantGender.MALE },
				{ name: 'B', gender: ParticipantGender.FEMALE },
			],
		};
		const saved: any = await service.createSession('owner-1', dto);
		expect(saved.participants.find((p: any) => p.name === 'A').gender).toBe(
			ParticipantGender.MALE,
		);
		expect(saved.participants.find((p: any) => p.name === 'B').gender).toBe(
			ParticipantGender.FEMALE,
		);
	});

	it('findOneOwned: throws NotFound when the session is not owned', async () => {
		sessionRepo.findOne.mockResolvedValue(null);
		await expect(
			service.findOneOwned('owner-1', 'sess-1'),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(sessionRepo.findOne).toHaveBeenCalledWith({
			where: { id: 'sess-1', ownerId: 'owner-1' },
			relations: { participants: true, paymentMethod: true },
		});
	});

	it('update: recomputes the snapshot after changing the court cost', async () => {
		const existing = {
			id: 's1',
			ownerId: 'o1',
			playedOn: '2026-07-25',
			title: undefined,
			courtCost: 100_000,
			shuttleUnitPrice: 1_000,
			totalShuttleCount: 10,
			participants: [
				{
					id: 'p1',
					name: 'A',
					hoursPlayed: 1,
					shuttleWeight: 1,
				},
			],
			computed: undefined,
		};
		manager.findOne.mockResolvedValue(existing);

		const res: any = await service.updateSession('o1', 's1', {
			courtCost: 200_000,
		});

		expect(res.courtCost).toBe(200_000);
		expect(res.computed.courtCost).toBe(200_000);
		expect(manager.save).toHaveBeenCalledTimes(1);
		// No participant payload → nothing to replace.
		expect(manager.delete).not.toHaveBeenCalled();
	});

	it('update: replacement participants get generated ids that the snapshot rows reference', async () => {
		const existing = {
			id: 's1',
			ownerId: 'o1',
			playedOn: '2026-07-25',
			courtCost: 100_000,
			shuttleUnitPrice: 1_000,
			totalShuttleCount: 10,
			defaultHoursPlayed: 1,
			participants: [
				{
					id: 'p-old',
					name: 'Old',
					hoursPlayed: 1,
					shuttleWeight: 1,
				},
			],
			computed: undefined,
		};
		manager.findOne.mockResolvedValue(existing);

		const res: any = await service.updateSession('o1', 's1', {
			participants: [{ name: 'X' }, { name: 'Y' }],
		});

		expect(res.participants).toHaveLength(2);
		for (const p of res.participants) {
			expect(typeof p.id).toBe('string');
			expect(p.id).not.toBe('p-old');
		}
		// The stored snapshot must reference the participants we actually save.
		expect(res.computed.rows.map((r: any) => r.participantId)).toEqual(
			res.participants.map((p: any) => p.id),
		);
		// Same field defaults as create(), so the snapshot never computes on undefined.
		expect(res.participants[0].hoursPlayed).toBe(1);
		expect(res.participants[0].shuttleWeight).toBe(6);
		expect(res.computed.rows.every((r: any) => Number.isFinite(r.total))).toBe(
			true,
		);
	});

	it('update: swaps participants inside a single transaction (delete + save share the manager)', async () => {
		const existing = {
			id: 's1',
			ownerId: 'o1',
			playedOn: '2026-07-25',
			courtCost: 100_000,
			shuttleUnitPrice: 1_000,
			totalShuttleCount: 10,
			participants: [],
			computed: undefined,
		};
		manager.findOne.mockResolvedValue(existing);
		// One stored participant, absent from the payload below, so the delete leg
		// of the transaction actually has something to do.
		manager.findBy.mockResolvedValue([
			{ id: 'p-gone', name: 'Gone', hoursPlayed: 1, shuttleWeight: 6 },
		]);

		await service.updateSession('o1', 's1', { participants: [{ name: 'X' }] });

		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
		expect(manager.delete).toHaveBeenCalledWith(BadmintonParticipant, {
			id: In(['p-gone']),
		});
		expect(manager.save).toHaveBeenCalledTimes(1);
		// Nothing may bypass the transaction boundary.
		expect(participantRepo.save).not.toHaveBeenCalled();
		expect(sessionRepo.save).not.toHaveBeenCalled();
	});

	it('update: a failed save propagates so the transaction rolls the delete back', async () => {
		const existing = {
			id: 's1',
			ownerId: 'o1',
			playedOn: '2026-07-25',
			courtCost: 100_000,
			shuttleUnitPrice: 1_000,
			totalShuttleCount: 10,
			participants: [],
			computed: undefined,
		};
		manager.findOne.mockResolvedValue(existing);
		manager.save.mockRejectedValue(new Error('db down'));

		await expect(
			service.updateSession('o1', 's1', { participants: [{ name: 'X' }] }),
		).rejects.toThrow('db down');
	});

	it('update: locks the session row FOR UPDATE before touching participants', async () => {
		const existing = {
			id: 's1',
			ownerId: 'o1',
			playedOn: '2026-07-25',
			courtCost: 100_000,
			shuttleUnitPrice: 1_000,
			totalShuttleCount: 10,
			participants: [],
			computed: undefined,
		};
		manager.findOne.mockResolvedValue(existing);

		await service.updateSession('o1', 's1', { participants: [{ name: 'X' }] });

		// Concurrent updates must serialize here, so the read has to be a locking
		// read inside the transaction — not the unlocked repo read it used to be.
		expect(manager.findOne).toHaveBeenCalledWith(BadmintonSession, {
			where: { id: 's1', ownerId: 'o1' },
			lock: { mode: 'pessimistic_write' },
		});
		expect(sessionRepo.findOne).not.toHaveBeenCalled();
		// The lock query cannot join participants; they load separately.
		expect(manager.findBy).toHaveBeenCalledWith(BadmintonParticipant, {
			sessionId: 's1',
		});
	});

	it('update: throws NotFound when the locked read matches no owned session', async () => {
		manager.findOne.mockResolvedValue(null);

		await expect(
			service.updateSession('o1', 'nope', { courtCost: 1 }),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(manager.save).not.toHaveBeenCalled();
		expect(manager.delete).not.toHaveBeenCalled();
	});

	it('remove: soft-removes an owned session and returns its id', async () => {
		const existing = { id: 's1', ownerId: 'o1', participants: [] };
		sessionRepo.findOne.mockResolvedValue(existing);

		const res = await service.removeSession('o1', 's1');

		expect(sessionRepo.softRemove).toHaveBeenCalledWith(existing);
		expect(res).toEqual({ id: 's1' });
	});

	// Ownership is the whole authorization model now that the permission layer is
	// gone: it lives in the service's query, not in a guard. These three pin that
	// a session belonging to someone else is indistinguishable from a missing one.
	describe("another owner's session", () => {
		beforeEach(() => {
			// findOneOwned filters on { id, ownerId }, so a foreign row simply misses.
			sessionRepo.findOne.mockResolvedValue(null);
		});

		it('is not readable', async () => {
			await expect(
				service.findOneOwned('intruder', 's1'),
			).rejects.toBeInstanceOf(NotFoundException);
			expect(sessionRepo.findOne).toHaveBeenCalledWith({
				where: { id: 's1', ownerId: 'intruder' },
				relations: { participants: true, paymentMethod: true },
			});
		});

		it('is not updatable', async () => {
			manager.findOne.mockResolvedValue(null);

			await expect(
				service.updateSession('intruder', 's1', { courtCost: 1 }),
			).rejects.toBeInstanceOf(NotFoundException);
			expect(manager.save).not.toHaveBeenCalled();
		});

		it('is not deletable', async () => {
			await expect(
				service.removeSession('intruder', 's1'),
			).rejects.toBeInstanceOf(NotFoundException);
			expect(sessionRepo.softRemove).not.toHaveBeenCalled();
		});
	});

	it('updateSession: accepts paymentMethodId and passes it straight through to save', async () => {
		// updateSession() makes three manager.findOne calls for this payload: the
		// locked session read, the payment-method ownership check, then the
		// post-save re-fetch (see the next test for why that one exists).
		// mockResolvedValueOnce pins each call's shape in order.
		const locked = {
			id: 'session-1',
			ownerId: 'owner-1',
			courtCost: 0,
			shuttleUnitPrice: 0,
			totalShuttleCount: 0,
			participants: [],
		};
		manager.findOne = jest
			.fn()
			.mockResolvedValueOnce(locked)
			.mockResolvedValueOnce({ id: 'method-1', userId: 'owner-1' })
			.mockResolvedValueOnce({ ...locked, paymentMethodId: 'method-1' });

		const saved: any = await service.updateSession('owner-1', 'session-1', {
			paymentMethodId: 'method-1',
		});

		expect(saved.paymentMethodId).toBe('method-1');
	});

	it('updateSession: re-fetches with relations so paymentMethod comes back populated, not just the raw id', async () => {
		const locked = {
			id: 'session-1',
			ownerId: 'owner-1',
			courtCost: 0,
			shuttleUnitPrice: 0,
			totalShuttleCount: 0,
			participants: [],
		};
		const populated = {
			...locked,
			paymentMethodId: 'method-1',
			paymentMethod: {
				id: 'method-1',
				type: 'phone',
				label: 'Cá nhân',
				imageUrl: null,
				phoneNumber: '0338722615',
			},
		};
		manager.findOne = jest
			.fn()
			.mockResolvedValueOnce(locked)
			.mockResolvedValueOnce({ id: 'method-1', userId: 'owner-1' })
			.mockResolvedValueOnce(populated);

		const saved: any = await service.updateSession('owner-1', 'session-1', {
			paymentMethodId: 'method-1',
		});

		expect(saved.paymentMethod).toEqual(populated.paymentMethod);
		expect(manager.findOne).toHaveBeenCalledTimes(3);
		expect(manager.findOne).toHaveBeenLastCalledWith(BadmintonSession, {
			where: { id: 'session-1' },
			relations: { participants: true, paymentMethod: true },
		});
	});

	// Saving a session used to DELETE every participant row and re-INSERT the
	// payload with fresh randomUUID()s, so pressing "Save changes" after nudging
	// one player's hours silently reset everyone to unpaid. These pin the upsert
	// that replaced it.
	describe('updateSession: participant upsert', () => {
		const paidAt = new Date('2026-08-01T10:00:00.000Z');

		/** Two stored participants: A has been marked paid, B has not. */
		const stored = () => [
			{
				id: 'p-a',
				sessionId: 's1',
				userId: null,
				name: 'A',
				hoursPlayed: 1,
				shuttleWeight: 6,
				gender: null,
				paid: true,
				paidAt,
			},
			{
				id: 'p-b',
				sessionId: 's1',
				userId: null,
				name: 'B',
				hoursPlayed: 2,
				shuttleWeight: 4,
				gender: null,
				paid: false,
				paidAt: null,
			},
		];

		const locked = () => ({
			id: 's1',
			ownerId: 'o1',
			playedOn: '2026-07-25',
			courtCost: 90_000,
			shuttleUnitPrice: 1_000,
			totalShuttleCount: 9,
			defaultHoursPlayed: 1,
			participants: [],
			computed: undefined,
		});

		it('keeps paid/paidAt and the id for reused participants, inserts new ones unpaid', async () => {
			manager.findOne.mockResolvedValue(locked());
			manager.findBy.mockResolvedValue(stored());

			const res: any = await service.updateSession('o1', 's1', {
				participants: [
					// A: same id, hours changed.
					{ id: 'p-a', name: 'A', hoursPlayed: 3, shuttleWeight: 6 },
					// B: same id, untouched.
					{ id: 'p-b', name: 'B', hoursPlayed: 2, shuttleWeight: 4 },
					// C: brand new, no id.
					{ name: 'C' },
				],
			});

			const byName: Record<string, any> = Object.fromEntries(
				res.participants.map((p: any) => [p.name, p]),
			);

			// A: the edit lands, the id does not move, the payment status survives.
			expect(byName.A.id).toBe('p-a');
			expect(byName.A.hoursPlayed).toBe(3);
			expect(byName.A.paid).toBe(true);
			expect(byName.A.paidAt).toBe(paidAt);

			// B: untouched in every respect, including still being unpaid.
			expect(byName.B.id).toBe('p-b');
			expect(byName.B.hoursPlayed).toBe(2);
			expect(byName.B.paid).toBe(false);
			expect(byName.B.paidAt).toBeNull();

			// C: a generated id, and no payment status of its own — the column
			// default (false) is what applies at INSERT.
			expect(typeof byName.C.id).toBe('string');
			expect(byName.C.id).not.toBe('p-a');
			expect(byName.C.id).not.toBe('p-b');
			expect(byName.C).not.toHaveProperty('paid');
			expect(byName.C.hoursPlayed).toBe(1);
			expect(byName.C.shuttleWeight).toBe(6);

			// Nobody was dropped, so nothing may be deleted.
			expect(manager.delete).not.toHaveBeenCalled();
			// The snapshot still references the ids the rows are stored under, and
			// reused ids are exactly what makes the paid toggles keep working.
			expect(res.computed.rows.map((r: any) => r.participantId)).toEqual([
				'p-a',
				'p-b',
				byName.C.id,
			]);
		});

		it('deletes only the participants the payload dropped', async () => {
			manager.findOne.mockResolvedValue(locked());
			manager.findBy.mockResolvedValue(stored());

			const res: any = await service.updateSession('o1', 's1', {
				participants: [{ id: 'p-a', name: 'A', hoursPlayed: 1 }],
			});

			expect(manager.delete).toHaveBeenCalledTimes(1);
			expect(manager.delete).toHaveBeenCalledWith(BadmintonParticipant, {
				id: In(['p-b']),
			});
			expect(res.participants.map((p: any) => p.id)).toEqual(['p-a']);
			// Removing someone else must not disturb the survivor's payment status.
			expect(res.participants[0].paid).toBe(true);
		});

		it('inserts a fresh row for an id that names no participant of this session', async () => {
			manager.findOne.mockResolvedValue(locked());
			manager.findBy.mockResolvedValue(stored());

			const res: any = await service.updateSession('o1', 's1', {
				participants: [
					{ id: 'p-a', name: 'A' },
					{ id: 'p-b', name: 'B' },
					// Belongs to a different session (or nothing at all). Reusing it
					// verbatim would let a cascading save re-parent that row, so the
					// service generates its own id instead.
					{ id: '11111111-2222-3333-4444-555555555555', name: 'Stranger' },
				],
			});

			const stranger = res.participants.find((p: any) => p.name === 'Stranger');
			expect(stranger.id).not.toBe('11111111-2222-3333-4444-555555555555');
			expect(typeof stranger.id).toBe('string');
		});

		it('inserts a brand-new participant with the NEW defaultHoursPlayed when the update payload changes it alongside an existing participant', async () => {
			manager.findOne.mockResolvedValue(locked());
			manager.findBy.mockResolvedValue(stored());

			const res: any = await service.updateSession('o1', 's1', {
				defaultHoursPlayed: 5,
				participants: [
					// Existing participant, matched by id, and (per
					// apps/web/src/pages/badminton/lib/form.ts's valuesToPayload())
					// always carrying its current hoursPlayed explicitly in the real
					// frontend flow — included here regardless.
					{ id: 'p-a', name: 'A', hoursPlayed: 3, shuttleWeight: 6 },
					// Brand new, no id and no hoursPlayed: this is the case the
					// feature targets — it must pick up the just-updated default,
					// not the pre-update value and not the hardcoded 1.
					{ name: 'C' },
				],
			});

			const byName: Record<string, any> = Object.fromEntries(
				res.participants.map((p: any) => [p.name, p]),
			);
			expect(res.defaultHoursPlayed).toBe(5);
			expect(byName.A.hoursPlayed).toBe(3);
			expect(byName.C.hoursPlayed).toBe(5);
		});

		// Defensive-only: the actual frontend always sends every participant's
		// current hoursPlayed explicitly (valuesToPayload() in
		// apps/web/src/pages/badminton/lib/form.ts maps every player through
		// `nonNegative(p.hoursPlayed)`, which is never undefined), so this path is
		// never hit by the web app. It exists only for a direct API caller that
		// omits hoursPlayed on an existing row's payload entry — pinned here purely
		// to verify the `?? session.defaultHoursPlayed` fallback expression itself
		// is correct in the matched-row branch, not because the product wants
		// changing the default to retroactively touch existing participants (that
		// retroactive-overwrite behavior is a frontend-only form-state effect).
		it('falls back an existing matched participant with no hoursPlayed in its payload entry to the new default too (defensive fallback, not the real frontend path)', async () => {
			manager.findOne.mockResolvedValue(locked());
			manager.findBy.mockResolvedValue(stored());

			const res: any = await service.updateSession('o1', 's1', {
				defaultHoursPlayed: 7,
				participants: [
					// No hoursPlayed at all on this matched entry.
					{ id: 'p-a', name: 'A' },
				],
			});

			expect(res.participants[0].id).toBe('p-a');
			expect(res.participants[0].hoursPlayed).toBe(7);
		});

		it('gives a repeated id one updated row and one new row, never the same entity twice', async () => {
			manager.findOne.mockResolvedValue(locked());
			manager.findBy.mockResolvedValue(stored());

			const res: any = await service.updateSession('o1', 's1', {
				participants: [
					{ id: 'p-a', name: 'A' },
					{ id: 'p-a', name: 'A again' },
					{ id: 'p-b', name: 'B' },
				],
			});

			const ids = res.participants.map((p: any) => p.id);
			expect(new Set(ids).size).toBe(ids.length);
			expect(res.participants[0]).not.toBe(res.participants[1]);
		});
	});

	// A paymentMethodId reached the column through Object.assign() with no check
	// at all, so any authenticated host could attach someone else's QR image or
	// phone number to their own share page, and a made-up id 500'd on the foreign
	// key instead of 404-ing. The lookup is owner-scoped, so both cases now look
	// identical from outside.
	describe('updateSession: paymentMethodId ownership', () => {
		const locked = () => ({
			id: 's1',
			ownerId: 'o1',
			courtCost: 0,
			shuttleUnitPrice: 0,
			totalShuttleCount: 0,
			participants: [],
		});

		it("404s when the method belongs to another user (or doesn't exist)", async () => {
			manager.findOne = jest.fn(async (entity: unknown) =>
				entity === BadmintonSession ? locked() : null,
			);

			await expect(
				service.updateSession('o1', 's1', {
					paymentMethodId: 'someone-elses-method',
				}),
			).rejects.toBeInstanceOf(NotFoundException);
			// The lookup must be scoped to the caller, not a bare findOne by id.
			expect(manager.findOne).toHaveBeenCalledWith(PaymentMethod, {
				where: { id: 'someone-elses-method', userId: 'o1' },
			});
			// Rejected before anything was written.
			expect(manager.save).not.toHaveBeenCalled();
			expect(manager.delete).not.toHaveBeenCalled();
		});

		it('still accepts a method the caller owns', async () => {
			const session = locked();
			manager.findOne = jest.fn(async (entity: unknown) =>
				entity === BadmintonSession ? session : { id: 'm1', userId: 'o1' },
			);

			const saved: any = await service.updateSession('o1', 's1', {
				paymentMethodId: 'm1',
			});

			expect(saved.paymentMethodId).toBe('m1');
			expect(manager.save).toHaveBeenCalledTimes(1);
		});

		it('skips the lookup entirely when clearing the method with null', async () => {
			const session = locked();
			manager.findOne = jest.fn(async () => session);

			const saved: any = await service.updateSession('o1', 's1', {
				paymentMethodId: null,
			});

			// null is a legitimate value meaning "detach", not an id to authorize.
			expect(manager.findOne).not.toHaveBeenCalledWith(
				PaymentMethod,
				expect.anything(),
			);
			expect(saved.paymentMethodId).toBeNull();
		});
	});

	it('findOneOwned: includes the paymentMethod relation', async () => {
		sessionRepo.findOne = jest.fn(async () => ({
			id: 's',
			ownerId: 'owner-1',
			participants: [],
		}));
		await service.findOneOwned('owner-1', 's');
		expect(sessionRepo.findOne).toHaveBeenCalledWith(
			expect.objectContaining({
				relations: { participants: true, paymentMethod: true },
			}),
		);
	});

	it('findByShareToken: returns a PII-safe view without owner/userId', async () => {
		sessionRepo.findOne.mockResolvedValue({
			id: 's1',
			ownerId: 'secret-owner',
			shareToken: 'tok',
			title: 'Friday',
			playedOn: '2026-07-25',
			courtCost: 100_000,
			shuttleUnitPrice: 1_000,
			totalShuttleCount: 10,
			participants: [
				{
					id: 'p1',
					userId: 'secret-user',
					name: 'A',
					hoursPlayed: 1,
					shuttleWeight: 1,
					gender: ParticipantGender.MALE,
				},
			],
			computed: { rows: [] },
		});

		const view: any = await service.findByShareToken('tok');

		expect(view.ownerId).toBeUndefined();
		expect(view.participants[0].userId).toBeUndefined();
		expect(view.participants[0].name).toBe('A');
		expect(view.participants[0].gender).toBe(ParticipantGender.MALE);
		expect(view.title).toBe('Friday');
	});

	it('setParticipantPaid: sets paid + paidAt when marking paid, scoped to the owner', async () => {
		sessionRepo.findOne = jest.fn(async () => ({
			id: 's',
			ownerId: 'owner-1',
		}));
		participantRepo.findOne = jest.fn(async () => ({
			id: 'p1',
			sessionId: 's',
			paid: false,
			paidAt: null,
		}));

		const saved: any = await service.setParticipantPaid(
			'owner-1',
			's',
			'p1',
			true,
		);

		expect(saved.paid).toBe(true);
		expect(saved.paidAt).toBeInstanceOf(Date);
	});

	it('setParticipantPaid: clears paidAt when marking unpaid', async () => {
		sessionRepo.findOne = jest.fn(async () => ({
			id: 's',
			ownerId: 'owner-1',
		}));
		participantRepo.findOne = jest.fn(async () => ({
			id: 'p1',
			sessionId: 's',
			paid: true,
			paidAt: new Date(),
		}));

		const saved: any = await service.setParticipantPaid(
			'owner-1',
			's',
			'p1',
			false,
		);

		expect(saved.paid).toBe(false);
		expect(saved.paidAt).toBeNull();
	});

	it('setParticipantPaid: 404s when the session is not owned by the caller', async () => {
		sessionRepo.findOne = jest.fn(async () => null);
		await expect(
			service.setParticipantPaid('owner-1', 's', 'p1', true),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it('findByShareToken: exposes paid status and a PII-safe paymentMethod', async () => {
		sessionRepo.findOne = jest.fn(async () => ({
			title: 't',
			playedOn: '2026-01-01',
			courtCost: 0,
			shuttleUnitPrice: 0,
			totalShuttleCount: 0,
			participants: [
				{
					id: 'p1',
					name: 'A',
					hoursPlayed: 1,
					shuttleWeight: 6,
					gender: null,
					paid: true,
					paidAt: new Date('2026-01-02'),
				},
			],
			computed: null,
			paymentMethod: {
				id: 'm1',
				userId: 'owner-1',
				type: 'phone',
				label: 'Cá nhân',
				phoneNumber: '0338722615',
			},
		}));

		const result: any = await service.findByShareToken('tok');

		expect(result.participants[0].paid).toBe(true);
		expect(typeof result.participants[0].paidAt).toBe('string');
		expect(result.paymentMethod).toEqual({
			type: 'phone',
			label: 'Cá nhân',
			imageUrl: undefined,
			phoneNumber: '0338722615',
		});
		expect(result.paymentMethod.userId).toBeUndefined();
	});

	it('findByShareToken: paymentMethod is null when the session has none', async () => {
		sessionRepo.findOne = jest.fn(async () => ({
			title: 't',
			playedOn: '2026-01-01',
			courtCost: 0,
			shuttleUnitPrice: 0,
			totalShuttleCount: 0,
			participants: [],
			computed: null,
			paymentMethod: undefined,
		}));

		const result: any = await service.findByShareToken('tok');
		expect(result.paymentMethod).toBeNull();
	});
});
