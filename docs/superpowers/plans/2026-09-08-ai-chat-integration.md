# TwinFoundry AI Chat Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a customer-facing AI chat to `apps/api` that can call into `BadmintonService` on the user's behalf (list/create sessions, mark a participant paid), with a human-approval gate before any write happens, plus a minimal `apps/web` chat widget to use it.

**Architecture:** A new `apps/api/src/ai/` NestJS module runs an AI SDK Core `streamText` loop against the Kimi K2 API (OpenAI-compatible) with a small set of in-process tools. Read tools execute inline; write tools only return a draft, which `ChatService` persists as a `pending` row in a new `chat_message` table — a separate confirm endpoint re-checks ownership and actually executes. A knowledge-base tool retrieves chunks of `docs/badminton-splitter-spec.md` from Qdrant Cloud. `apps/web` gets a thin chat page using `@ai-sdk/react`.

**Tech Stack:** NestJS 11, TypeORM 0.3, `ai` (AI SDK Core) 7.0.93, `@ai-sdk/openai-compatible` 3.0.44 (Kimi chat model), `@ai-sdk/openai` 4.0.60 (embeddings only), `@ai-sdk/react` 4.0.96, `@qdrant/js-client-rest` 1.19.0, zod 4 (already a dependency), TanStack Start / React 19 (`apps/web`).

**Spec:** [`docs/superpowers/specs/2026-09-08-ai-chat-integration-design.md`](../specs/2026-09-08-ai-chat-integration-design.md) — this plan implements it; read both.

## Global Constraints

- No new self-hosted service on the VPS for this feature — chat model and vector search are both external (Kimi K2 API, Qdrant Cloud).
- Tool-calling is agentic-in-chat (synchronous request/response) — no queue, no background worker.
- A mutating tool (`createBadmintonSession`, `setParticipantPaid`) never writes directly. It returns a draft; only `POST /ai/chat/confirm` may perform the real write, after re-checking ownership (`where: { id, ownerId }` — CASL was removed repo-wide per `docs/casl-removal-plan.md`, do not reintroduce it).
- No separate confirmation table. Pending-write state lives on `chat_message.toolCallState`; a pending row expires 15 minutes after `createdAt`.
- `tools` is a plain object literal passed straight into `streamText`'s `tools` option — no registry class/module.
- The Kimi model is one exported const from `createOpenAICompatible(...)` — no provider wrapper class.
- Rely on the AI SDK provider's built-in `maxRetries` for transient failures — no hand-rolled retry/backoff.
- Testing: unit tests per file with real behavior to test, plus exactly one e2e test covering the HTTP surface end-to-end (no separate service-level integration test duplicating it).
- Follow existing repo conventions exactly: tabs + single quotes + semicolons in `apps/api` TypeScript; no semicolons + double quotes in `apps/web` TypeScript (match `apps/api/src/badminton/*` and `apps/web/src/services/badminton/*` respectively).

---

### Task 1: Env config, dependencies, and the Kimi/embedding model consts

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/common/config/env.validation.ts`
- Modify: `apps/api/src/common/config/env.validation.spec.ts`
- Modify: `apps/api/src/common/config/configuration.ts`
- Modify: `apps/api/src/common/config/file-secrets.ts`
- Create: `apps/api/src/ai/ai.config.ts`
- Create: `apps/api/.env.example` entries (append)

**Interfaces:**
- Produces: `kimiChatModel` (a `LanguageModel`), `embeddingModel` (an `EmbeddingModel<string>`), both exported from `apps/api/src/ai/ai.config.ts` — every later task that calls the LLM or embeds text imports these two consts.

- [ ] **Step 1: Add dependencies**

```bash
npm install -w @app/api ai@7.0.93 @ai-sdk/openai-compatible@3.0.44 @ai-sdk/openai@4.0.60 @qdrant/js-client-rest@1.19.0
```

- [ ] **Step 2: Write the failing env-validation test**

Add to `apps/api/src/common/config/env.validation.spec.ts` (extend the existing `valid()` helper and add a new `describe` block — do not remove any existing test):

```ts
const valid = () => ({
	NODE_ENV: 'development',
	DATABASE_USER: 'aas',
	DATABASE_PASSWORD: 'pw',
	DATABASE_HOST: 'localhost',
	DATABASE_PORT: '5432',
	DATABASE_NAME: 'aas',
	JWT_SECRET: 'a'.repeat(32),
	MINIO_ENDPOINT: 'http://localhost:9000',
	MINIO_ACCESS_KEY: 'minioadmin',
	MINIO_SECRET_KEY: 'minioadmin',
	MINIO_BUCKET: 'aas-uploads',
	MINIO_PUBLIC_URL: 'http://localhost:9000/aas-uploads',
	KIMI_API_KEY: 'sk-test',
	OPENAI_API_KEY: 'sk-test',
	QDRANT_URL: 'https://example.qdrant.io',
	QDRANT_API_KEY: 'qdrant-test',
});

describe('validateEnv — AI chat', () => {
	it('accepts a complete env with AI vars', () => {
		const out = validateEnv(valid());
		expect(out.KIMI_API_KEY).toBe('sk-test');
		expect(out.QDRANT_COLLECTION).toBe('twinfoundry-kb');
	});

	it('rejects a missing KIMI_API_KEY', () => {
		const env = valid();
		delete (env as Record<string, unknown>).KIMI_API_KEY;
		expect(() => validateEnv(env)).toThrow(/KIMI_API_KEY/);
	});

	it('rejects a non-URL QDRANT_URL', () => {
		expect(() => validateEnv({ ...valid(), QDRANT_URL: 'not-a-url' })).toThrow(
			/QDRANT_URL/,
		);
	});
});
```

(This updates the existing `valid()` fixture used by every other test in the file — the other `describe` blocks keep passing since they only add or delete keys off the same base.)

- [ ] **Step 3: Run it to see it fail**

Run: `npm run test -w @app/api -- env.validation.spec.ts`
Expected: FAIL — `KIMI_API_KEY`/`QDRANT_URL`/`QDRANT_API_KEY` are unknown to `envSchema`, so `valid()` doesn't parse the way the new assertions expect (`out.QDRANT_COLLECTION` is `undefined`, not `'twinfoundry-kb'`).

- [ ] **Step 4: Add the four env vars to the schema**

In `apps/api/src/common/config/env.validation.ts`, inside `baseSchema` (anywhere after `COOKIE_SECURE`):

```ts
	KIMI_API_KEY: z.string().min(1),
	OPENAI_API_KEY: z.string().min(1),
	QDRANT_URL: z.string().url(),
	QDRANT_API_KEY: z.string().min(1),
	QDRANT_COLLECTION: z.string().min(1).default('twinfoundry-kb'),
```

- [ ] **Step 5: Run the test again to see it pass**

Run: `npm run test -w @app/api -- env.validation.spec.ts`
Expected: PASS, all tests in the file including the pre-existing ones.

- [ ] **Step 6: Wire the values into `configuration.ts`**

In `apps/api/src/common/config/configuration.ts`, add to the returned object:

```ts
	ai: {
		kimiApiKey: process.env.KIMI_API_KEY,
		openaiApiKey: process.env.OPENAI_API_KEY,
		qdrantUrl: process.env.QDRANT_URL,
		qdrantApiKey: process.env.QDRANT_API_KEY,
		qdrantCollection: process.env.QDRANT_COLLECTION || 'twinfoundry-kb',
	},
```

- [ ] **Step 7: Make `KIMI_API_KEY` and `OPENAI_API_KEY` file-secret-capable**

In `apps/api/src/common/config/file-secrets.ts`, add both names to the `FILE_BACKED` array:

```ts
const FILE_BACKED = [
	'DATABASE_PASSWORD',
	'JWT_SECRET',
	'BASE_PASSWORD',
	'EMAIL_PASS',
	'MINIO_SECRET_KEY',
	'GOOGLE_CLIENT_SECRET',
	'GITHUB_CLIENT_SECRET',
	'FACEBOOK_CLIENT_SECRET',
	'KIMI_API_KEY',
	'OPENAI_API_KEY',
] as const;
```

- [ ] **Step 8: Append example values to `apps/api/.env.example`**

```
KIMI_API_KEY=sk-your-moonshot-key
OPENAI_API_KEY=sk-your-openai-key
QDRANT_URL=https://your-cluster.cloud.qdrant.io
QDRANT_API_KEY=your-qdrant-key
QDRANT_COLLECTION=twinfoundry-kb
```

- [ ] **Step 9: Create the model consts**

Create `apps/api/src/ai/ai.config.ts`:

```ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { openai } from '@ai-sdk/openai';

