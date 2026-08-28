import { Logger } from '@nestjs/common';
import { z } from 'zod';

/**
 * Boot-time env validation.
 *
 * Without this the app starts happily with `JWT_SECRET=undefined` and signs
 * tokens anyone can forge, or with a misspelled var silently falling back to a
 * default. Every problem below used to be a runtime surprise; now it is a crash
 * at startup with the variable named.
 */

/** One year. Past this, a "duration" is almost certainly milliseconds. */
const MAX_TTL_SECONDS = 31_536_000;

/** Durations are read with parseInt, so "15m" would quietly mean 15 seconds. */
const secondsField = (name: string) =>
	z
		.string()
		.regex(
			/^\d+$/,
			`${name} must be a whole number of SECONDS (e.g. 900 for 15 minutes) — a duration string like "15m" parses to ${name === 'JWT_EXPIRES_IN' ? '15 seconds' : 'the leading digits only'}`,
		)
		// Catches the seconds/milliseconds mix-up: 604800000 ("7 days in ms") is
		// a perfectly valid number that yields a session expiring in ~19 years.
		.refine((v) => Number(v) <= MAX_TTL_SECONDS, {
			message: `${name} exceeds one year in seconds — did you supply milliseconds?`,
		})
		.optional();

/** OAuth is optional per provider, but half-configured is always a mistake. */
const oauthProvider = (prefix: string) => ({
	[`${prefix}_CLIENT_ID`]: z.string().min(1).optional(),
	[`${prefix}_CLIENT_SECRET`]: z.string().min(1).optional(),
	[`${prefix}_CALLBACK_URL`]: z.string().url().optional(),
});

// looseObject: the return value becomes Nest's env source, so unknown keys
// must survive validation rather than being stripped.
const baseSchema = z.looseObject({
	NODE_ENV: z
		.enum(['development', 'test', 'production'])
		.default('development'),
	PORT: z.string().regex(/^\d+$/).optional(),

	DATABASE_USER: z.string().min(1),
	DATABASE_PASSWORD: z.string().min(1),
	DATABASE_HOST: z.string().min(1),
	DATABASE_PORT: z.string().regex(/^\d+$/),
	DATABASE_NAME: z.string().min(1),
	DATABASE_SSL: z.enum(['true', 'false']).optional(),
	DATABASE_SSL_REJECT_UNAUTHORIZED: z.enum(['true', 'false']).optional(),
	DATABASE_POOL_MAX: z.string().regex(/^\d+$/).optional(),
	DATABASE_SYNCHRONIZE: z.enum(['true', 'false']).optional(),

	JWT_SECRET: z
		.string()
		.min(
			32,
			'JWT_SECRET must be at least 32 characters (use `openssl rand -hex 32`)',
		),
	JWT_EXPIRES_IN: secondsField('JWT_EXPIRES_IN'),
	JWT_REFRESH_EXPIRES_IN: secondsField('JWT_REFRESH_EXPIRES_IN'),

	FRONTEND_URL: z.string().min(1).optional(),
	BASE_PASSWORD: z.string().min(1).optional(),

	DEV_AUTH_BYPASS: z.enum(['true', 'false']).optional(),

	...oauthProvider('GOOGLE'),
	...oauthProvider('GITHUB'),
	...oauthProvider('FACEBOOK'),

	// Object store for the MoMo QR upload. Required, like DATABASE_*, rather than
	// optional: with any one of these missing the S3 client still constructs and
	// the upload still returns a URL — just one built from the string
	// "undefined", pointing at nothing. That is a broken payment method the host
	// only discovers when a participant cannot pay.
	//
	// MINIO_SECRET_KEY also accepts the MINIO_SECRET_KEY_FILE form (see
	// file-secrets.ts), which is how the production stack passes it.
	MINIO_ENDPOINT: z.string().url(),
	MINIO_ACCESS_KEY: z.string().min(1),
	MINIO_SECRET_KEY: z.string().min(1),
	MINIO_BUCKET: z.string().min(1),
	/** Public base URL the uploaded object is served from, WITHOUT a trailing slash. */
	MINIO_PUBLIC_URL: z.string().url(),

	EMAIL_HOST: z.string().min(1).optional(),
	EMAIL_PORT: z.string().regex(/^\d+$/).optional(),
	EMAIL_SECURE: z.enum(['true', 'false']).optional(),

	COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).optional(),
	COOKIE_SECURE: z.enum(['true', 'false']).optional(),
});

