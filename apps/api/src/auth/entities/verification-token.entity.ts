import { Column, Entity, ManyToOne } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BaseEntity } from '../../common/entities/base.entity';
export enum VerificationType {
	EMAIL_VERIFY = 'EMAIL_VERIFY',
	PASSWORD_RESET = 'PASSWORD_RESET',
	CHANGE_EMAIL = 'CHANGE_EMAIL',
	MAGIC_LINK = 'MAGIC_LINK',
}
@Entity()
export class VerificationToken extends BaseEntity {
	@Column({ unique: true })
	selector!: string; //uuid

	@ManyToOne(() => User)
	user!: User;

	@Column()
	tokenHash!: string;

	@Column({
		type: 'enum',
		enum: VerificationType,
	})
	type!: VerificationType;

	@Column()
	expiresAt!: Date;

	@Column({ nullable: true })
	usedAt?: Date;
}