/**
 * Kimi (Moonshot) is OpenAI-compatible, so it plugs into AI SDK Core through
 * this generic adapter rather than a dedicated `@ai-sdk/moonshot` package
 * (none exists). `maxRetries` covers transient 5xx/429s — no hand-rolled
 * backoff.
 */
const moonshot = createOpenAICompatible({
	name: 'moonshot',
	baseURL: 'https://api.moonshot.ai/v1',
	apiKey: process.env.KIMI_API_KEY!,
	maxRetries: 2,
});

export const kimiChatModel = moonshot.chatModel('kimi-k2.6');

/**
 * Embeddings run on OpenAI rather than Moonshot: `text-embedding-3-small` is
 * cheap, well-documented, and gives a known vector size (1536) for the Qdrant
 * collection. This is the only place OpenAI is used — chat stays on Kimi.
 */
export const embeddingModel = openai.embedding('text-embedding-3-small');

export const EMBEDDING_DIMENSIONS = 1536;
```

- [ ] **Step 10: Commit**

```bash
git add apps/api/package.json apps/api/package-lock.json apps/api/src/common/config/env.validation.ts apps/api/src/common/config/env.validation.spec.ts apps/api/src/common/config/configuration.ts apps/api/src/common/config/file-secrets.ts apps/api/src/ai/ai.config.ts apps/api/.env.example
git commit -m "feat(ai): add Kimi/OpenAI/Qdrant env config and model consts"
```

---

### Task 2: `chat_message` entity and migration

**Files:**
- Create: `apps/api/src/ai/entities/chat-message.entity.ts`
- Create: `apps/api/src/ai/entities/chat-message.entity.spec.ts`
- Create: `apps/api/src/database/migrations/<timestamp>-CreateChatMessage.ts` (via `npm run migration:generate`, filename stamped by TypeORM)

**Interfaces:**
- Produces: `ChatMessage` entity, `ChatMessageRole` enum (`'user' | 'assistant' | 'tool'`), `ToolCallState` enum (`'none' | 'pending' | 'confirmed' | 'rejected' | 'executed'`) — Task 7 (`ChatService`) is the primary consumer via `@InjectRepository(ChatMessage)`.

- [ ] **Step 1: Write the entity**

Create `apps/api/src/ai/entities/chat-message.entity.ts`:

```ts
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum ChatMessageRole {
	USER = 'user',
	ASSISTANT = 'assistant',
	TOOL = 'tool',
}

export enum ToolCallState {
	NONE = 'none',
	PENDING = 'pending',
	CONFIRMED = 'confirmed',
	REJECTED = 'rejected',
	EXECUTED = 'executed',
}

/** One turn of a chat thread. A `pending` write proposal lives entirely on
 *  this row — there is no separate confirmation table. */
@Entity()
export class ChatMessage extends BaseEntity {
	@Column('uuid')
	@Index()
	threadId!: string;

	@Column('uuid')
	@Index()
	userId!: string;

	@Column({ type: 'enum', enum: ChatMessageRole })
	role!: ChatMessageRole;

	@Column('text')
	content!: string;

	/** `{ name, args }` for the tool the model proposed calling. Set only
	 *  alongside `toolCallState !== 'none'`. */
	@Column({ type: 'jsonb', nullable: true })
	toolCall?: { name: string; args: Record<string, unknown> } | null;

	@Column({ type: 'enum', enum: ToolCallState, default: ToolCallState.NONE })
	toolCallState!: ToolCallState;
}
```

- [ ] **Step 2: Write the failing round-trip test**

Create `apps/api/src/ai/entities/chat-message.entity.spec.ts`:

```ts
import { ChatMessage, ChatMessageRole, ToolCallState } from './chat-message.entity';

