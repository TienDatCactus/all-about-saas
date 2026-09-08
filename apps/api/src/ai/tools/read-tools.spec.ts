import { buildReadTools } from './read-tools';
import type { RagService } from '../rag.service';

describe('buildReadTools', () => {
	function deps() {
		return { ragService: { search: jest.fn() } as unknown as RagService };
	}

	it('searchKnowledgeBase delegates to RagService.search', async () => {
		const d = deps();
		(d.ragService.search as jest.Mock).mockResolvedValue([
			{ heading: '§5', text: 'Split by hours.', score: 0.9 },
		]);

		const tools = buildReadTools(d);
		const result = await tools.searchKnowledgeBase.execute!(
			{ query: 'how is cost split' },
			{ toolCallId: 't2', messages: [] } as any,
		);

		expect(d.ragService.search).toHaveBeenCalledWith('how is cost split');
		expect(result).toEqual([
			{ heading: '§5', text: 'Split by hours.', score: 0.9 },
		]);
	});
});