const envSchema = baseSchema.superRefine((env, ctx) => {
	// CORS falls back to reflecting any origin when this is unset, which is
	// unsafe with credentials:true — so production must name its frontend.
	if (env.NODE_ENV === 'production' && !env.FRONTEND_URL) {
		ctx.addIssue({
			code: 'custom',
			path: ['FRONTEND_URL'],
			message:
				'FRONTEND_URL is required in production — CORS needs an explicit origin allowlist',
		});
	}

	// POST /auth/dev/login mints real tokens for any email, no credentials — it
	// exists so local dev needs no OAuth apps. In production that is an open
	// door into any account, so the flag is refused before the route can exist.
	if (env.NODE_ENV === 'production' && env.DEV_AUTH_BYPASS === 'true') {
		ctx.addIssue({
			code: 'custom',
			path: ['DEV_AUTH_BYPASS'],
			message:
				'DEV_AUTH_BYPASS=true is refused in production — it lets anyone log in as any email without credentials',
		});
	}

	// `synchronize` lets TypeORM reshape the schema from the entity files. Against
	// a production database that means silent column drops and data loss, with no
	// migration to review or roll back. database.ts already gates it on
	// NODE_ENV==='development'; this makes an explicit attempt fail loudly rather
	// than appear to work.
	if (env.NODE_ENV === 'production' && env.DATABASE_SYNCHRONIZE === 'true') {
		ctx.addIssue({
			code: 'custom',
			path: ['DATABASE_SYNCHRONIZE'],
			message:
				'DATABASE_SYNCHRONIZE=true is refused in production — it can drop columns without a migration; run `npm run migration:run` instead',
		});
	}

	// TLS to the database with certificate verification disabled stops passive
	// eavesdropping but not an active impersonator, so it is worth being explicit
	// that it was chosen rather than inherited.
	if (
		env.NODE_ENV === 'production' &&
		env.DATABASE_SSL === 'true' &&
		env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false'
	) {
		Logger.warn(
			'DATABASE_SSL_REJECT_UNAUTHORIZED=false: the database certificate is not verified, so TLS here protects against eavesdropping but not impersonation.',
		);
	}

	// A real misconfiguration in this repo: .env ships REFRESH_EXPIRES_IN but
	// configuration.ts reads JWT_REFRESH_EXPIRES_IN, so the value was ignored
	// and the refresh TTL silently used its hardcoded default.
	if (env.REFRESH_EXPIRES_IN && !env.JWT_REFRESH_EXPIRES_IN) {
		ctx.addIssue({
			code: 'custom',
			path: ['JWT_REFRESH_EXPIRES_IN'],
			message:
				'Found REFRESH_EXPIRES_IN, but the app reads JWT_REFRESH_EXPIRES_IN — rename it, or the refresh TTL you set is ignored',
		});
	}

	for (const prefix of ['GOOGLE', 'GITHUB', 'FACEBOOK'] as const) {
		const parts = [
			`${prefix}_CLIENT_ID`,
			`${prefix}_CLIENT_SECRET`,
			`${prefix}_CALLBACK_URL`,
		];
		const set = parts.filter((p) => {
			const v = env[p];
			// The committed example ships obvious placeholders; treat them as unset
			// so a copied .env doesn't look like a configured provider.
			return (
				typeof v === 'string' &&
				v.length > 0 &&
				!v.startsWith('your_') &&
				v !== 'placeholder_id'
			);
		});
		if (set.length > 0 && set.length < parts.length) {
			ctx.addIssue({
				code: 'custom',
				path: [parts[0]],
				message: `${prefix} OAuth is half-configured — set all of ${parts.join(', ')} or none`,
			});
		}
	}
});

export function validateEnv(config: Record<string, unknown>) {
	const result = envSchema.safeParse(config);
	if (result.success) return result.data;

	// Every problem at once, not just the first: a fresh deploy usually has
	// several, and one-at-a-time discovery means one restart per variable.
	const lines = result.error.issues.map(
		(i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`,
	);
	throw new Error(
		`Invalid environment configuration:\n${lines.join('\n')}\n\nSee apps/api/.env.example.`,
	);
}