describe('ChatMessage', () => {
	it('defaults toolCallState to none and leaves toolCall unset', () => {
		const message = new ChatMessage();
		message.threadId = 'thread-1';
		message.userId = 'user-1';
		message.role = ChatMessageRole.USER;
		message.content = 'hello';

		expect(message.toolCall).toBeUndefined();
		// toolCallState's default is applied by TypeORM/Postgres on insert, not
		// by the class field — assert the enum member exists with the right value
		// rather than asserting a runtime default this test never persists.
		expect(ToolCallState.NONE).toBe('none');
	});

	it('carries a pending tool call as { name, args }', () => {
		const message = new ChatMessage();
		message.toolCallState = ToolCallState.PENDING;
		message.toolCall = { name: 'createBadmintonSession', args: { courtCost: 100_000 } };

		expect(message.toolCallState).toBe(ToolCallState.PENDING);
		expect(message.toolCall.name).toBe('createBadmintonSession');
	});
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test -w @app/api -- chat-message.entity.spec.ts`
Expected: FAIL — `Cannot find module './chat-message.entity'` (file doesn't exist yet if you did Step 2 before Step 1; if Step 1 is already done, skip to Step 4 since this is a plain-class test with nothing to fail against once the file exists).

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -w @app/api -- chat-message.entity.spec.ts`
Expected: PASS.

- [ ] **Step 5: Generate and run the migration**

With the dev database up (`npm run docker:up` from repo root if not already running):

```bash
npm run migration:generate -w @app/api
npm run migration:run -w @app/api
```

Verify: the generated migration file under `apps/api/src/database/migrations/` creates a `chat_message` table with columns `id, threadId, userId, role, content, toolCall, toolCallState, createdAt, updatedAt`, and two indices on `threadId` and `userId`. If it also touches unrelated tables, stop and check `apps/api/src/ai/ai.module.ts` isn't registered anywhere yet (it shouldn't be until Task 8) — `autoLoadEntities` only picks up entities registered via `TypeOrmModule.forFeature`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ai/entities/chat-message.entity.ts apps/api/src/ai/entities/chat-message.entity.spec.ts apps/api/src/database/migrations/
git commit -m "feat(ai): add ChatMessage entity and migration"
```

---

### Task 3: `RagService` — embed + Qdrant search

**Files:**
- Create: `apps/api/src/ai/rag.service.ts`
- Create: `apps/api/src/ai/rag.service.spec.ts`
- Create: `apps/api/src/ai/qdrant.provider.ts`

**Interfaces:**
- Consumes: `embeddingModel`, `EMBEDDING_DIMENSIONS` from `./ai.config` (Task 1).
- Produces: `QDRANT_CLIENT` DI token + `qdrantClientProvider` (a `Provider`) from `qdrant.provider.ts`; `RagService.search(query: string, limit?: number): Promise<Array<{ text: string; heading: string; score: number }>>` — consumed by the `searchKnowledgeBase` tool in Task 5.

- [ ] **Step 1: Create the Qdrant client provider**

Create `apps/api/src/ai/qdrant.provider.ts`:

```ts
import { Provider } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';

export const QDRANT_CLIENT = Symbol('QDRANT_CLIENT');

export const qdrantClientProvider: Provider = {
	provide: QDRANT_CLIENT,
	useFactory: () =>
		new QdrantClient({
			url: process.env.QDRANT_URL!,
			apiKey: process.env.QDRANT_API_KEY,
		}),
};
```

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/ai/rag.service.spec.ts`:

```ts
import { RagService } from './rag.service';

jest.mock('ai', () => ({
	embed: jest.fn(),
}));
import { embed } from 'ai';

describe('RagService', () => {
	function mockQdrant() {
		return { query: jest.fn() };
	}

	it('embeds the query and returns scored chunks', async () => {
		const qdrant = mockQdrant();
		(embed as jest.Mock).mockResolvedValue({ embedding: [0.1, 0.2] });
		qdrant.query.mockResolvedValue({
			points: [
				{ score: 0.91, payload: { text: 'Court cost splits by hoursPlayed.', heading: '§5 Algorithm' } },
			],
		});

		const service = new RagService(qdrant as never);
		const results = await service.search('how is court cost split');

		expect(embed).toHaveBeenCalledWith(
			expect.objectContaining({ value: 'how is court cost split' }),
		);
		expect(qdrant.query).toHaveBeenCalledWith(
			'twinfoundry-kb',
			expect.objectContaining({ query: [0.1, 0.2], limit: 4, with_payload: true }),
		);
		expect(results).toEqual([
			{ text: 'Court cost splits by hoursPlayed.', heading: '§5 Algorithm', score: 0.91 },
		]);
	});

	it('returns an empty array instead of throwing when Qdrant is unreachable', async () => {
		const qdrant = mockQdrant();
		(embed as jest.Mock).mockResolvedValue({ embedding: [0.1] });
		qdrant.query.mockRejectedValue(new Error('ECONNREFUSED'));

		const service = new RagService(qdrant as never);
		await expect(service.search('anything')).resolves.toEqual([]);
	});
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test -w @app/api -- rag.service.spec.ts`
Expected: FAIL — `Cannot find module './rag.service'`.

- [ ] **Step 4: Implement `RagService`**

Create `apps/api/src/ai/rag.service.ts`:

```ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { embed } from 'ai';
import type { QdrantClient } from '@qdrant/js-client-rest';
import { embeddingModel } from './ai.config';
import { QDRANT_CLIENT } from './qdrant.provider';

const COLLECTION = process.env.QDRANT_COLLECTION || 'twinfoundry-kb';

@Injectable()
export class RagService {
	private readonly logger = new Logger(RagService.name);

	constructor(@Inject(QDRANT_CLIENT) private readonly qdrant: QdrantClient) {}

	/** Fails soft: a chat turn should answer without retrieved context rather
	 *  than break because Qdrant is briefly unreachable.
	 *
	 *  Uses `.query()`, not `.search()` — `@qdrant/js-client-rest@1.19.0` has no
	 *  `search` method (it was replaced client-wide by the universal `query`
	 *  endpoint). A raw vector passed as `query` runs a nearest-neighbor search,
	 *  and results come back under `response.points`, not as a flat array. */
	async search(
		query: string,
		limit = 4,
	): Promise<Array<{ text: string; heading: string; score: number }>> {
		try {
			const { embedding } = await embed({ model: embeddingModel, value: query });
			const response = await this.qdrant.query(COLLECTION, {
				query: embedding,
				limit,
				with_payload: true,
			});
			return response.points.map((point) => ({
				text: String((point.payload as Record<string, unknown>)?.text ?? ''),
				heading: String((point.payload as Record<string, unknown>)?.heading ?? ''),
				score: point.score,
			}));
		} catch (error) {
			this.logger.warn(`Knowledge-base search failed, answering without it: ${error}`);
			return [];
		}
	}
}
```

- [ ] **Step 5: Run the test again to verify it passes**

Run: `npm run test -w @app/api -- rag.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ai/rag.service.ts apps/api/src/ai/rag.service.spec.ts apps/api/src/ai/qdrant.provider.ts
git commit -m "feat(ai): add RagService (embed + Qdrant search)"
```

---

### Task 4: Knowledge-base ingestion script

**Files:**
- Create: `apps/api/src/ai/scripts/chunk-markdown.ts`
- Create: `apps/api/src/ai/scripts/chunk-markdown.spec.ts`
- Create: `apps/api/src/ai/scripts/ingest-knowledge-base.ts`

**Interfaces:**
- Produces: `chunkMarkdown(content: string): Array<{ heading: string; text: string }>` — a pure function, the only piece of this task with a real unit-test cycle. `ingest-knowledge-base.ts` is a one-off admin script (run manually, not imported by app code), so it gets an `assert`-based self-check instead of a Jest suite, per the plan's testing scope.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/ai/scripts/chunk-markdown.spec.ts`:

```ts
import { chunkMarkdown } from './chunk-markdown';

describe('chunkMarkdown', () => {
	it('splits on level-2 headings and keeps the heading text with its section', () => {
		const md = `# Title\n\nIntro paragraph.\n\n## First Section\nBody one.\n\n## Second Section\nBody two.\n`;
		const chunks = chunkMarkdown(md);

		expect(chunks).toEqual([
			{ heading: 'Title', text: 'Intro paragraph.' },
			{ heading: 'First Section', text: 'Body one.' },
			{ heading: 'Second Section', text: 'Body two.' },
		]);
	});

	it('drops empty sections', () => {
		const md = `# Title\n\n## Empty\n\n## Has content\nSomething.\n`;
		const chunks = chunkMarkdown(md);

		expect(chunks.map((c) => c.heading)).toEqual(['Has content']);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -w @app/api -- chunk-markdown.spec.ts`
Expected: FAIL — `Cannot find module './chunk-markdown'`.

- [ ] **Step 3: Implement `chunkMarkdown`**

Create `apps/api/src/ai/scripts/chunk-markdown.ts`:

```ts
/** Splits a Markdown doc on level-1/level-2 headings. Good enough for a
 *  hand-written spec doc; not a general Markdown parser. */
export function chunkMarkdown(content: string): Array<{ heading: string; text: string }> {
	const lines = content.split('\n');
	const chunks: Array<{ heading: string; text: string }> = [];
	let heading = '';
	let body: string[] = [];

	const flush = () => {
		const text = body.join('\n').trim();
		if (text) chunks.push({ heading, text });
		body = [];
	};

	for (const line of lines) {
		const match = /^#{1,2}\s+(.*)$/.exec(line);
		if (match) {
			flush();
			heading = match[1].trim();
		} else {
			body.push(line);
		}
	}
	flush();

	return chunks;
}
```

- [ ] **Step 4: Run the test again to verify it passes**

Run: `npm run test -w @app/api -- chunk-markdown.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the ingestion script with its self-check**

Create `apps/api/src/ai/scripts/ingest-knowledge-base.ts`:

```ts
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { embedMany } from 'ai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { embeddingModel, EMBEDDING_DIMENSIONS } from '../ai.config';
import { chunkMarkdown } from './chunk-markdown';

const COLLECTION = process.env.QDRANT_COLLECTION || 'twinfoundry-kb';

/**
 * One-off admin action, not a queued job: `docs/badminton-splitter-spec.md`
 * changes rarely, so re-running this by hand after an edit is enough. See
 * "Non-Goals" in the design spec for why this isn't a background worker.
 *
 * Run with: `npx ts-node -r tsconfig-paths/register src/ai/scripts/ingest-knowledge-base.ts`
 */
async function main() {
	const client = new QdrantClient({
		url: process.env.QDRANT_URL!,
		apiKey: process.env.QDRANT_API_KEY,
	});

	const collections = await client.getCollections();
	if (!collections.collections.some((c) => c.name === COLLECTION)) {
		await client.createCollection(COLLECTION, {
			vectors: { size: EMBEDDING_DIMENSIONS, distance: 'Cosine' },
		});
	}

	const specPath = join(__dirname, '../../../../../docs/badminton-splitter-spec.md');
	const chunks = chunkMarkdown(readFileSync(specPath, 'utf8'));
	if (chunks.length === 0) {
		throw new Error(`No chunks extracted from ${specPath} — check the file exists and has headings`);
	}

	const { embeddings } = await embedMany({
		model: embeddingModel,
		values: chunks.map((c) => `${c.heading}\n${c.text}`),
	});

	await client.upsert(COLLECTION, {
		wait: true,
		points: chunks.map((chunk, i) => ({
			id: randomUUID(),
			vector: embeddings[i],
			payload: { heading: chunk.heading, text: chunk.text },
		})),
	});

	console.log(`Ingested ${chunks.length} chunks into "${COLLECTION}"`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
```

- [ ] **Step 6: Run it against real Qdrant/OpenAI credentials once, manually**

Run: `npx ts-node -r tsconfig-paths/register apps/api/src/ai/scripts/ingest-knowledge-base.ts` (from `apps/api`, with `.env.development.local` populated)
Expected: prints `Ingested N chunks into "twinfoundry-kb"` with `N` matching the number of `##`/`#` sections in `docs/badminton-splitter-spec.md`. This is the task's self-check — there is no automated test for the network calls themselves.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/ai/scripts/chunk-markdown.ts apps/api/src/ai/scripts/chunk-markdown.spec.ts apps/api/src/ai/scripts/ingest-knowledge-base.ts
git commit -m "feat(ai): add knowledge-base chunking and ingestion script"
```

---

### Task 5: Read-only tool — `searchKnowledgeBase`

**Scope note:** the original plan also had a `searchBadmintonSessions` tool. Cut per ruling during execution — session listing/search is already covered elsewhere in the product; the chat agent doesn't need to duplicate it. This task now ships only the knowledge-base tool.

**Files:**
- Create: `apps/api/src/ai/tools/read-tools.ts`
- Create: `apps/api/src/ai/tools/read-tools.spec.ts`

**Interfaces:**
- Consumes: `RagService.search` (Task 3).
- Produces: `buildReadTools(deps: { ragService: RagService }): { searchKnowledgeBase: Tool }` — a factory, consumed by `ChatService` (Task 7) alongside `buildWriteTools` (Task 6).

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/ai/tools/read-tools.spec.ts`:

```ts
import { buildReadTools } from './read-tools';

describe('buildReadTools', () => {
	function deps() {
		return { ragService: { search: jest.fn() } as never };
	}

	it('searchKnowledgeBase delegates to RagService.search', async () => {
		const d = deps();
		(d.ragService.search as jest.Mock).mockResolvedValue([
			{ heading: '§5', text: 'Split by hours.', score: 0.9 },
		]);

		const tools = buildReadTools(d);
		const result = await tools.searchKnowledgeBase.execute!(
			{ query: 'how is cost split' },
			{ toolCallId: 't2', messages: [] },
		);

		expect(d.ragService.search).toHaveBeenCalledWith('how is cost split');
		expect(result).toEqual([{ heading: '§5', text: 'Split by hours.', score: 0.9 }]);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -w @app/api -- read-tools.spec.ts`
Expected: FAIL — `Cannot find module './read-tools'`.

- [ ] **Step 3: Implement the tool**

Create `apps/api/src/ai/tools/read-tools.ts`:

```ts
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
```

- [ ] **Step 4: Run the test again to verify it passes**

Run: `npm run test -w @app/api -- read-tools.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ai/tools/read-tools.ts apps/api/src/ai/tools/read-tools.spec.ts
git commit -m "feat(ai): add searchKnowledgeBase chat tool"
```

---

### Task 6: Mutating tools (draft-only) — `createBadmintonSession`, `setParticipantPaid`

**Files:**
- Create: `apps/api/src/ai/tools/write-tools.ts`
- Create: `apps/api/src/ai/tools/write-tools.spec.ts`

**Interfaces:**
- Produces: `buildWriteTools(): { createBadmintonSession: Tool; setParticipantPaid: Tool }`, plus the exported type `PendingAction = { requiresConfirmation: true; action: 'createBadmintonSession' | 'setParticipantPaid'; args: Record<string, unknown>; summary: string }` (the `requiresConfirmation: true` field is required, not optional — a literal that both `execute` functions return and that `strict: true` requires for the object literal to satisfy `Promise<PendingAction>`) — `ChatService` (Task 7) checks `onFinish` tool outputs against this shape to persist a pending row, and reads it back to execute the real write on confirm.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/ai/tools/write-tools.spec.ts`:

```ts
import { buildWriteTools } from './write-tools';

describe('buildWriteTools', () => {
	it('createBadmintonSession returns a draft, never writes', async () => {
		const tools = buildWriteTools();
		const args = {
			playedOn: '2026-09-10',
			courtCost: 200_000,
			shuttleUnitPrice: 12_000,
			totalShuttleCount: 10,
			participants: [{ name: 'An' }, { name: 'Binh' }],
		};

		// `as any`: ToolExecutionOptions requires a `context` field this test
		// doesn't need — same harmless cast Task 5's read-tools.spec.ts uses for
		// the identical reason (verified against @ai-sdk/provider-utils's types).
		const result = await tools.createBadmintonSession.execute!(args, {
			toolCallId: 't1',
			messages: [],
		} as any);

		expect(result).toEqual({
			requiresConfirmation: true,
			action: 'createBadmintonSession',
			args,
			summary: expect.stringContaining('2026-09-10'),
		});
	});

	it('setParticipantPaid returns a draft, never writes', async () => {
		const tools = buildWriteTools();
		const args = { sessionId: 's1', participantId: 'p1', paid: true };

		const result = await tools.setParticipantPaid.execute!(args, {
			toolCallId: 't2',
			messages: [],
		} as any);

		expect(result).toEqual({
			requiresConfirmation: true,
			action: 'setParticipantPaid',
			args,
			summary: expect.stringContaining('paid'),
		});
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -w @app/api -- write-tools.spec.ts`
Expected: FAIL — `Cannot find module './write-tools'`.

- [ ] **Step 3: Implement the tools**

Create `apps/api/src/ai/tools/write-tools.ts`:

```ts
import { tool } from 'ai';
import { z } from 'zod';

export interface PendingAction {
	action: 'createBadmintonSession' | 'setParticipantPaid';
	args: Record<string, unknown>;
	summary: string;
}

const createBadmintonSessionInput = z.object({
	playedOn: z.string().describe('YYYY-MM-DD'),
	title: z.string().max(120).optional(),
	courtCost: z.number().int().min(0),
	shuttleUnitPrice: z.number().int().min(0),
	totalShuttleCount: z.number().int().min(0),
	participants: z
		.array(
			z.object({
				name: z.string().max(120),
				hoursPlayed: z.number().min(0).optional(),
				shuttleWeight: z.number().min(0).max(10).optional(),
			}),
		)
		.min(1),
});

const setParticipantPaidInput = z.object({
	sessionId: z.string().uuid(),
	participantId: z.string().uuid(),
	paid: z.boolean(),
});

/** Every tool here only drafts an action — `ChatService.onFinish` persists the
 *  draft as `pending`, and only `POST /ai/chat/confirm` may execute it. */
export function buildWriteTools() {
	return {
		createBadmintonSession: tool({
			description:
				'Propose creating a new badminton session. This does NOT save anything — tell the user what you are about to create and that they must confirm.',
			inputSchema: createBadmintonSessionInput,
			execute: async (args): Promise<PendingAction> => ({
				requiresConfirmation: true,
				action: 'createBadmintonSession',
				args,
				summary: `Create a session on ${args.playedOn} with ${args.participants.length} participant(s), court cost ${args.courtCost}₫`,
			}),
		}),

		setParticipantPaid: tool({
			description:
				'Propose marking a participant as paid or unpaid. This does NOT save anything — the user must confirm.',
			inputSchema: setParticipantPaidInput,
			execute: async (args): Promise<PendingAction> => ({
				requiresConfirmation: true,
				action: 'setParticipantPaid',
				args,
				summary: `Mark the participant as ${args.paid ? 'paid' : 'unpaid'}`,
			}),
		}),
	};
}
```

- [ ] **Step 4: Run the test again to verify it passes**

Run: `npm run test -w @app/api -- write-tools.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ai/tools/write-tools.ts apps/api/src/ai/tools/write-tools.spec.ts
git commit -m "feat(ai): add draft-only mutating chat tools"
```

---

### Task 7: `ChatService` — orchestration, persistence, confirm

**Files:**
- Create: `apps/api/src/ai/chat.service.ts`
- Create: `apps/api/src/ai/chat.service.spec.ts`
- Create: `apps/api/src/ai/dto/chat.dto.ts`

**Interfaces:**
- Consumes: `kimiChatModel` (Task 1), `buildReadTools(deps: { ragService })`/`buildWriteTools()` (Tasks 5-6), `PendingAction` type (Task 6), `ChatMessage`/`ChatMessageRole`/`ToolCallState` (Task 2), `BadmintonService.createSession`/`setParticipantPaid` (existing, used only inside `confirmAction` — no longer via a read tool).
- Consumes also: `DataSource` (typeorm, injected — `confirmAction` runs inside `dataSource.transaction(...)` with a pessimistic-locked read, mirroring `BadmintonService.updateSession`'s existing pattern in this same repo).
- Produces: `ChatService.handleMessage(userId: string, dto: SendChatMessageDto, res: Response): Promise<void>`, `ChatService.getPendingAction(userId: string, threadId: string): Promise<{ pending: boolean; summary?: string }>`, `ChatService.confirmAction(userId: string, dto: ConfirmChatActionDto): Promise<{ message: string; toolCallState: ToolCallState }>` — consumed by `AiController` (Task 8).

- [ ] **Step 1: Write the DTOs**

Create `apps/api/src/ai/dto/chat.dto.ts`:

```ts
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendChatMessageDto {
	@IsString()
	@MaxLength(2000)
	message!: string;

	@IsOptional()
	@IsUUID()
	threadId?: string;
}

export class ConfirmChatActionDto {
	@IsUUID()
	threadId!: string;

	@IsBoolean()
	approve!: boolean;
}
```

- [ ] **Step 2: Write the failing tests for `confirmAction` and `getPendingAction`**

(`handleMessage` streams over HTTP and is covered by the Task 9 e2e test instead — see Global Constraints on avoiding a duplicate integration layer. This unit suite covers the two plain-JSON methods, which is real, mockable, synchronous behavior.)

Create `apps/api/src/ai/chat.service.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatMessageRole, ToolCallState } from './entities/chat-message.entity';

function mockRepo() {
	return { findOne: jest.fn(), save: jest.fn(async (x: unknown) => x), create: jest.fn((x: unknown) => x) };
}

/** Mirrors `apps/api/src/badminton/badminton.service.spec.ts`'s `mockDataSource()` —
 *  `transaction()` runs the callback against a shared manager, which is the seam
 *  `confirmAction`'s pessimistic-locked read goes through. */
function mockDataSource() {
	const manager = {
		findOne: jest.fn(),
		save: jest.fn(async (x: unknown) => x),
		create: jest.fn((_entity: unknown, x: unknown) => x),
	};
	const dataSource = {
		transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
	};
	return { manager, dataSource };
}

describe('ChatService', () => {
	let chatMessageRepo: ReturnType<typeof mockRepo>;
	let badmintonService: { createSession: jest.Mock; setParticipantPaid: jest.Mock };
	let ragService: { search: jest.Mock };
	let manager: ReturnType<typeof mockDataSource>['manager'];
	let dataSource: ReturnType<typeof mockDataSource>['dataSource'];
	let service: ChatService;

	beforeEach(() => {
		chatMessageRepo = mockRepo();
		badmintonService = { createSession: jest.fn(), setParticipantPaid: jest.fn() };
		ragService = { search: jest.fn() };
		({ manager, dataSource } = mockDataSource());
		service = new ChatService(
			chatMessageRepo as never,
			badmintonService as never,
			ragService as never,
			dataSource as never,
		);
	});

	describe('getPendingAction', () => {
		it('reports nothing pending when the last message is not pending', async () => {
			chatMessageRepo.findOne.mockResolvedValue(null);
			await expect(service.getPendingAction('user-1', 'thread-1')).resolves.toEqual({
				pending: false,
			});
		});

		it('reports the summary of a pending row', async () => {
			chatMessageRepo.findOne.mockResolvedValue({
				toolCallState: ToolCallState.PENDING,
				content: 'Create a session on 2026-09-10 with 2 participants',
				createdAt: new Date(),
			});
			await expect(service.getPendingAction('user-1', 'thread-1')).resolves.toEqual({
				pending: true,
				summary: 'Create a session on 2026-09-10 with 2 participants',
			});
		});

		it('reports nothing pending once the row is past its 15-minute window', async () => {
			chatMessageRepo.findOne.mockResolvedValue({
				toolCallState: ToolCallState.PENDING,
				content: 'stale',
				createdAt: new Date(Date.now() - 16 * 60 * 1000),
			});
			await expect(service.getPendingAction('user-1', 'thread-1')).resolves.toEqual({
				pending: false,
			});
		});
	});

	describe('confirmAction', () => {
		it('rejects when there is no pending row', async () => {
			manager.findOne.mockResolvedValue(null);
			await expect(
				service.confirmAction('user-1', { threadId: 'thread-1', approve: true }),
			).rejects.toThrow(NotFoundException);
		});

		it('rejects and flips state to rejected when the pending row is past its 15-minute window', async () => {
			manager.findOne.mockResolvedValue({
				id: 'msg-1',
				toolCallState: ToolCallState.PENDING,
				toolCall: { name: 'createBadmintonSession', args: {} },
				createdAt: new Date(Date.now() - 16 * 60 * 1000),
			});

			await expect(
				service.confirmAction('user-1', { threadId: 'thread-1', approve: true }),
			).rejects.toThrow(NotFoundException);
			expect(badmintonService.createSession).not.toHaveBeenCalled();
			expect(manager.save).toHaveBeenCalledWith(
				expect.objectContaining({ toolCallState: ToolCallState.REJECTED }),
			);
		});

		it('executes createBadmintonSession, flips state to executed, and appends a tool message', async () => {
			manager.findOne.mockResolvedValue({
				id: 'msg-1',
				threadId: 'thread-1',
				toolCallState: ToolCallState.PENDING,
				toolCall: { name: 'createBadmintonSession', args: { playedOn: '2026-09-10', participants: [] } },
				createdAt: new Date(),
			});
			badmintonService.createSession.mockResolvedValue({ id: 'session-1' });

			const result = await service.confirmAction('user-1', { threadId: 'thread-1', approve: true });

			// Pessimistic lock is the double-confirm-race guard — a mock can't prove
			// the lock actually serializes concurrent transactions, but it can prove
			// the code asks for one.
			expect(manager.findOne).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
			);
			expect(badmintonService.createSession).toHaveBeenCalledWith(
				'user-1',
				{ playedOn: '2026-09-10', participants: [] },
			);
			// Two saves: the pending row flipped to executed, and the new tool-role
			// audit message.
			expect(manager.save).toHaveBeenCalledWith(
				expect.objectContaining({ toolCallState: ToolCallState.EXECUTED }),
			);
			expect(manager.save).toHaveBeenCalledWith(
				expect.objectContaining({ role: ChatMessageRole.TOOL, content: expect.stringContaining('session-1') }),
			);
			expect(result.message).toContain('session-1');
			expect(result.toolCallState).toBe(ToolCallState.EXECUTED);
		});

		it('flips state to rejected without calling the domain service when approve is false', async () => {
			manager.findOne.mockResolvedValue({
				id: 'msg-1',
				toolCallState: ToolCallState.PENDING,
				toolCall: { name: 'setParticipantPaid', args: { sessionId: 's1', participantId: 'p1', paid: true } },
				createdAt: new Date(),
			});

			const result = await service.confirmAction('user-1', { threadId: 'thread-1', approve: false });

			expect(badmintonService.setParticipantPaid).not.toHaveBeenCalled();
			expect(manager.save).toHaveBeenCalledWith(
				expect.objectContaining({ toolCallState: ToolCallState.REJECTED }),
			);
			expect(result.message).toMatch(/cancel/i);
		});
	});
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test -w @app/api -- chat.service.spec.ts`
Expected: FAIL — `Cannot find module './chat.service'`.

- [ ] **Step 4: Implement `ChatService`**

Create `apps/api/src/ai/chat.service.ts`:

```ts
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { streamText, isStepCount, type ModelMessage } from 'ai';
import type { Response } from 'express';
import { BadmintonService } from '../badminton/badminton.service';
import { RagService } from './rag.service';
import { kimiChatModel } from './ai.config';
import { buildReadTools } from './tools/read-tools';
import { buildWriteTools } from './tools/write-tools';
import type { PendingAction } from './tools/write-tools';
import { ChatMessage, ChatMessageRole, ToolCallState } from './entities/chat-message.entity';
import { SendChatMessageDto, ConfirmChatActionDto } from './dto/chat.dto';

const PENDING_TTL_MS = 15 * 60 * 1000;

const SYSTEM_PROMPT = `You are TwinFoundry's badminton assistant. You can propose
creating a session or marking a participant paid, and answer questions about how
the cost split works using the knowledge base. You can never save a change
yourself — when a tool result has requiresConfirmation: true, tell the user
what you are about to do and that they need to confirm.`;

@Injectable()
export class ChatService {
	constructor(
		@InjectRepository(ChatMessage) private readonly chatMessageRepo: Repository<ChatMessage>,
		private readonly badmintonService: BadmintonService,
		private readonly ragService: RagService,
		private readonly dataSource: DataSource,
	) {}

	async handleMessage(userId: string, dto: SendChatMessageDto, res: Response): Promise<void> {
		const threadId = dto.threadId ?? crypto.randomUUID();

		// Stop paying for tokens the client will never read.
		const abortController = new AbortController();
		res.on('close', () => abortController.abort());

		const history = dto.threadId
			? await this.chatMessageRepo.find({
					where: { threadId, userId },
					order: { createdAt: 'ASC' },
				})
			: [];

		await this.chatMessageRepo.save(
			this.chatMessageRepo.create({
				threadId,
				userId,
				role: ChatMessageRole.USER,
				content: dto.message,
			}),
		);

		const tools = {
			...buildReadTools({ ragService: this.ragService }),
			...buildWriteTools(),
		};

		const result = streamText({
			model: kimiChatModel,
			system: SYSTEM_PROMPT,
			messages: [
				// TOOL-role rows are a local audit trail appended by confirmAction
				// below — never replayed to the model. AI SDK's `ModelMessage` requires
				// a `tool` role's content to be structured `ToolResultPart`s, never a
				// plain string, so a TOOL row would fail `streamText`'s own runtime
				// validation if it reached here. Filtering keeps the cast honest.
				...history
					.filter((m) => m.role !== ChatMessageRole.TOOL)
					.map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
				{ role: 'user' as const, content: dto.message },
			],
			tools,
			stopWhen: isStepCount(5),
			abortSignal: abortController.signal,
			onFinish: async ({ text, toolResults }) => {
				const pending = toolResults
					.map((r) => r.output as PendingAction | undefined)
					.find((output) => output?.requiresConfirmation);

				await this.chatMessageRepo.save(
					this.chatMessageRepo.create({
						threadId,
						userId,
						role: ChatMessageRole.ASSISTANT,
						// The draft's deterministic, args-derived summary (built in
						// write-tools.ts) is what the user actually approves — the
						// model's free-form narration (`text`) can disagree with
						// `toolCall.args`, and is often empty on a tool-only turn.
						content: pending ? pending.summary : text,
						toolCall: pending ? { name: pending.action, args: pending.args } : null,
						toolCallState: pending ? ToolCallState.PENDING : ToolCallState.NONE,
					}),
				);
			},
		});

		result.pipeUIMessageStreamToResponse(res);
	}

	async getPendingAction(
		userId: string,
		threadId: string,
	): Promise<{ pending: boolean; summary?: string }> {
		const last = await this.chatMessageRepo.findOne({
			where: { threadId, userId, toolCallState: ToolCallState.PENDING },
			order: { createdAt: 'DESC' },
		});
		if (!last) return { pending: false };

		const age = Date.now() - new Date(last.createdAt).getTime();
		if (age > PENDING_TTL_MS) return { pending: false };

		return { pending: true, summary: last.content };
	}

	async confirmAction(
		userId: string,
		dto: ConfirmChatActionDto,
	): Promise<{ message: string; toolCallState: ToolCallState }> {
		// Everything below runs against one locked row, in one transaction:
		// - `pessimistic_write` makes a double-click-fast double-confirm safe —
		//   the second transaction's `findOne` blocks until the first commits,
		//   then finds the row no longer `pending`.
		// - Same pattern `BadmintonService.updateSession` already uses for its
		//   own read-modify-write (apps/api/src/badminton/badminton.service.ts).
		// This does NOT make the domain write (`badmintonService.createSession`/
		// `setParticipantPaid`) atomic with the state flip — those run on their
		// own injected repositories, a separate connection from this
		// transaction's manager. A crash between the domain write succeeding and
		// this transaction committing leaves the row `pending` and retryable,
		// which duplicates the write on retry. Accepted for this feature's scale;
		// closing it fully would mean making BadmintonService participate in the
		// same manager, which is out of scope here.
		return this.dataSource.transaction(async (manager) => {
			const pending = await manager.findOne(ChatMessage, {
				where: { threadId: dto.threadId, userId, toolCallState: ToolCallState.PENDING },
				order: { createdAt: 'DESC' },
				lock: { mode: 'pessimistic_write' },
			});
			if (!pending || !pending.toolCall) {
				throw new NotFoundException('No pending action for this thread');
			}

			const age = Date.now() - new Date(pending.createdAt).getTime();
			if (age > PENDING_TTL_MS) {
				pending.toolCallState = ToolCallState.REJECTED;
				await manager.save(pending);
				throw new NotFoundException(
					'This action has expired — ask again to get a fresh confirmation.',
				);
			}

			if (!dto.approve) {
				pending.toolCallState = ToolCallState.REJECTED;
				await manager.save(pending);
				return { message: 'Cancelled — nothing was saved.', toolCallState: pending.toolCallState };
			}

			const { name, args } = pending.toolCall;
			let message: string;

			if (name === 'createBadmintonSession') {
				const session = await this.badmintonService.createSession(userId, args as never);
				message = `Created session ${session.id}.`;
			} else if (name === 'setParticipantPaid') {
				const { sessionId, participantId, paid } = args as {
					sessionId: string;
					participantId: string;
					paid: boolean;
				};
				await this.badmintonService.setParticipantPaid(userId, sessionId, participantId, paid);
				message = `Marked participant as ${paid ? 'paid' : 'unpaid'}.`;
			} else {
				// The tool name came back out of a jsonb column — untrusted at read
				// time even though only two names are producible today. A server-side
				// data-integrity fault, not a missing resource: 500, not 404, and the
				// row is deliberately left `pending` rather than silently discarded.
				throw new InternalServerErrorException(`Unknown pending tool call: ${name}`);
			}

			pending.toolCallState = ToolCallState.EXECUTED;
			await manager.save(pending);
			// Audit trail only — never replayed into the model (see the TOOL-role
			// filter in handleMessage above), so plain text is fine here instead of
			// the AI SDK's structured ToolResultPart shape.
			await manager.save(
				manager.create(ChatMessage, {
					threadId: dto.threadId,
					userId,
					role: ChatMessageRole.TOOL,
					content: message,
				}),
			);

			// Two keys, deliberately: `TransformInterceptor` (apps/api/src/common/
			// interceptor/transform.interceptor.ts) promotes a *single*-key
			// `{ message }` return straight onto the envelope and nulls `data` —
			// exactly what NOT to return here, since the web client reads `data`.
			return { message, toolCallState: ToolCallState.EXECUTED };
		});
	}
}
```

- [ ] **Step 5: Run the test again to verify it passes**

Run: `npm run test -w @app/api -- chat.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ai/chat.service.ts apps/api/src/ai/chat.service.spec.ts apps/api/src/ai/dto/chat.dto.ts
git commit -m "feat(ai): add ChatService (streamText orchestration + confirm flow)"
```

---

### Task 8: `AiController` + `AiModule` wiring

**Files:**
- Create: `apps/api/src/ai/ai.controller.ts`
- Create: `apps/api/src/ai/ai.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `ChatService` (Task 7), `requireUser` (`../common/request-user`), `SendChatMessageDto`/`ConfirmChatActionDto` (Task 7).
- Produces: routes `POST /ai/chat`, `GET /ai/chat/:threadId/pending-action`, `POST /ai/chat/confirm` — consumed by `apps/web` (Task 10) and the Task 9 e2e test.

No new unit test in this task — wiring has no branching logic of its own to assert on beyond "the route exists and calls the service", which the Task 9 e2e test covers against the real `AppModule`.

- [ ] **Step 1: Write the controller**

Create `apps/api/src/ai/ai.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { requireUser } from '../common/request-user';
import { ChatService } from './chat.service';
import { ConfirmChatActionDto, SendChatMessageDto } from './dto/chat.dto';

@Controller('ai/chat')
@ApiTags('AI Chat')
@ApiBearerAuth()
export class AiController {
	constructor(private readonly chatService: ChatService) {}

	@Post()
	async chat(@Req() req: Request, @Res() res: Response, @Body() dto: SendChatMessageDto) {
		await this.chatService.handleMessage(requireUser(req).id, dto, res);
	}

	@Get(':threadId/pending-action')
	getPendingAction(@Req() req: Request, @Param('threadId') threadId: string) {
		return this.chatService.getPendingAction(requireUser(req).id, threadId);
	}

	@Post('confirm')
	confirm(@Req() req: Request, @Body() dto: ConfirmChatActionDto) {
		return this.chatService.confirmAction(requireUser(req).id, dto);
	}
}
```

- [ ] **Step 2: Write the module**

Create `apps/api/src/ai/ai.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BadmintonModule } from '../badminton/badminton.module';
import { ChatMessage } from './entities/chat-message.entity';
import { AiController } from './ai.controller';
import { ChatService } from './chat.service';
import { RagService } from './rag.service';
import { qdrantClientProvider } from './qdrant.provider';

@Module({
	imports: [TypeOrmModule.forFeature([ChatMessage]), BadmintonModule],
	controllers: [AiController],
	providers: [ChatService, RagService, qdrantClientProvider],
})
export class AiModule {}
```

`apps/api/src/badminton/badminton.module.ts` doesn't currently export anything (`providers`/`controllers` only) — add `exports: [BadmintonService]` to its `@Module()` decorator so `AiModule` can inject it:

```ts
@Module({
	imports: [
		TypeOrmModule.forFeature([
			BadmintonSession,
			BadmintonParticipant,
			User,
			PaymentMethod,
		]),
	],
	providers: [BadmintonService],
	controllers: [BadmintonController],
	exports: [BadmintonService],
})
export class BadmintonModule {}
```

- [ ] **Step 3: Register `AiModule` in `AppModule`**

In `apps/api/src/app.module.ts`, add the import and list it alongside the other feature modules:

```ts
import { AiModule } from './ai/ai.module';
```

```ts
	imports: [
		UsersModule,
		AuthModule,
		AiModule,
		// ...
```

- [ ] **Step 4: Boot the app and smoke-check the route exists**

Run: `npm run dev -w @app/api`
Then: `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/ai/chat/does-not-exist/pending-action`
Expected: `401` (unauthenticated — `JwtAuthGuard` is global and this route isn't `@Public()`), not `404`. A `404` would mean the module/route didn't register.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ai/ai.controller.ts apps/api/src/ai/ai.module.ts apps/api/src/app.module.ts apps/api/src/badminton/badminton.module.ts
git commit -m "feat(ai): wire AiController/AiModule into the app"
```

---

### Task 9: End-to-end test — chat, pending action, confirm

**Files:**
- Create: `apps/api/test/ai-chat.e2e-spec.ts`

**Interfaces:**
- Consumes: `AppModule`, a fixture replacing `kimiChatModel`'s underlying HTTP calls.

This is the plan's one integration-level test, per the Global Constraints note against a duplicate service-level layer — it exercises the full HTTP surface: send a message that triggers a mutating tool, confirm it, and verify the badminton session actually gets created.

- [ ] **Step 1: Write the e2e test**

Create `apps/api/test/ai-chat.e2e-spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { BadmintonService } from '../src/badminton/badminton.service';

/**
 * `streamText` is mocked at the module level rather than hitting Kimi for
 * real — this test is about the HTTP surface and the HITL gate, not model
 * quality (the design spec's "manual golden path" step covers that).
 */
jest.mock('ai', () => {
	const actual = jest.requireActual('ai');
	return {
		...actual,
		streamText: jest.fn(() => ({
			pipeUIMessageStreamToResponse: (res: import('express').Response) => {
				res.status(200).end();
			},
		})),
	};
});
import { streamText } from 'ai';

/**
 * `ApiResponse<T>` envelope every non-`@Res()` route gets wrapped in by
 * `TransformInterceptor` (apps/api/src/common/interceptor/transform.
 * interceptor.ts) — supertest sees this raw shape, unlike the web app's axios
 * client, which unwraps `.data.data` itself.
 */
interface Envelope<T> {
	success: boolean;
	statusCode: number;
	message: string;
	data: T;
}

describe('AI chat (e2e)', () => {
	let app: INestApplication<App>;
	let badmintonService: { createSession: jest.Mock };
	let accessToken: string;

	beforeEach(async () => {
		badmintonService = { createSession: jest.fn().mockResolvedValue({ id: 'session-1' }) };

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(BadmintonService)
			.useValue(badmintonService)
			.compile();

		app = moduleFixture.createNestApplication();
		await app.init();

		// Requires DEV_AUTH_BYPASS=true in the test env (apps/api/.env.test.local
		// or however `npm run test:e2e` loads env for this repo) — env.validation.ts
		// refuses it in production but allows it everywhere else.
		const login = await request(app.getHttpServer())
			.post('/auth/dev/login')
			.send({ email: 'ai-chat-e2e@example.com' })
			.expect(201);
		accessToken = (login.body as Envelope<{ accessToken: string }>).data.accessToken;
	});

	afterEach(async () => {
		await app.close();
	});

	it('rejects an unauthenticated chat request', async () => {
		await request(app.getHttpServer()).post('/ai/chat').send({ message: 'hi' }).expect(401);
	});

	it('persists a pending write and executes it on confirm', async () => {
		const authHeader = { Authorization: `Bearer ${accessToken}` };

		// onFinish is one of streamText's options — invoke it directly, the same
		// way the AI SDK would once the mocked stream "finishes".
		(streamText as jest.Mock).mockImplementationOnce((options) => {
			options.onFinish({
				text: 'I can create that session for you — confirm?',
				toolResults: [
					{
						toolCallId: 't1',
						toolName: 'createBadmintonSession',
						output: {
							requiresConfirmation: true,
							action: 'createBadmintonSession',
							args: { playedOn: '2026-09-10', courtCost: 100000, shuttleUnitPrice: 12000, totalShuttleCount: 10, participants: [{ name: 'An' }] },
							summary: 'Create a session on 2026-09-10',
						},
					},
				],
			});
			return { pipeUIMessageStreamToResponse: (res: import('express').Response) => res.status(200).end() };
		});

		await request(app.getHttpServer())
			.post('/ai/chat')
			.set(authHeader)
			.send({ message: 'Create a session for Sept 10' })
			.expect(200);

		// threadId isn't in the streamed response body in this design (the
		// client generates it up front — see Task 10); the test reads it back
		// off the row `onFinish` just persisted instead of parsing the stream.
		const dataSource = app.get<DataSource>(getDataSourceToken());
		const [{ threadId }] = await dataSource.query(
			'SELECT "threadId" FROM chat_message ORDER BY "createdAt" DESC LIMIT 1',
		);

		const pendingRes = await request(app.getHttpServer())
			.get(`/ai/chat/${threadId}/pending-action`)
			.set(authHeader)
			.expect(200);
		const pending = (pendingRes.body as Envelope<{ pending: boolean; summary?: string }>).data;
		expect(pending.pending).toBe(true);

		const confirmRes = await request(app.getHttpServer())
			.post('/ai/chat/confirm')
			.set(authHeader)
			.send({ threadId, approve: true })
			.expect(201);
		const confirmed = (confirmRes.body as Envelope<{ message: string; toolCallState: string }>).data;

		expect(confirmed.message).toContain('session-1');
		expect(confirmed.toolCallState).toBe('executed');
		expect(badmintonService.createSession).toHaveBeenCalledTimes(1);
	});
});
```

- [ ] **Step 2: Run it to verify it fails, then passes**

Run: `npm run test:e2e -w @app/api -- ai-chat.e2e-spec.ts`
Expected: first run fails on whichever of the two adjustments above is needed (auth token, or `DataSource` token) — fix inline, then re-run until both tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/ai-chat.e2e-spec.ts
git commit -m "test(ai): add e2e coverage for chat, pending-action, and confirm"
```

---

### Task 10: Web — chat page

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/services/url.ts`
- Create: `apps/web/src/services/ai/api.ts`
- Create: `apps/web/src/pages/chat/index.tsx`
- Create: `apps/web/src/routes/_authenticated/chat.tsx`
- Create (via shadcn CLI, not hand-written): `apps/web/src/components/ui/message.tsx`, `apps/web/src/components/ui/message-scroller.tsx`, `apps/web/src/components/ui/bubble.tsx`

**Interfaces:**
- Consumes: `AppConstants.apiBaseUrl` (`@/lib/utils/constants`), `getAccessToken` (`@/lib/utils/access-token`), `http` (`@/lib/utils/http`), the three `/ai/chat*` routes from Task 8, the shadcn `Message`/`MessageScroller`/`Bubble`/`Alert`/`Input`/`Button` components (`Alert`, `Input`, `Button` already installed in this project; `Message`/`MessageScroller`/`Bubble` are not — installed in Step 1a below).
- Produces: the `/chat` page, no exports consumed elsewhere.

- [ ] **Step 1: Add the web dependency**

```bash
npm install -w @app/web @ai-sdk/react@4.0.96 ai@7.0.93
```

- [ ] **Step 1a: Install the shadcn chat components**

This project's shadcn config is `style: radix-luma`, `base: radix`, `iconLibrary: phosphor` (confirmed via `npx shadcn@latest info --json` — the message/bubble/message-scroller components carry no icons themselves, so `iconLibrary` doesn't affect this install). Run from `apps/web`:

```bash
npx shadcn@latest add message-scroller message bubble
```

This adds `src/components/ui/message-scroller.tsx`, `src/components/ui/message.tsx`, `src/components/ui/bubble.tsx`. `alert`, `input`, and `button` are already installed in this project (confirmed via `npx shadcn@latest info --json`'s `components` list) — do not re-add them. After the install, read the three new files once per the shadcn skill's own workflow (`.agents/skills/shadcn/SKILL.md`, step 7: "always read the added files and verify they are correct") — confirm they don't reference `lucide-react` anywhere (this project's `iconLibrary` is `phosphor`); if they do, swap to `@phosphor-icons/react` equivalents.

- [ ] **Step 2: Add the URL constants**

In `apps/web/src/services/url.ts`, add:

```ts
export const AI = {
  chat: "/ai/chat",
  pendingAction: (threadId: string) => `/ai/chat/${threadId}/pending-action`,
  confirm: "/ai/chat/confirm",
}
```

- [ ] **Step 3: Add the non-streaming API calls**

Create `apps/web/src/services/ai/api.ts`:

```ts
import { z } from "zod"
import { AI } from "../url"
import { parseResponse } from "@/lib/utils/parse-response"
import { http } from "@/lib/utils/http"

const PendingActionSchema = z.object({
  pending: z.boolean(),
  summary: z.string().optional(),
})

const ConfirmResultSchema = z.object({
  message: z.string(),
  toolCallState: z.string(),
})

export const aiChatApi = {
  getPendingAction: (threadId: string) =>
    parseResponse(
      "ai.getPendingAction",
      PendingActionSchema,
      http.get(AI.pendingAction(threadId))
    ),
  confirm: (threadId: string, approve: boolean) =>
    parseResponse(
      "ai.confirm",
      ConfirmResultSchema,
      http.post(AI.confirm, { threadId, approve })
    ),
}
```

- [ ] **Step 4: Build the chat page**

Create `apps/web/src/pages/chat/index.tsx`:

```tsx
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useRef, useState } from "react"
import { AppConstants } from "@/lib/utils/constants"
import { getAccessToken } from "@/lib/utils/access-token"
import { aiChatApi } from "@/services/ai/api"
import { AI } from "@/services/url"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"

export default function ChatPage() {
  const [input, setInput] = useState("")
  // A ref, not state: `prepareSendMessagesRequest` below reads this inside the
  // transport's fetch, which can fire before React has committed a `setState`
  // from the same event handler — a ref is readable synchronously, a state
  // variable closed over at render time isn't guaranteed to be current yet.
  const threadIdRef = useRef<string | null>(null)
  const [pending, setPending] = useState<{ pending: boolean; summary?: string }>({
    pending: false,
  })

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${AppConstants.apiBaseUrl}${AI.chat}`,
      credentials: "include",
      // `DefaultChatTransport` issues its own `fetch` — it never goes through
      // the axios `http` client, so the app's usual Authorization-header
      // interceptor (apps/web/src/lib/utils/http.ts) never runs. Attach the
      // same bearer token by hand, or every request 401s before it reaches
      // the controller.
      headers: () => {
        // Not `return token ? {...} : {}` — TypeScript infers
        // `{ Authorization: string } | { Authorization?: undefined }` for that
        // ternary, and the `undefined` branch fails the
        // `Resolvable<Record<string, string> | Headers>` index-signature
        // check. Build the object imperatively instead.
        const token = getAccessToken()
        const headers: Record<string, string> = {}
        if (token) headers.Authorization = `Bearer ${token}`
        return headers
      },
      // The AI SDK's default request body is `{ id, messages, trigger,
      // messageId }` (the UI-message-stream protocol) — the backend's
      // `SendChatMessageDto` expects `{ message, threadId? }` instead, and
      // the global `ValidationPipe({ whitelist: true, forbidNonWhitelisted:
      // true })` rejects anything else. Reshape the request to match.
      prepareSendMessagesRequest: ({ messages }) => {
        const last = messages[messages.length - 1]
        const text =
          last?.parts.find((part) => part.type === "text")?.text ?? ""
        return {
          body: {
            message: text,
            ...(threadIdRef.current ? { threadId: threadIdRef.current } : {}),
          },
        }
      },
    }),
    onFinish: async () => {
      if (!threadIdRef.current) return
      const result = await aiChatApi.getPendingAction(threadIdRef.current)
      setPending(result)
    },
  })

  const handleSend = () => {
    if (!input.trim()) return
    if (!threadIdRef.current) threadIdRef.current = crypto.randomUUID()
    sendMessage({ text: input })
    setInput("")
  }

  const handleConfirm = async (approve: boolean) => {
    if (!threadIdRef.current) return
    await aiChatApi.confirm(threadIdRef.current, approve)
    setPending({ pending: false })
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent>
              {messages.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === "user"}
                >
                  <Message align={message.role === "user" ? "end" : "start"}>
                    <MessageContent>
                      <Bubble variant={message.role === "user" ? "default" : "ghost"}>
                        <BubbleContent>
                          {message.parts.map((part, index) =>
                            part.type === "text" ? (
                              <span key={index}>{part.text}</span>
                            ) : null
                          )}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {pending.pending ? (
        <Alert>
          <AlertTitle>Confirm action</AlertTitle>
          <AlertDescription>{pending.summary}</AlertDescription>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => handleConfirm(true)}>
              Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleConfirm(false)}>
              Cancel
            </Button>
          </div>
        </Alert>
      ) : null}

      <div className="flex gap-2">
        <Input
          value={input}
          disabled={status !== "ready"}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask about your badminton sessions..."
        />
        <Button onClick={handleSend} disabled={status !== "ready"}>
          Send
        </Button>
      </div>
    </div>
  )
}
```

**Why not `Questionnaire`:** the shadcn skill's chat rules point at `MessageScroller`/`Message`/`Bubble` for the conversation itself, and there's also a `Questionnaire` component (`@shadcn/react`) built for exactly one thing this feature needs — asking the user something and getting a definite answer. It was evaluated for the confirm/reject prompt and ruled out: `Questionnaire` is a multi-step form primitive (`Root` + `Item` + `Choice` + a separate `Submit`) built for sequences of questions with radio/checkbox choices, not a single immediate yes/no action — using it here would mean selecting a choice, THEN clicking a separate Submit button, an extra click for what should be one click. `Alert` (already installed) plus two direct-action `Button`s matches the "Callouts use Alert" rule and keeps the interaction to the one click a HITL gate should be.

- [ ] **Step 5: Add the route**

Create `apps/web/src/routes/_authenticated/chat.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router"
import ChatPage from "@/pages/chat"

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
})
```

- [ ] **Step 6: Verify manually in the browser**

Run: `npm run dev` (repo root, starts both `apps/web` and `apps/api` via Turborepo)
Then open `http://localhost:3000/chat`, log in, send a message that should trigger `createBadmintonSession` (e.g. "create a session for tomorrow, court cost 100000, one participant named Test"), confirm it, and check the new session shows up at `/badminton`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/src/services/url.ts apps/web/src/services/ai/api.ts apps/web/src/pages/chat/index.tsx apps/web/src/routes/_authenticated/chat.tsx
git commit -m "feat(web): add AI chat page"
```

---

## Post-plan checklist

- [ ] Run `npm run migration:run -w @app/api` against the production database before deploying (Task 2's migration).
- [ ] Set `KIMI_API_KEY`, `OPENAI_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY` in `.env.production.local` (or the `_FILE` variants via `docker-compose.prod.yml` secrets, matching how `JWT_SECRET`/`MINIO_SECRET_KEY` are already delivered).
- [ ] Run the Task 4 ingestion script once against production Qdrant before the knowledge-base tool is useful in prod.
- [ ] Do the spec's "one manual golden-path run against the real Kimi API" before calling this shippable — none of the automated tests exercise the real model.

## Final whole-branch review — fixes applied after Task 10

All 10 tasks above were implemented and individually reviewed (see `.superpowers/sdd/2026-09-08-ai-chat-integration/progress.md` for the full ledger of rulings and deferred minors from each round). A final whole-branch review then caught seven issues invisible at single-task scope, all fixed in one closing commit on top of Task 10:

- **`ai.config.ts`**: `kimiChatModel` was a module-level const — `createOpenAICompatible` resolves `apiKey` eagerly, and this module loads (transitively, via `AiModule` → `ChatService`) before `app.module.ts`'s own body runs `resolveFileSecrets()`/`ConfigModule.forRoot()` — so the Authorization header froze in empty on every documented deployment path. Now `getKimiChatModel()`, a lazy memoized getter called from `handleMessage`. `embeddingModel` stays a module-level const — `@ai-sdk/openai` resolves its key lazily at request time, so it was never at risk.
- **`chat.service.ts`**: `onFinish` now flips any existing `PENDING` row in the thread to `REJECTED` before inserting a new one (a second undrafted-but-unconfirmed turn no longer leaves the first one executable). `handleMessage`'s history load is now `take: 40` (`DESC` then reversed) instead of unbounded — the spec's Cost & Ops section budgets against exactly the unbounded case.
- **`rag.service.ts`**: `QDRANT_COLLECTION` is now read inside `search()`, not at module scope (same eager-read defect as `ai.config.ts`, but silently masked by the fail-soft `catch` — a misconfigured collection just looked like "no results"). The leftover `as any` casts on the `.query()` call are gone; the real types check out.
- **`scripts/ingest-knowledge-base.ts`**: was `import 'dotenv/config'`, which only ever finds a bare `.env` — this repo has none, only `.env.<NODE_ENV>.local`. Now mirrors `data-source.ts`'s exact CLI-loading pattern.
- **`apps/web/src/pages/chat/index.tsx`**: `handleConfirm` now has a try/catch with a `toast.error` on failure — previously a 404 (expired draft) was an unhandled rejection and the confirm `Alert` stayed on screen forever.
- **`ai.controller.ts`**: `:threadId` now goes through `ParseUUIDPipe` — a malformed UUID returns 400 instead of 500.
- **`chat.service.spec.ts`**: added 3 tests asserting `userId` actually appears in the scoped `where` clauses (previously untested — deleting `userId` from any of the three scoped queries left every test green), plus a `setParticipantPaid` success-path test (only its reject path was covered).

Deferred, explicitly triaged and not fixed: the dead `configuration.ts` `ai:` block, re-validating tool-call `args` against the DTO/zod schema before executing on confirm, orphaned `USER` rows on a failed LLM call (harmless), and tightening the shared app-wide throttle specifically for `/ai/chat` (a cost-control call for the user, not a correctness fix).
