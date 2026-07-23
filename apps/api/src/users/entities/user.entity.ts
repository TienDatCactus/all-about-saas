import {
	BeforeInsert,
	BeforeUpdate,
	Column,
	Entity,
	ManyToOne,
	OneToMany,
	OneToOne,
} from 'typeorm';
import { OAuthAccount } from './oauth-account.entity';
import { Session } from '../../auth/entities/session.entity';
import { VerificationToken } from '../../auth/entities/verification-token.entity';
import { UserProfile } from './user-profile.entity';
import { Role } from '../../roles/entities/role.entity';
import { SoftDeleteBaseEntity } from '../../common/entities/base.entity';
import * as bcrypt from "bcrypt"
@Entity()
export class User extends SoftDeleteBaseEntity {
	@Column({ unique: true })
	email: string;

	@Column({ nullable: true, select: false })
	password: string;

	@Column({ default: false })
	isActive: boolean;

	@Column({ default: false })
	emailVerified: boolean;

	@OneToMany(() => OAuthAccount, (oauthAccount) => oauthAccount.user)
	oauthAccounts: OAuthAccount[];

	@OneToMany(() => Session, (session) => session.user)
	sessions: Session[];

	@OneToMany(() => VerificationToken, (token) => token.user)
	verificationTokens: VerificationToken[];

	@ManyToOne(() => Role, (role) => role.users, { nullable: true })
	role: Role;

	@OneToOne(() => UserProfile, (profile) => profile.user, {
		cascade: true,
	})
	profile: UserProfile;

	@BeforeInsert()
	@BeforeUpdate()
	async hashPassword() {
		if (this.password) {
			const saltOrRounds = 10;
			this.password = await bcrypt.hash(this.password, saltOrRounds);
		}
	}
}
