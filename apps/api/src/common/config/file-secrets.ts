import { readFileSync } from 'fs';

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
	'MINIO_SECRET_KEY',
	'GOOGLE_CLIENT_SECRET',
	'GITHUB_CLIENT_SECRET',
	'FACEBOOK_CLIENT_SECRET',
] as const;

export function resolveFileSecrets(env: NodeJS.ProcessEnv = process.env): void {
	for (const name of FILE_BACKED) {
		const path = env[`${name}_FILE`];
		if (!path) continue;

		let contents: string;
		try {
			contents = readFileSync(path, 'utf8');
		} catch (error) {
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
		//
		// The bare-CR case is not hypothetical. `openssl rand ... > secrets/x` under
		// Git Bash writes CRLF; a `tr -d '\n'` afterwards leaves the CR behind. An
		// earlier version of this regex required an \n, so it kept that CR while
		// the Postgres image's own *_FILE handling dropped it — the database was
		// initialised with one password and the API sent another, failing with
		// "password authentication failed" and nothing on either side to see.
		// Being less forgiving than the other reader of the same file is the bug.
		env[name] = contents.replace(/(?:\r\n|\n|\r)$/, '');
	}
}
