import { validateEnv } from './env.validation';

/** A minimal env that must pass, so each test can break exactly one thing. */
const valid = () => ({
	NODE_ENV: 'development',
	DATABASE_USER: 'aas',
	DATABASE_PASSWORD: 'pw',
	DATABASE_HOST: 'localhost',
	DATABASE_PORT: '5432',
	DATABASE_NAME: 'aas',
	JWT_SECRET: 'a'.repeat(32),
});

describe('validateEnv', () => {
	it('accepts a complete env and preserves unknown keys', () => {
		const out = validateEnv({ ...valid(), SOMETHING_ELSE: 'keep-me' });
		expect(out.JWT_SECRET).toHaveLength(32);
		// Nest uses the return value as its env source, so stripping would make
		// unrelated variables vanish.
		expect(out.SOMETHING_ELSE).toBe('keep-me');
	});

	it('rejects a missing JWT_SECRET instead of booting', () => {
		const env = valid();
		delete (env as Record<string, unknown>).JWT_SECRET;
		expect(() => validateEnv(env)).toThrow(/JWT_SECRET/);
	});

	it('rejects a JWT_SECRET shorter than 32 chars', () => {
		expect(() => validateEnv({ ...valid(), JWT_SECRET: 'short' })).toThrow(
			/at least 32 characters/,
		);
	});

	it('rejects every missing database variable at once', () => {
		const env = valid();
		delete (env as Record<string, unknown>).DATABASE_HOST;
		delete (env as Record<string, unknown>).DATABASE_NAME;
		// One restart per variable is the failure mode this avoids.
		expect(() => validateEnv(env)).toThrow(/DATABASE_HOST[\s\S]*DATABASE_NAME/);
	});

	it('rejects a duration string where seconds are expected', () => {
		// parseInt('15m') === 15, i.e. a 15-second access token.
		expect(() => validateEnv({ ...valid(), JWT_EXPIRES_IN: '15m' })).toThrow(
			/SECONDS/,
		);
	});

	it('accepts numeric seconds', () => {
		expect(() =>
			validateEnv({ ...valid(), JWT_EXPIRES_IN: '900' }),
		).not.toThrow();
	});

	it('catches the REFRESH_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN name mismatch', () => {
		// The repo's own .env had this: the value was set and silently ignored.
		expect(() =>
			validateEnv({ ...valid(), REFRESH_EXPIRES_IN: '604800' }),
		).toThrow(/JWT_REFRESH_EXPIRES_IN/);
	});

	it('requires FRONTEND_URL in production so CORS has an allowlist', () => {
		expect(() => validateEnv({ ...valid(), NODE_ENV: 'production' })).toThrow(
			/FRONTEND_URL/,
		);
		expect(() =>
			validateEnv({
				...valid(),
				NODE_ENV: 'production',
				FRONTEND_URL: 'https://app.example.com',
			}),
		).not.toThrow();
	});

	it('rejects a half-configured OAuth provider', () => {
		expect(() =>
			validateEnv({ ...valid(), GOOGLE_CLIENT_ID: 'real-id' }),
		).toThrow(/half-configured/);
	});

	it('treats committed placeholders as unset rather than configured', () => {
		// Copying .env.example must not look like a working Google login.
		expect(() =>
			validateEnv({
				...valid(),
				GOOGLE_CLIENT_ID: 'your_google_client_id_here',
				GOOGLE_CLIENT_SECRET: 'your_google_client_secret_here',
			}),
		).not.toThrow();
	});

	it('accepts a fully configured OAuth provider', () => {
		expect(() =>
			validateEnv({
				...valid(),
				GOOGLE_CLIENT_ID: 'id',
				GOOGLE_CLIENT_SECRET: 'secret',
				GOOGLE_CALLBACK_URL: 'http://localhost:8000/auth/google/callback',
			}),
		).not.toThrow();
	});
});
