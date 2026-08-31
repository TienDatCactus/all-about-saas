import { MigrationInterface, QueryRunner } from "typeorm";

export class SessionDefaultHoursPlayed1788144992609 implements MigrationInterface {
    name = 'SessionDefaultHoursPlayed1788144992609'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "badminton_session" ADD "defaultHoursPlayed" double precision NOT NULL DEFAULT '1'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "badminton_session" DROP COLUMN "defaultHoursPlayed"`);
    }

}
