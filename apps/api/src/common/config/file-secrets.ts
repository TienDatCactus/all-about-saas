import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Reads secrets from files into the environment, following the `FOO_FILE`
 * convention that the official Postgres, MySQL and Redis images use.
 *
 * Docker Compose delivers `secrets:` as files under `/run/secrets`, not as
 * environment variables, and that difference is the point: an env var is
 * inherited by every child process, printed by `docker inspect`, readable in
 * `/proc/<pid>/environ`, and shows up in any crash reporter that dumps the
 * environment. A file is readable only by whoever opens it.
 *
 * Both forms keep working — plain `JWT_SECRET` for local dev and CI,
 * `JWT_SECRET_FILE=/run/secrets/jwt_secret` in production — so nothing has to
 * change about how the app reads config.
 *
 * Must run before anything reads `process.env`: bootstrap() before
 * NestFactory.create, and at the top of data-source.ts for the migration CLI,
 * which never boots Nest at all.
 */

/**
 * Explicit allowlist rather than "any var ending in _FILE". A blanket rule would
 * pick up an unrelated variable that happens to end that way and try to read a
 * path that isn't one.
 */
const FILE_BACKED = [
	'DATABASE_PASSWORD',
	'JWT_SECRET',
	'BASE_PASSWORD',
	'EMAIL_PASS',
	// The api reads the object store with the MinIO root credentials, and the
	// prod stack already delivers that password as the `minio_root_password`
	// secret for the minio service itself. Same file, one reader more.
	'MINIO_ACCESS_KEY',
	'MINIO_SECRET_KEY',
	'GOOGLE_CLIENT_ID',
	'GOOGLE_CLIENT_SECRET',
	'GOOGLE_CALLBACK_URL',
	'GITHUB_CLIENT_ID',
	'GITHUB_CLIENT_SECRET',
	'GITHUB_CALLBACK_URL',
	'FACEBOOK_CLIENT_ID',
	'FACEBOOK_CLIENT_SECRET',
	'FACEBOOK_CALLBACK_URL',
] as const;

const ALIASES: Record<string, string[]> = {
	DATABASE_PASSWORD: ['db_password', 'database_password', 'DATABASE_PASSWORD'],
	MINIO_SECRET_KEY: [
		'minio_root_password',
		'minio_secret_key',
		'MINIO_SECRET_KEY',
		'MINIO_ROOT_PASSWORD',
	],
	MINIO_ACCESS_KEY: [
		'minio_root_user',
		'minio_access_key',
		'MINIO_ACCESS_KEY',
		'MINIO_ROOT_USER',
	],
	JWT_SECRET: ['jwt_secret', 'JWT_SECRET'],
	BASE_PASSWORD: ['base_password', 'BASE_PASSWORD'],
};

export function resolveFileSecrets(env: NodeJS.ProcessEnv = process.env): void {
	const secretsDir = env.SECRETS_DIR || '/run/secrets';

	for (const name of FILE_BACKED) {
		let path = env[`${name}_FILE`];
		const isExplicit = Boolean(path);

		if (!path) {
			const candidateNames = ALIASES[name] ?? [name.toLowerCase(), name];
			for (const cand of candidateNames) {
				const checkPath = join(secretsDir, cand);
				if (existsSync(checkPath)) {
					path = checkPath;
					break;
				}
			}
		}

		if (!path) continue;

		let contents: string;
		try {
			contents = readFileSync(path, 'utf8');
		} catch (error) {
			if (!isExplicit) continue;
			// Crash rather than fall through to an undefined secret. The alternative
			// is booting with `JWT_SECRET=undefined`, which is precisely what env
			// validation exists to prevent.
			throw new Error(
				`${name}_FILE points at ${path}, which could not be read: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}

		// Strip one trailing line terminator in any form — CRLF, LF, or a bare CR.
		// Not a full trim(): that would silently alter a passphrase that
		// legitimately begins or ends with a space.
		const resolved = contents.replace(/(?:\r\n|\n|\r)$/, '');
		if (resolved.length > 0) {
			env[name] = resolved;
		}
	}
}
