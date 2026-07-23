import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { User } from './user.entity';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity()
export class UserProfile extends BaseEntity {
	@OneToOne(() => User, (user) => user.profile)
	@JoinColumn()
	user: User;

	@Column({ nullable: true })
	displayName: string;

	@Column({ nullable: true })
	avatarUrl: string;

	@Column({ nullable: true })
	bio: string;

	@Column({ nullable: true })
	website: string;

	@Column({ nullable: true })
	location: string;

	@Column({ nullable: true })
	phone: string;

	@Column({ type: 'date', nullable: true })
	birthday: Date;
}
