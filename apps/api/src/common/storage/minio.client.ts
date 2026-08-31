import { S3Client } from '@aws-sdk/client-s3';

/**
 * Lazy, not `export const storageClient = new S3Client(...)`: this module can
 * be `require()`'d — via PaymentMethodsModule's own import chain — before
 * app.module.ts's top-level `resolveFileSecrets()` call and its
 * `ConfigModule.forRoot()` (which loads `.env.<NODE_ENV>.local`) have run, since
 * CommonJS executes each `require()`'d file's top-level code the moment that
 * `require()` statement is reached, not after the requiring file's own body.
 * A module-scope `new S3Client({ credentials: { accessKeyId: process.env... }})`
 * therefore froze `accessKeyId`/`secretAccessKey` at `undefined` for the whole
 * process lifetime — the API booted and served every other route fine, and
 * only failed, with a signing-layer "Resolved credential object is not valid"
 * error, the moment something actually tried to upload to MinIO. Constructing
 * it on first use instead means `process.env` is read at request time, long
 * after env loading has actually happened.
 */
let client: S3Client | undefined;

export function getStorageClient(): S3Client {
	if (!client) {
		client = new S3Client({
			region: 'us-east-1', // arbitrary — MinIO ignores region, SDK requires one
			endpoint: process.env.MINIO_ENDPOINT,
			forcePathStyle: true, // required for MinIO: bucket.endpoint/key won't resolve
			credentials: {
				accessKeyId: process.env.MINIO_ACCESS_KEY!,
				secretAccessKey: process.env.MINIO_SECRET_KEY!,
			},
		});
	}
	return client;
}
