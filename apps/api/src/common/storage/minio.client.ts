import { S3Client } from '@aws-sdk/client-s3';

export const storageClient = new S3Client({
	region: 'us-east-1', // arbitrary — MinIO ignores region, SDK requires one
	endpoint: process.env.MINIO_ENDPOINT,
	forcePathStyle: true, // required for MinIO: bucket.endpoint/key won't resolve
	credentials: {
		accessKeyId: process.env.MINIO_ACCESS_KEY!,
		secretAccessKey: process.env.MINIO_SECRET_KEY!,
	},
});
