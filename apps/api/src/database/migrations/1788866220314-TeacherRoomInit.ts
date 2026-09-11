import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeacherRoomInit1788866220314 implements MigrationInterface {
	name = 'TeacherRoomInit1788866220314';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "student" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "ownerId" uuid NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_3d8016e1cb58429474a3c041904" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_80d65327cbdddf7c2752f3a2e2" ON "student" ("ownerId") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_eead2cd6e5be2c86303b786bff" ON "student" ("name") `,
		);
		await queryRunner.query(
			`CREATE TABLE "weekly_schedule_slot" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "ownerId" uuid NOT NULL, "studentId" uuid NOT NULL, "dayOfWeek" integer NOT NULL, "startTime" character varying NOT NULL, "endTime" character varying NOT NULL, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_04c41105e64f9684cbaa7b24c55" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_078cb24b0c5a108b4637ed6d6c" ON "weekly_schedule_slot" ("ownerId") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5295c7b9f39f9283fa152a46d7" ON "weekly_schedule_slot" ("studentId") `,
		);
		await queryRunner.query(
			`CREATE TYPE "public"."teaching_session_status_enum" AS ENUM('scheduled', 'completed', 'cancelled')`,
		);
		await queryRunner.query(
			`CREATE TYPE "public"."teaching_session_type_enum" AS ENUM('regular', 'makeup', 'extra')`,
		);
		await queryRunner.query(
			`CREATE TYPE "public"."teaching_session_priority_enum" AS ENUM('low', 'normal', 'high')`,
		);
		await queryRunner.query(
			`CREATE TABLE "teaching_session" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "ownerId" uuid NOT NULL, "studentId" uuid NOT NULL, "slotId" uuid, "scheduledDate" date NOT NULL, "startTime" character varying NOT NULL, "endTime" character varying NOT NULL, "status" "public"."teaching_session_status_enum" NOT NULL DEFAULT 'scheduled', "type" "public"."teaching_session_type_enum" NOT NULL DEFAULT 'regular', "priority" "public"."teaching_session_priority_enum" NOT NULL DEFAULT 'normal', "note" text, "confirmedAt" TIMESTAMP WITH TIME ZONE, "preReminderSentAt" TIMESTAMP WITH TIME ZONE, "postReminderSentAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d6f4304e092814df4ba645f0525" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ef83f94f3deee0b05efbfcebf5" ON "teaching_session" ("ownerId") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_362d49fbf699c64c82d165451c" ON "teaching_session" ("studentId") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1121c8dd24c32a8320cbcedb96" ON "teaching_session" ("slotId") `,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_a182b69f8f76b3ff0449241b05" ON "teaching_session" ("slotId", "scheduledDate") WHERE "slotId" IS NOT NULL`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_edd6ed12347b47bae2168d695e" ON "teaching_session" ("ownerId", "scheduledDate") `,
		);
		await queryRunner.query(
			`CREATE TYPE "public"."teaching_session_history_action_enum" AS ENUM('created', 'rescheduled', 'cancelled', 'completed', 'reopened', 'note_updated', 'priority_changed')`,
		);
		await queryRunner.query(
			`CREATE TABLE "teaching_session_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "sessionId" uuid NOT NULL, "action" "public"."teaching_session_history_action_enum" NOT NULL, "fromDate" date, "toDate" date, "note" text, CONSTRAINT "PK_9455a7c98b57f856e4dc7ded375" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_91934e3fb8dd029eb61763329a" ON "teaching_session_history" ("sessionId") `,
		);
		await queryRunner.query(
			`ALTER TABLE "student" ADD CONSTRAINT "FK_80d65327cbdddf7c2752f3a2e2b" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "weekly_schedule_slot" ADD CONSTRAINT "FK_078cb24b0c5a108b4637ed6d6cb" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "weekly_schedule_slot" ADD CONSTRAINT "FK_5295c7b9f39f9283fa152a46d71" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "teaching_session" ADD CONSTRAINT "FK_ef83f94f3deee0b05efbfcebf5f" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "teaching_session" ADD CONSTRAINT "FK_362d49fbf699c64c82d165451cf" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "teaching_session" ADD CONSTRAINT "FK_1121c8dd24c32a8320cbcedb96c" FOREIGN KEY ("slotId") REFERENCES "weekly_schedule_slot"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "teaching_session_history" ADD CONSTRAINT "FK_91934e3fb8dd029eb61763329a5" FOREIGN KEY ("sessionId") REFERENCES "teaching_session"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "teaching_session_history" DROP CONSTRAINT "FK_91934e3fb8dd029eb61763329a5"`,
		);
		await queryRunner.query(
			`ALTER TABLE "teaching_session" DROP CONSTRAINT "FK_1121c8dd24c32a8320cbcedb96c"`,
		);
		await queryRunner.query(
			`ALTER TABLE "teaching_session" DROP CONSTRAINT "FK_362d49fbf699c64c82d165451cf"`,
		);
		await queryRunner.query(
			`ALTER TABLE "teaching_session" DROP CONSTRAINT "FK_ef83f94f3deee0b05efbfcebf5f"`,
		);
		await queryRunner.query(
			`ALTER TABLE "weekly_schedule_slot" DROP CONSTRAINT "FK_5295c7b9f39f9283fa152a46d71"`,
		);
		await queryRunner.query(
			`ALTER TABLE "weekly_schedule_slot" DROP CONSTRAINT "FK_078cb24b0c5a108b4637ed6d6cb"`,
		);
		await queryRunner.query(
			`ALTER TABLE "student" DROP CONSTRAINT "FK_80d65327cbdddf7c2752f3a2e2b"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_91934e3fb8dd029eb61763329a"`,
		);
		await queryRunner.query(`DROP TABLE "teaching_session_history"`);
		await queryRunner.query(
			`DROP TYPE "public"."teaching_session_history_action_enum"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_edd6ed12347b47bae2168d695e"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_a182b69f8f76b3ff0449241b05"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_1121c8dd24c32a8320cbcedb96"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_362d49fbf699c64c82d165451c"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_ef83f94f3deee0b05efbfcebf5"`,
		);
		await queryRunner.query(`DROP TABLE "teaching_session"`);
		await queryRunner.query(
			`DROP TYPE "public"."teaching_session_priority_enum"`,
		);
		await queryRunner.query(`DROP TYPE "public"."teaching_session_type_enum"`);
		await queryRunner.query(
			`DROP TYPE "public"."teaching_session_status_enum"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_5295c7b9f39f9283fa152a46d7"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_078cb24b0c5a108b4637ed6d6c"`,
		);
		await queryRunner.query(`DROP TABLE "weekly_schedule_slot"`);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_eead2cd6e5be2c86303b786bff"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_80d65327cbdddf7c2752f3a2e2"`,
		);
		await queryRunner.query(`DROP TABLE "student"`);
	}
}
