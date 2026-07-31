import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BaseEntity } from '../../common/entities/base.entity';

/**
 * One row per issued refresh token. Rotation creates a new row and revokes the
 * old one rather than mutating in place, so a token that was already spent is
 * still on record — that history is what makes reuse detection possible.
 */
@Entity()
export class Session extends BaseEntity {
	@ManyToOne(() => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'userId' })
	user!: User;

	/**
	 * Explicit FK column so revoke-all queries can filter by owner without
	 * joining (`update({ userId }, …)` cannot traverse a relation).
	 */
	@Column('uuid')
	@Index()
	userId!: string;

	/**
	 * sha256 of the refresh JWT, never the token itself. A dump of this table no
	 * longer hands out live sessions.
	 *
	 * sha256 rather than bcrypt on purpose: the token is a 256-bit-entropy JWT,
	 * not a guessable password, so there is nothing for a slow hash to protect
	 * against — and the lookup has to be indexable, which a per-row salt rules out.
	 */
	@Index({ unique: true })
	@Column({ select: false })
	refreshTokenHash!: string;

	@Column()
	deviceName!: string;

	@Column()
	userAgent!: string;

	@Column()
	ipAddress!: string;

	@Column({ nullable: true })
	revokedAt?: Date;

	/**
	 * Set when this row was retired by a normal rotation, as opposed to logout or
	 * a revoke-all. Both set {@link revokedAt}; only rotation sets this, and that
	 * is the difference between "two tabs refreshed at once" and "someone is
	 * replaying a token they kept".
	 */
	@Column({ nullable: true })
	rotatedAt?: Date;

	@Column()
	expiresAt!: Date;
}
