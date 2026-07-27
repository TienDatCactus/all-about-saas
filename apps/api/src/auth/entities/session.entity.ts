import { Column, Entity, ManyToOne } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity()
export class Session extends BaseEntity {
	@ManyToOne(() => User, {
		onDelete: 'CASCADE',
	})
	user: User;

	@Column({ select: false })
	refreshToken: string;

	@Column()
	deviceName: string;

	@Column()
	userAgent: string;

	@Column()
	ipAddress: string;

	@Column({ nullable: true })
	revokedAt?: Date;

	@Column()
	expiresAt: Date;
}
