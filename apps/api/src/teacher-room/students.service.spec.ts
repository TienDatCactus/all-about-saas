import { StudentsService } from './students.service';

function mockRepo() {
	return {
		find: jest.fn(async () => []),
		findOne: jest.fn(),
		create: jest.fn((x: unknown) => x),
		save: jest.fn(async (x: unknown) => x),
	};
}

describe('StudentsService', () => {
	it('suggest returns owner-scoped name matches for a query of 2+ characters', async () => {
		const repo = mockRepo();
		const service = new StudentsService(repo as never);

		await service.suggest('owner-1', 'An');

		expect(repo.find).toHaveBeenCalledWith({
			where: { ownerId: 'owner-1', name: expect.anything() },
			take: 8,
			order: { name: 'ASC' },
		});
	});

	it('suggest short-circuits below the 2-character minimum without querying', async () => {
		const repo = mockRepo();
		const service = new StudentsService(repo as never);

		const result = await service.suggest('owner-1', 'A');

		expect(result).toEqual([]);
		expect(repo.find).not.toHaveBeenCalled();
	});

	it('findOrCreate reuses an existing student on a case-insensitive exact name match', async () => {
		const repo = mockRepo();
		repo.findOne.mockResolvedValue({ id: 'student-1', ownerId: 'owner-1', name: 'An' });
		const service = new StudentsService(repo as never);

		const student = await service.findOrCreate('owner-1', 'an');

		expect(student).toEqual({ id: 'student-1', ownerId: 'owner-1', name: 'An' });
		expect(repo.create).not.toHaveBeenCalled();
	});

	it('findOrCreate creates a new student when no name matches', async () => {
		const repo = mockRepo();
		repo.findOne.mockResolvedValue(null);
		const service = new StudentsService(repo as never);

		await service.findOrCreate('owner-1', '  Bình  ');

		expect(repo.create).toHaveBeenCalledWith({ ownerId: 'owner-1', name: 'Bình' });
	});
});
