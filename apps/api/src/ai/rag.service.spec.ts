import { RagService } from './rag.service';

jest.mock('ai', () => ({
	embed: jest.fn(),
}));
import { embed } from 'ai';

describe('RagService', () => {
	function mockQdrant() {
		return { search: jest.fn() };
	}

	it('embeds the query and returns scored chunks', async () => {
		const qdrant = mockQdrant();
		(embed as jest.Mock).mockResolvedValue({ embedding: [0.1, 0.2] });
		qdrant.search.mockResolvedValue([
			{
				score: 0.91,
				payload: {
					text: 'Court cost splits by hoursPlayed.',
					heading: '§5 Algorithm',
				},
			},
		]);

		const service = new RagService(qdrant as never);
		const results = await service.search('how is court cost split');

		expect(embed).toHaveBeenCalledWith(
			expect.objectContaining({ value: 'how is court cost split' }),
		);
		expect(qdrant.search).toHaveBeenCalledWith(
			'twinfoundry-kb',
			expect.objectContaining({
				vector: [0.1, 0.2],
				limit: 4,
				with_payload: true,
			}),
		);
		expect(results).toEqual([
			{
				text: 'Court cost splits by hoursPlayed.',
				heading: '§5 Algorithm',
				score: 0.91,
			},
		]);
	});

	it('returns an empty array instead of throwing when Qdrant is unreachable', async () => {
		const qdrant = mockQdrant();
		(embed as jest.Mock).mockResolvedValue({ embedding: [0.1] });
		qdrant.search.mockRejectedValue(new Error('ECONNREFUSED'));

		const service = new RagService(qdrant as never);
		await expect(service.search('anything')).resolves.toEqual([]);
	});
});
