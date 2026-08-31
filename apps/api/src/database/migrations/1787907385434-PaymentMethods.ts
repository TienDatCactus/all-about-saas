import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentMethods1787907385434 implements MigrationInterface {
	name = 'PaymentMethods1787907385434';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "public"."payment_method_type_enum" AS ENUM('image', 'phone')`,
		);
		await queryRunner.query(
			`CREATE TABLE "payment_method" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "type" "public"."payment_method_type_enum" NOT NULL, "label" character varying(120) NOT NULL, "imageUrl" character varying, "phoneNumber" character varying, CONSTRAINT "PK_7744c2b2dd932c9cf42f2b9bc3a" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_34a4419ef2010224d7ff600659" ON "payment_method" ("userId") `,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" ADD "paid" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" ADD "paidAt" TIMESTAMP WITH TIME ZONE`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_session" ADD "paymentMethodId" uuid`,
		);
		await queryRunner.query(
			`ALTER TABLE "payment_method" ADD CONSTRAINT "FK_34a4419ef2010224d7ff600659d" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_session" ADD CONSTRAINT "FK_3e4dc0ab9158e25ae315a122ebe" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_method"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "badminton_session" DROP CONSTRAINT "FK_3e4dc0ab9158e25ae315a122ebe"`,
		);
		await queryRunner.query(
			`ALTER TABLE "payment_method" DROP CONSTRAINT "FK_34a4419ef2010224d7ff600659d"`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_session" DROP COLUMN "paymentMethodId"`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" DROP COLUMN "paidAt"`,
		);
		await queryRunner.query(
			`ALTER TABLE "badminton_participant" DROP COLUMN "paid"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_34a4419ef2010224d7ff600659"`,
		);
		await queryRunner.query(`DROP TABLE "payment_method"`);
		await queryRunner.query(`DROP TYPE "public"."payment_method_type_enum"`);
	}
}
