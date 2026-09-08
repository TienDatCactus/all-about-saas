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
