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
import * as bcrypt from 'bcrypt';

/**
 * OWASP's current bcrypt guidance; was 10. Each increment doubles the work, so
 * this is ~4x slower to verify — a few hundred ms, paid once per login, in
 * exchange for the same factor off an offline cracking rate.
 *
 * Raising this does not invalidate existing hashes: the cost is encoded in the
 * hash itself, so old passwords keep verifying at 10 and are re-hashed at 12 the
 * next time they are set.
 */
export const BCRYPT_COST = 12;

/** `$2a$`/`$2b$`/`$2y$` + cost + salt — i.e. a value that is already hashed. */
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$/;

@Entity()
export class User extends SoftDeleteBaseEntity {
	@Column({ unique: true })
	email!: string;

	/**
	 * Optional, and for two separate reasons: the column is `nullable`, and
	 * `select: false` means it is absent from every load that does not ask for it
	 * by name (see `UsersService.findOneWithPassword`). Typing it as a plain
	 * `string` claimed a value that most reads of this entity do not have.
	 */
	@Column({ nullable: true, select: false })
	password?: string;

	@Column({ default: false })
	isActive!: boolean;

	@Column({ default: false })
	emailVerified!: boolean;

	@OneToMany(() => OAuthAccount, (oauthAccount) => oauthAccount.user)
	oauthAccounts!: OAuthAccounArray<T>;

	@OneToMany(() => Session, (session) => session.user)
	sessions!: Session[];

	@OneToMany(() => VerificationToken, (token) => token.user)
	verificationTokens!: VerificationToken[];

	/** Nullable: nothing assigns a role on signup, so most users have none. */
	@ManyToOne(() => Role, (role) => role.users, { nullable: true })
	role?: Role;

	@OneToOne(() => UserProfile, (profile) => profile.user, {
		cascade: true,
	})
	profile!: UserProfile;

	@BeforeInsert()
	@BeforeUpdate()
	async hashPassword() {
		if (!this.password) {
			return;
		}
		// @BeforeUpdate fires on every save() of a User, including saves of an
		// entity that was loaded *with* its already-hashed password. Hashing again
		// would replace the hash with a hash-of-a-hash and permanently lock the
		// account out, with nothing in the data to show what happened. Nothing in
		// the current flows does that, but it costs one line to make it impossible.
		if (BCRYPT_HASH.test(this.password)) {
			return;
		}
		this.password = await bcrypt.hash(this.password, BCRYPT_COST);
	}
}
