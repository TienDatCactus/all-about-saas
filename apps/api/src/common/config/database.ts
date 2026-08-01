import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Postgres over TLS. Off by default because the deploy blueprint keeps Postgres
 * on an internal Docker network with no published port, where TLS buys nothing;
 * flip it on the moment the database moves anywhere the traffic crosses a
 * network you don't own (managed Postgres, another host, a VPN peer).
 */
const ssl =
	process.env.DATABASE_SSL === 'true'
		? {
				// Managed providers that present a private CA need this off. It is a
				// separate switch on purpose: `rejectUnauthorized: false` accepts any
				// certificate, which stops an eavesdropper but not an impersonator, so
				// it should be a deliberate choice rather than the price of enabling SSL.
				rejectUnauthorized:
					process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
			}
		: false;

export default registerAs('database', (): TypeOrmModuleOptions => ({
	type: 'postgres',

	host: process.env.DATABASE_HOST,

	port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),

	username: process.env.DATABASE_USER,

	password: process.env.DATABASE_PASSWORD,

	database: process.env.DATABASE_NAME,

	autoLoadEntities: true,

	logging: process.env.NODE_ENV === 'development',

	/**
	 * Schema management. Still keyed on NODE_ENV because no migration is committed
	 * yet — dropping this outright today would leave a fresh dev database with no
	 * tables at all. The extra opt-out exists so a developer can turn it off
	 * without pretending to be in production, and env validation refuses to let it
	 * be true when NODE_ENV=production.
	 */
	synchronize:
		process.env.NODE_ENV === 'development' &&
		process.env.DATABASE_SYNCHRONIZE !== 'false',

	// Migrations are run by the CLI against common/config/data-source.ts as a
	// deploy step, never by the app at boot. This entry only keeps the runtime
	// DataSource consistent with that one.
	migrations: [`${__dirname}/../../database/migrations/*.{ts,js}`],

	ssl,

	extra: {
		/**
		 * Default was unbounded-ish (pg's own 10, but never stated). Sized against
		 * Postgres's `max_connections` (100 by default) divided across every
		 * connecting process — API replicas, the migration job, psql sessions — so
		 * scaling out doesn't turn into "too many clients already".
		 */
		max: parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10),
		/** Fail a stuck handshake instead of hanging the request that triggered it. */
		connectionTimeoutMillis: 10_000,
		idleTimeoutMillis: 30_000,
	},
}));
