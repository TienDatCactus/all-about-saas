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

	const specPath = join(
		__dirname,
		'../../../../../docs/badminton-splitter-spec.md',
	);
	const chunks = chunkMarkdown(readFileSync(specPath, 'utf8'));
	if (chunks.length === 0) {
		throw new Error(
			`No chunks extracted from ${specPath} — check the file exists and has headings`,
		);
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
