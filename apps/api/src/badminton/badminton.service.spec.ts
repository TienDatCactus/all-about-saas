import { NotFoundException } from '@nestjs/common';
import { BadmintonService } from './badminton.service';
import {
	BadmintonParticipant,
	ParticipantGender,
} from './entities/badminton-participant.entity';
import { BadmintonSession } from './entities/badminton-session.entity';
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
		findBy: jest.fn(async () => []),
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

	it('update: replaces participants inside a single transaction (delete + save share the manager)', async () => {
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

		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
		expect(manager.delete).toHaveBeenCalledWith(BadmintonParticipant, {
			sessionId: 's1',
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
		// updateSession() now re-reads the row after save() (see the next test for
		// why), so manager.findOne is called twice: once for the locked read, once
		// for the post-save re-fetch. mockResolvedValueOnce pins each call's shape.
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
			.mockResolvedValueOnce(populated);

		const saved: any = await service.updateSession('owner-1', 'session-1', {
			paymentMethodId: 'method-1',
		});

		expect(saved.paymentMethod).toEqual(populated.paymentMethod);
		expect(manager.findOne).toHaveBeenCalledTimes(2);
		expect(manager.findOne).toHaveBeenLastCalledWith(BadmintonSession, {
			where: { id: 'session-1' },
			relations: { participants: true, paymentMethod: true },
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
