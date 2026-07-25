import { NotFoundException } from '@nestjs/common';
import { BadmintonService } from './badminton.service';
import { CreateBadmintonSessionDto } from './dto/create-badminton-session.dto';

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

describe('BadmintonService', () => {
  let service: BadmintonService;
  let sessionRepo: ReturnType<typeof mockRepo>;
  let participantRepo: ReturnType<typeof mockRepo>;
  let usersRepo: ReturnType<typeof mockRepo>;

  beforeEach(() => {
    sessionRepo = mockRepo();
    participantRepo = mockRepo();
    usersRepo = mockRepo();
    service = new BadmintonService(
      sessionRepo as never,
      participantRepo as never,
      usersRepo as never,
    );
  });

  it('create: sets owner, generates a share token, and stores a reconciled snapshot', async () => {
    const dto: CreateBadmintonSessionDto = {
      playedOn: '2026-07-25',
      courtCost: 100_000,
      shuttleUnitPrice: 1_000,
      participants: [
        { name: 'A', shuttleCount: 10 },
        { name: 'B', shuttleCount: 10 },
      ],
    };

    const saved: any = await service.create('owner-1', dto);

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

  it('create: applies field defaults (courtFraction=1, discount=0, shuttleCount=0)', async () => {
    const dto: CreateBadmintonSessionDto = {
      playedOn: '2026-07-25',
      courtCost: 50_000,
      shuttleUnitPrice: 1_000,
      participants: [{ name: 'Solo' }],
    };
    const saved: any = await service.create('owner-1', dto);
    const p = saved.participants[0];
    expect(p.courtFraction).toBe(1);
    expect(p.discount).toBe(0);
    expect(p.shuttleCount).toBe(0);
  });

  it('findOneOwned: throws NotFound when the session is not owned', async () => {
    sessionRepo.findOne.mockResolvedValue(null);
    await expect(service.findOneOwned('owner-1', 'sess-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(sessionRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'sess-1', ownerId: 'owner-1' },
      relations: { participants: true },
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
      participants: [
        { id: 'p1', name: 'A', courtFraction: 1, discount: 0, shuttleCount: 10 },
      ],
      computed: undefined,
    };
    sessionRepo.findOne.mockResolvedValue(existing);

    const res: any = await service.update('o1', 's1', { courtCost: 200_000 });

    expect(res.courtCost).toBe(200_000);
    expect(res.computed.courtCost).toBe(200_000);
    expect(sessionRepo.save).toHaveBeenCalledTimes(1);
  });

  it('remove: soft-removes an owned session and returns its id', async () => {
    const existing = { id: 's1', ownerId: 'o1', participants: [] };
    sessionRepo.findOne.mockResolvedValue(existing);

    const res = await service.remove('o1', 's1');

    expect(sessionRepo.softRemove).toHaveBeenCalledWith(existing);
    expect(res).toEqual({ id: 's1' });
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
      participants: [
        {
          id: 'p1',
          userId: 'secret-user',
          name: 'A',
          courtFraction: 1,
          discount: 0,
          shuttleCount: 10,
        },
      ],
      computed: { rows: [] },
    });

    const view: any = await service.findByShareToken('tok');

    expect(view.ownerId).toBeUndefined();
    expect(view.participants[0].userId).toBeUndefined();
    expect(view.participants[0].name).toBe('A');
    expect(view.title).toBe('Friday');
  });
});
