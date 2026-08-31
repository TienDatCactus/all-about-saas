import { Injectable } from '@nestjs/common';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { getStorageClient } from './minio.client';

@Injectable()
export class StorageService {
	async uploadImage(buffer: Buffer, mimetype: string): Promise<string> {
		const key = `momo-qr/${randomUUID()}`;
		await getStorageClient().send(
			new PutObjectCommand({
				Bucket: process.env.MINIO_BUCKET,
				Key: key,
				Body: buffer,
				ContentType: mimetype,
			}),
		);
		return `${process.env.MINIO_PUBLIC_URL}/${key}`;
	}
}
