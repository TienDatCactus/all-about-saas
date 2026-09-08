import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { openai } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

/**
 * Kimi (Moonshot) is OpenAI-compatible, so it plugs into AI SDK Core through
 * this generic adapter rather than a dedicated `@ai-sdk/moonshot` package
 * (none exists). Retry behavior for transient 5xx/429s is handled by the `ai`
 * package's own defaults at the call site (e.g. `handleMessage`'s
 * `streamText`, `RagService`'s `embed`), not here.
 *
 * Resolved lazily (`getKimiChatModel()`), NOT as a module-level const:
 * `createOpenAICompatible` reads `apiKey` eagerly into a frozen Authorization
 * header at construction time. This module is imported transitively — via
 * AiModule → ChatService — before `app.module.ts`'s own body runs
 * `resolveFileSecrets()` and `ConfigModule.forRoot()` (imports resolve before
 * an importing module's top-level statements do), so a module-level const
 * here would freeze in with NO Authorization header at all, silently, on
 * every deployment path this repo documents (`.env.*.local` files and
 * `_FILE` secrets alike). Calling this lazily, on first use inside
 * `handleMessage`, defers construction until well after the app has finished
 * booting.
 */
let kimiChatModelInstance: LanguageModel | undefined;
export function getKimiChatModel(): LanguageModel {
	if (!kimiChatModelInstance) {
		const moonshot = createOpenAICompatible({
			name: 'moonshot',
			baseURL: 'https://api.moonshot.ai/v1',
			apiKey: process.env.KIMI_API_KEY!,
		});
		kimiChatModelInstance = moonshot.chatModel('kimi-k2.6');
	}
	return kimiChatModelInstance;
}

/**
 * Embeddings run on OpenAI rather than Moonshot: `text-embedding-3-small` is
 * cheap, well-documented, and gives a known vector size (1536) for the Qdrant
 * collection. This is the only place OpenAI is used — chat stays on Kimi.
 * Safe as a module-level const, unlike `getKimiChatModel` above:
 * `@ai-sdk/openai` resolves its API key lazily at request time (`loadApiKey`
 * inside the actual `embed`/`embedMany` call), not at construction time.
 */
export const embeddingModel = openai.embedding('text-embedding-3-small');

export const EMBEDDING_DIMENSIONS = 1536;
