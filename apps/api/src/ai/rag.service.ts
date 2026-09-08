import { Inject, Injectable, Logger } from '@nestjs/common';
import { embed } from 'ai';
import type { QdrantClient } from '@qdrant/js-client-rest';
import { embeddingModel } from './ai.config';
import { QDRANT_CLIENT } from './qdrant.provider';

const COLLECTION = process.env.QDRANT_COLLECTION || 'twinfoundry-kb';

@Injectable()
export class RagService {
	private readonly logger = new Logger(RagService.name);

	constructor(
		@Inject(QDRANT_CLIENT)
		private readonly qdrant: QdrantClient & {
			search: (
				collection: string,
				request: {
					vector: number[];
					limit: number;
					with_payload: boolean;
				},
			) => Promise<
				Array<{ score: number; payload: Record<string, unknown> }>
			>;
		},
	) {}

	/** Fails soft: a chat turn should answer without retrieved context rather
	 *  than break because Qdrant is briefly unreachable. */
	async search(
		query: string,
		limit = 4,
	): Promise<Array<{ text: string; heading: string; score: number }>> {
		try {
			const { embedding } = await embed({
				model: embeddingModel,
				value: query,
			});
			const hits = await this.qdrant.search(COLLECTION, {
				vector: embedding,
				limit,
				with_payload: true,
			});
			return hits.map((hit: { score: number; payload: Record<string, unknown> }) => ({
				text: String((hit.payload as Record<string, unknown>)?.text ?? ''),
				heading: String(
					(hit.payload as Record<string, unknown>)?.heading ?? '',
				),
				score: hit.score,
			}));
		} catch (error) {
			this.logger.warn(
				`Knowledge-base search failed, answering without it: ${error}`,
			);
			return [];
		}
	}
}
