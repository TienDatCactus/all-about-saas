import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1785518575724 implements MigrationInterface {
	name = 'Init1785518575724';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Added by hand. Every table below defaults its PK to uuid_generate_v4(),
		// which lives in uuid-ossp — and TypeORM's Postgres driver installs that
		// extension itself on connect, so the generated migration never mentioned
		// it. That hidden dependency holds only while the connecting role may
		// CREATE EXTENSION: true for a Compose Postgres (the app user owns the
		// instance), false on most managed Postgres. There, every CREATE TABLE
		// would have failed with "function uuid_generate_v4() does not exist".
		//
		// installExtensions is now off on the CLI DataSource, so this line is the
		// only thing that puts the extension there. No matching DROP in down():
		// another schema in the same database may be using it.
		await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
		await queryRunner.query(
			`CREATE TYPE "public"."o_auth_account_provider_enum" AS ENUM('google', 'github', 'discord', 'facebook')`,
		);
		await queryRunner.query(
			`CREATE TABLE "o_auth_account" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "provider" "public"."o_auth_account_provider_enum" NOT NULL, "providerUserId" character varying NOT NULL, "providerEmail" character varying, "providerUsername" character varying, "avatarUrl" character varying, "accessToken" character varying, "refreshToken" character varying, "profileData" jsonb, "userId" uuid, CONSTRAINT "UQ_efd1b81b377c21791d32e008b58" UNIQUE ("provider", "providerUserId"), CONSTRAINT "PK_c6d5ec585a70cc98562375fafc7" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "session" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "refreshTokenHash" character varying NOT NULL, "deviceName" character varying NOT NULL, "userAgent" character varying NOT NULL, "ipAddress" character varying NOT NULL, "revokedAt" TIMESTAMP, "rotatedAt" TIMESTAMP, "expiresAt" TIMESTAMP NOT NULL, CONSTRAINT "PK_f55da76ac1c3ac420f444d2ff11" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3d2f174ef04fb312fdebd0ddc5" ON "session" ("userId") `,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_ff3907da35cc76361715c820ca" ON "session" ("refreshTokenHash") `,
		);
		await queryRunner.query(
			`CREATE TYPE "public"."verification_token_type_enum" AS ENUM('EMAIL_VERIFY', 'PASSWORD_RESET', 'CHANGE_EMAIL', 'MAGIC_LINK')`,
		);
		await queryRunner.query(
			`CREATE TABLE "verification_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "selector" character varying NOT NULL, "tokenHash" character varying NOT NULL, "type" "public"."verification_token_type_enum" NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "usedAt" TIMESTAMP, "userId" uuid, CONSTRAINT "UQ_f94aadedbbda729afb1f1855e8d" UNIQUE ("selector"), CONSTRAINT "PK_74bc3066ea24f13f37d52a12c79" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "user_profile" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "displayName" character varying, "avatarUrl" character varying, "bio" character varying, "website" character varying, "location" character varying, "phone" character varying, "birthday" date, "userId" uuid, CONSTRAINT "REL_51cb79b5555effaf7d69ba1cff" UNIQUE ("userId"), CONSTRAINT "PK_f44d0cd18cfd80b0fed7806c3b7" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "role" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, CONSTRAINT "UQ_ae4578dcaed5adff96595e61660" UNIQUE ("name"), CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "email" character varying NOT NULL, "password" character varying, "isActive" boolean NOT NULL DEFAULT false, "emailVerified" boolean NOT NULL DEFAULT false, "roleId" uuid, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "badminton_participant" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "sessionId" uuid NOT NULL, "userId" uuid, "name" character varying NOT NULL, "courtFraction" double precision NOT NULL DEFAULT '1', "discount" double precision NOT NULL DEFAULT '0', "shuttleFraction" double precision NOT NULL DEFAULT '1', CONSTRAINT "PK_ffdd812ca78418fb0b1c2821643" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_388fe75283cef42d16d5f6361d" ON "badminton_participant" ("sessionId") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_54434231d179d711919d801eee" ON "badminton_participant" ("userId") `,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_0501ad1b72a3a406de58791e6a" ON "badminton_participant" ("sessionId", "userId") WHERE "userId" IS NOT NULL`,
		);
		await queryRunner.query(
			`CREATE TABLE "badminton_session" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "ownerId" uuid NOT NULL, "playedOn" date NOT NULL, "title" character varying, "courtCost" integer NOT NULL, "shuttleUnitPrice" integer NOT NULL, "totalShuttleCount" integer NOT NULL DEFAULT '0', "shareToken" character varying NOT NULL, "computed" jsonb, CONSTRAINT "PK_de6c3526af7a595fe5f87b07249" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2ce1da6804f5dca257af98f8ce" ON "badminton_session" ("ownerId") `,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_796fde5d76d87954083b9d0699" ON "badminton_session" ("shareToken") `,
		);
		await queryRunner.query(
			`ALTER TABLE "o_auth_account" ADD CONSTRAINT "FK_12d0d6928e2fc57edef813fb7c0" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "session" ADD CONSTRAINT "FK_3d2f174ef04fb312fdebd0ddc53" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "verification_token" ADD CONSTRAINT "FK_0748c047a951e34c0b686bfadb2" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_profile" ADD CONSTRAINT "FK_51cb79b5555effaf7d69ba1cff9" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" ADD CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" ADD CONSTRAINT "FK_388fe75283cef42d16d5f6361d1" FOREIGN KEY ("sessionId") REFERENCES "badminton_session"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" ADD CONSTRAINT "FK_54434231d179d711919d801eee3" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_session" ADD CONSTRAINT "FK_2ce1da6804f5dca257af98f8ce9" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "badminton_session" DROP CONSTRAINT "FK_2ce1da6804f5dca257af98f8ce9"`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" DROP CONSTRAINT "FK_54434231d179d711919d801eee3"`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" DROP CONSTRAINT "FK_388fe75283cef42d16d5f6361d1"`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" DROP CONSTRAINT "FK_c28e52f758e7bbc53828db92194"`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_profile" DROP CONSTRAINT "FK_51cb79b5555effaf7d69ba1cff9"`,
		);
		await queryRunner.query(
			`ALTER TABLE "verification_token" DROP CONSTRAINT "FK_0748c047a951e34c0b686bfadb2"`,
		);
		await queryRunner.query(
			`ALTER TABLE "session" DROP CONSTRAINT "FK_3d2f174ef04fb312fdebd0ddc53"`,
		);
		await queryRunner.query(
			`ALTER TABLE "o_auth_account" DROP CONSTRAINT "FK_12d0d6928e2fc57edef813fb7c0"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_796fde5d76d87954083b9d0699"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_2ce1da6804f5dca257af98f8ce"`,
		);
		await queryRunner.query(`DROP TABLE "badminton_session"`);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_0501ad1b72a3a406de58791e6a"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_54434231d179d711919d801eee"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_388fe75283cef42d16d5f6361d"`,
		);
		await queryRunner.query(`DROP TABLE "badminton_participant"`);
		await queryRunner.query(`DROP TABLE "user"`);
		await queryRunner.query(`DROP TABLE "role"`);
		await queryRunner.query(`DROP TABLE "user_profile"`);
		await queryRunner.query(`DROP TABLE "verification_token"`);
		await queryRunner.query(
			`DROP TYPE "public"."verification_token_type_enum"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_ff3907da35cc76361715c820ca"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_3d2f174ef04fb312fdebd0ddc5"`,
		);
		await queryRunner.query(`DROP TABLE "session"`);
		await queryRunner.query(`DROP TABLE "o_auth_account"`);
		await queryRunner.query(
			`DROP TYPE "public"."o_auth_account_provider_enum"`,
		);
	}
}
