import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatMessage1788841013878 implements MigrationInterface {
	name = 'CreateChatMessage1788841013878';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "public"."chat_message_role_enum" AS ENUM('user', 'assistant', 'tool')`,
		);
		await queryRunner.query(
			`CREATE TYPE "public"."chat_message_toolcallstate_enum" AS ENUM('none', 'pending', 'confirmed', 'rejected', 'executed')`,
		);
		await queryRunner.query(
			`CREATE TABLE "chat_message" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "threadId" uuid NOT NULL, "userId" uuid NOT NULL, "role" "public"."chat_message_role_enum" NOT NULL, "content" text NOT NULL, "toolCall" jsonb, "toolCallState" "public"."chat_message_toolcallstate_enum" NOT NULL DEFAULT 'none', CONSTRAINT "PK_3cc0d85193aade457d3077dd06b" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_29a25859be64b1df2a84fb5145" ON "chat_message" ("threadId") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a44ec486210e6f8b4591776d6f" ON "chat_message" ("userId") `,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP INDEX "public"."IDX_a44ec486210e6f8b4591776d6f"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_29a25859be64b1df2a84fb5145"`,
		);
		await queryRunner.query(`DROP TABLE "chat_message"`);
		await queryRunner.query(
			`DROP TYPE "public"."chat_message_toolcallstate_enum"`,
		);
		await queryRunner.query(`DROP TYPE "public"."chat_message_role_enum"`);
	}
}
