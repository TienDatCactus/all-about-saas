# Guide: self-hosted MinIO for MoMo QR image upload

Scope: host uploads their own MoMo QR image (from MoMo app), stored on
MinIO running in your existing VPS docker-compose stack, URL saved on
`UserProfile`, shown on the public share-summary page.

MinIO is S3-compatible — same AWS SDK code as Cloudflare R2 would need,
just a different endpoint/credentials and one extra client option
(`forcePathStyle`). No card, no external account.

## 1. Add MinIO to the prod stack

`docker-compose.prod.yml` — new service, internal network only (same
pattern as postgres: no published port, Caddy is the only way in):

```yaml
  minio:
    image: minio/minio:latest
    restart: unless-stopped
    logging: *default-logging
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:?set MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD_FILE: /run/secrets/minio_root_password
    secrets: [minio_root_password]
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    networks: [internal]
    healthcheck:
      test: ['CMD', 'mc', 'ready', 'local']
      interval: 10s
      timeout: 5s
      retries: 5

  # One-shot: creates the bucket and makes it anonymously readable (GET only —
  # write still requires the root credentials). Runs once per deploy; mc
  # commands are idempotent so re-running on redeploy is harmless.
  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    networks: [internal]
    secrets: [minio_root_password]
    entrypoint:
      - /bin/sh
      - -ceu
      - |
        export MC_HOST_local="http://${MINIO_ROOT_USER}:$$(cat /run/secrets/minio_root_password)@minio:9000"
        mc mb -p local/aas-uploads
        mc anonymous set download local/aas-uploads
    restart: 'no'
```

Add the secret alongside the existing ones:

```yaml
secrets:
  # ...existing entries...
  minio_root_password:
    file: ./secrets/minio_root_password
```

```yaml
volumes:
  # ...existing entries...
  minio_data:
```

`api` service `depends_on`: add `minio_init: condition: service_completed_successfully`
if you want the bucket guaranteed to exist before the API starts (optional —
the API only needs it by the time someone uploads, not at boot).

Create the secret once on the VPS, same as the others:
```bash
openssl rand -hex 24 > secrets/minio_root_password
```

## 2. Expose bucket reads through Caddy (no new domain)

Public MoMo QR images need a stable public URL. Route it under the
existing API domain instead of opening a new port or domain — keeps the
CSP (`img-src 'self'`) satisfied with zero changes.

`Caddyfile`, inside the `{$API_DOMAIN}` block, before the catch-all
`reverse_proxy api:8000`:

```
{$API_DOMAIN} {
	encode zstd gzip

	handle_path /storage/* {
		reverse_proxy minio:9000
	}

	reverse_proxy api:8000

	header {
		...
	}
}
```

Public image URL becomes: `https://<API_DOMAIN>/storage/aas-uploads/momo-qr/<key>`

## 3. Env vars (`apps/api/.env`, and `.env.prod` on the VPS)

```
MINIO_ENDPOINT=http://minio:9000        # prod: internal docker network name
MINIO_ACCESS_KEY=<MINIO_ROOT_USER>
MINIO_SECRET_KEY=<MINIO_ROOT_PASSWORD>
MINIO_BUCKET=aas-uploads
MINIO_PUBLIC_URL=https://<API_DOMAIN>/storage/aas-uploads
```

For local dev, add a matching `minio` service to the dev `docker-compose.yml`
(published ports this time, since there's no Caddy in front locally):

```yaml
  minio:
    image: minio/minio:latest
    container_name: aas-minio
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    command: server /data --console-address ":9001"
    ports:
      - '${MINIO_API_PORT:-9000}:9000'
      - '${MINIO_CONSOLE_PORT:-9001}:9001'
    volumes:
      - minio_data:/data
```

then create+expose the bucket once via the MinIO console at
`http://localhost:9001` (login `minioadmin`/`minioadmin`), or the same
`mc mb` / `mc anonymous set download` commands from step 1 run against
`localhost:9000`.

## 4. Install SDK

```bash
cd apps/api
npm install @aws-sdk/client-s3
```

## 5. Backend — upload module

`apps/api/src/storage/minio.client.ts`
```ts
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
```

`apps/api/src/storage/storage.service.ts`
```ts
import { Injectable } from '@nestjs/common';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { storageClient } from './minio.client';

@Injectable()
export class StorageService {
  async uploadImage(buffer: Buffer, mimetype: string): Promise<string> {
    const key = `momo-qr/${randomUUID()}`;
    await storageClient.send(new PutObjectCommand({
      Bucket: process.env.MINIO_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    }));
    return `${process.env.MINIO_PUBLIC_URL}/${key}`;
  }
}
```

`apps/api/src/users/users.controller.ts` — new endpoint
```ts
@Post('me/momo-qr')
@UseInterceptors(FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_, file, cb) => {
    cb(null, ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype));
  },
}))
async uploadMomoQr(@Req() req, @UploadedFile() file: Express.Multer.File) {
  const user = requireUser(req);
  const url = await this.storageService.uploadImage(file.buffer, file.mimetype);
  await this.usersService.updateProfile(user.id, { momoQrUrl: url });
  return { momoQrUrl: url };
}
```

Install multer types if missing: `npm install -D @types/multer`.

## 6. DB migration

Add `momoQrUrl: string | null` column to `UserProfile`
(`apps/api/src/users/entities/user-profile.entity.ts`), then:

```bash
cd apps/api
npm run migration:generate -- src/database/migrations/AddMomoQrUrlToUserProfile
npm run migration:run
```

(check `apps/api/package.json` for the exact migration script names)

## 7. Frontend — upload UI

No existing file-input component in the repo — plain `<input type="file">`
is enough, no library needed:

```tsx
const [uploading, setUploading] = useState(false);

async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  setUploading(true);
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/users/me/momo-qr', form); // don't set Content-Type manually — let the browser set the multipart boundary
  setUploading(false);
  // res.data.momoQrUrl -> save to local state / refetch profile
}

<input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUpload} disabled={uploading} />
```

On the share-summary page, render `session.owner.profile.momoQrUrl` as a
large `<img>` at the bottom when present; hide the block entirely if null.

## 8. Verify

- `docker compose -f docker-compose.prod.yml ps` → `minio` healthy,
  `minio-init` exited 0.
- `curl -F file=@qr.png https://<API_DOMAIN>/users/me/momo-qr -H "Authorization: Bearer <token>"`
  → expect `{ momoQrUrl: "https://<API_DOMAIN>/storage/aas-uploads/momo-qr/..." }`
- Open the returned URL directly in a browser, logged out — must load the
  image with no auth (bucket policy set to anonymous download-only).
- Confirm oversized (>2MB) or non-image files are rejected with 400, not 500.
- Confirm you can NOT write to the bucket without credentials — e.g.
  `curl -X PUT https://<API_DOMAIN>/storage/aas-uploads/x -d hi` must fail;
  `mc anonymous set download` (not `public`) grants read-only, not write.

## Notes

- Keep the 2MB limit — this is a single QR image, not a general file/media
  system.
- `minio_data` is a named volume on the VPS — back it up like `pgdata` if the
  QR images matter beyond "host can just re-upload it."
- If you later get a card and want managed storage instead, swapping to R2
  is a 3-line change: different `endpoint`, drop `forcePathStyle`, and R2's
  own public bucket URL instead of the Caddy `/storage/*` route — the rest
  of the code (service, controller, migration, frontend) is untouched
  because both are S3-compatible.
