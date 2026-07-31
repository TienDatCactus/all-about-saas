import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolveFileSecrets } from './file-secrets';

/**
 * The line-ending cases below are the whole point of this suite. A secret file is
 * written by whatever shell the operator happened to use, and the Postgres image
 * reading the *same file* strips trailing newlines — so anything stricter here
 * means the database is initialised with one password and the API sends another,
 * with nothing visible on either side except "password authentication failed".
 */
describe('resolveFileSecrets', () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'file-secrets-'));
	});

	const secretFile = (contents: string, name = 'db_password') => {
		const path = join(dir, name);
		writeFileSync(path, contents);
		return path;
	};

	it('populates the variable from the file', () => {
		const env = { DATABASE_PASSWORD_FILE: secretFile('s3cret') };

		resolveFileSecrets(env);

		expect(env).toMatchObject({ DATABASE_PASSWORD: 's3cret' });
	});

	it.each([
		['LF', 's3cret\n'],
		['CRLF', 's3cret\r\n'],
		// `openssl rand ... > file` under Git Bash writes CRLF; a following
		// `tr -d '\n'` leaves exactly this.
		['bare CR', 's3cret\r'],
	])('strips a trailing %s', (_label, contents) => {
		const env: NodeJS.ProcessEnv = {
			DATABASE_PASSWORD_FILE: secretFile(contents),
		};

		resolveFileSecrets(env);

		expect(env.DATABASE_PASSWORD).toBe('s3cret');
	});

	it('strips only ONE terminator, so a deliberate blank line survives', () => {
		const env: NodeJS.ProcessEnv = {
			DATABASE_PASSWORD_FILE: secretFile('s3cret\n\n'),
		};

		resolveFileSecrets(env);

		expect(env.DATABASE_PASSWORD).toBe('s3cret\n');
	});

	it('leaves interior and leading whitespace alone', () => {
		// A passphrase may legitimately contain — or start with — a space, so this
		// deliberately does not trim().
		const env: NodeJS.ProcessEnv = {
			DATABASE_PASSWORD_FILE: secretFile('  two words  \n'),
		};

		resolveFileSecrets(env);

		expect(env.DATABASE_PASSWORD).toBe('  two words  ');
	});

	it('does nothing when no *_FILE variable is set', () => {
		const env = { DATABASE_PASSWORD: 'from-env' };

		resolveFileSecrets(env);

		expect(env).toEqual({ DATABASE_PASSWORD: 'from-env' });
	});

	it('lets the file win over an existing plain variable', () => {
		const env = {
			DATABASE_PASSWORD: 'stale',
			DATABASE_PASSWORD_FILE: secretFile('from-file'),
		};

		resolveFileSecrets(env);

		expect(env.DATABASE_PASSWORD).toBe('from-file');
	});

	it('throws naming the variable when the file cannot be read', () => {
		const env = { JWT_SECRET_FILE: join(dir, 'does-not-exist') };

		// Crash rather than boot with an undefined secret — the failure this whole
		// config layer exists to prevent.
		expect(() => resolveFileSecrets(env)).toThrow(/JWT_SECRET_FILE/);
	});

	it('ignores a *_FILE name that is not on the allowlist', () => {
		const env = { SOME_OTHER_FILE: join(dir, 'does-not-exist') };

		expect(() => resolveFileSecrets(env)).not.toThrow();
		expect(env).not.toHaveProperty('SOME_OTHER');
	});
});
