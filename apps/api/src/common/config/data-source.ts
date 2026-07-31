import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { resolveFileSecrets } from './file-secrets';

/**
 * DataSource for the TypeORM **CLI only** (migration:generate / run / revert).
 * The running app configures itself through `database.ts` + ConfigModule.
 *
 * The CLI never boots Nest, so nothing loaded the env file for it — every
 * DATABASE_* was `undefined` and the CLI quietly tried localhost as the current
 * OS user instead of failing with a useful message.
 */
loadEnv({
	path: `.env.${process.env.NODE_ENV ?? 'development'}.local`,
	quiet: true,
});

// The migration job runs in the same Compose stack as the api and gets the same
// mounted secrets, so it needs the same DATABASE_PASSWORD_FILE handling. Nest
// does it in main.ts; nothing here goes through main.ts.
resolveFileSecrets();

export default new DataSource({
	type: 'postgres',
	host: process.env.DATABASE_HOST,
	port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
	username: process.env.DATABASE_USER,
	password: process.env.DATABASE_PASSWORD,
	database: process.env.DATABASE_NAME,

	// Resolved from __dirname, not cwd, and matching both extensions — this file
	// runs in two very different contexts:
	//   - locally through ts-node   → src/common/config/data-source.ts
	//   - in the image as compiled  → dist/common/config/data-source.js
	// A `src/**/*.ts` glob found zero migrations inside the container, so the
	// deploy step would have reported success while applying nothing.
	entities: [join(__dirname, '..', '..', '**', '*.entity.{ts,js}')],
	migrations: [
		join(__dirname, '..', '..', 'database', 'migrations', '*.{ts,js}'),
	],

	// Never true here. Schema changes go through committed migrations so a fresh
	// production database is reproducible.
	synchronize: false,
	logging: ['error'],
});
