import { tool } from 'ai';
import { z } from 'zod';
import type { RagService } from '../rag.service';

export function buildReadTools(deps: { ragService: RagService }) {
	return {
		searchKnowledgeBase: tool({
			description:
				'Search TwinFoundry documentation for how the badminton cost split works (court cost, shuttle cost, hoursPlayed, shuttleWeight).',
			inputSchema: z.object({ query: z.string() }),
			execute: async ({ query }) => deps.ragService.search(query),
		}),
	};
}
