import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { User } from './user.entity';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity()
export class UserProfile extends BaseEntity {
	@OneToOne(() => User, (user) => user.profile)
	@JoinColumn()
	user!: User;

	// Every column below is `nullable` and nothing populates them — the signup and
	// OAuth paths both create a profile with no fields set — yet all seven were
	// typed as required. Consumers were free to treat `profile.displayName` as a
	// `string` when the value is almost always SQL NULL.

	@Column({ nullable: true })
	displayName?: string;

	@Column({ nullable: true })
	avatarUrl?: string;

	@Column({ nullable: true })
	bio?: string;

	@Column({ nullable: true })
	website?: string;

	@Column({ nullable: true })
	location?: string;

	@Column({ nullable: true })
	phone?: string;

	@Column({ type: 'date', nullable: true })
	birthday?: Date;
}
