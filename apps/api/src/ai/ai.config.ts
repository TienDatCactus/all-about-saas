import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { openai } from '@ai-sdk/openai';

/**
 * Kimi (Moonshot) is OpenAI-compatible, so it plugs into AI SDK Core through
 * this generic adapter rather than a dedicated `@ai-sdk/moonshot` package
 * (none exists). Retry behavior for transient 5xx/429s is handled by the `ai`
 * package's own defaults at the call site (e.g. Task 7's `streamText`, Task 3/4's
 * `embed`), not here.
 */
const moonshot = createOpenAICompatible({
	name: 'moonshot',
	baseURL: 'https://api.moonshot.ai/v1',
	apiKey: process.env.KIMI_API_KEY!,
});

export const kimiChatModel = moonshot.chatModel('kimi-k2.6');

/**
 * Embeddings run on OpenAI rather than Moonshot: `text-embedding-3-small` is
 * cheap, well-documented, and gives a known vector size (1536) for the Qdrant
 * collection. This is the only place OpenAI is used — chat stays on Kimi.
 */
export const embeddingModel = openai.embedding('text-embedding-3-small');

export const EMBEDDING_DIMENSIONS = 1536;
