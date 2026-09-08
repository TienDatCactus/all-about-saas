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
			const { embedding } = await embed({
				model: embeddingModel,
				value: query,
			});
			const response = await (this.qdrant as any).query(COLLECTION, {
				query: embedding,
				limit,
				with_payload: true,
			});
			return response.points.map((point: any) => ({
				text: String((point.payload as Record<string, unknown>)?.text ?? ''),
				heading: String(
					(point.payload as Record<string, unknown>)?.heading ?? '',
				),
				score: point.score,
			}));
		} catch (error) {
			this.logger.warn(
				`Knowledge-base search failed, answering without it: ${error}`,
			);
			return [];
		}
	}
}
