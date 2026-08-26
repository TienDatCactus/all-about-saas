import { MigrationInterface, QueryRunner } from 'typeorm';

export class BadmintonHoursWeightSplit1787657246101 implements MigrationInterface {
	name = 'BadmintonHoursWeightSplit1787657246101';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" RENAME COLUMN "courtFraction" TO "hoursPlayed"`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" RENAME COLUMN "shuttleFraction" TO "shuttleWeight"`,
		);
		// Default starts at the nam-equivalent weight (6/10 = 60%), not a neutral 1 —
		// most sessions are majority-male, so assuming nam until nữ is picked matches
		// the common case instead of requiring every row to be touched.
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" ALTER COLUMN "shuttleWeight" SET DEFAULT 6`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" DROP COLUMN "discount"`,
		);
		await queryRunner.query(
			`CREATE TYPE "public"."badminton_participant_gender_enum" AS ENUM('male', 'female')`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" ADD "gender" "public"."badminton_participant_gender_enum"`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" DROP COLUMN "gender"`,
		);
		await queryRunner.query(
			`DROP TYPE "public"."badminton_participant_gender_enum"`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" ADD "discount" double precision NOT NULL DEFAULT '0'`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" ALTER COLUMN "shuttleWeight" SET DEFAULT 1`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" RENAME COLUMN "shuttleWeight" TO "shuttleFraction"`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" RENAME COLUMN "hoursPlayed" TO "courtFraction"`,
		);
	}
}
