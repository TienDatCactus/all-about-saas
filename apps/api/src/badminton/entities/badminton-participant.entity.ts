import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteBaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { BadmintonSession } from './badminton-session.entity';

export enum ParticipantGender {
	MALE = 'male',
	FEMALE = 'female',
}

/**
 * One attendee of one {@link BadmintonSession}. Identity is EITHER a linked app
 * user ({@link userId}) OR a free-text guest — in both cases {@link name} holds
 * the display name (a snapshot for linked users, so it survives account deletion).
 *
 * The partial unique index blocks the same account appearing twice in a session,
 * while still allowing many free-text (null-userId) rows.
 */
@Entity()
@Index(['sessionId', 'userId'], { unique: true, where: '"userId" IS NOT NULL' })
export class BadmintonParticipant extends SoftDeleteBaseEntity {
	@ManyToOne(() => BadmintonSession, (s) => s.participants, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'sessionId' })
	session!: BadmintonSession;

	@Column('uuid')
	@Index()
	sessionId!: string;

	/** Linked app user, if this participant is a registered account. Optional. */
	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'userId' })
	user?: User;

	/** Nullable, not just optional — see the note on {@link paidAt}. Un-linking a
	 *  participant from an account has to write an explicit SQL NULL. */
	@Column('uuid', { nullable: true })
	@Index()
	userId?: string | null;

	/** Display name: free-text guest name, or a snapshot of the linked user's name. */
	@Column()
	name!: string;

	/** Raw hours played this session. Drives the time-proportional court split; 0 = excluded from court. */
	@Column('float', { default: 1 })
	hoursPlayed!: number;

	/**
	 * Raw weight for the shared shuttle pot, on a 0-10 scale (10 = 100%); 0 = excluded
	 * from shuttle fee. Defaults to the nam-equivalent weight (6) rather than a neutral
	 * value — most sessions are majority-male, so this only needs touching for nữ.
	 */
	@Column('float', { default: 6 })
	shuttleWeight!: number;

	/** UI convenience only — sets the default shuttleWeight (6 nam / 4 nữ). Never read by the calc package.
	 *  Nullable, not just optional, for the same reason as {@link userId}. */
	@Column({ type: 'enum', enum: ParticipantGender, nullable: true })
	gender?: ParticipantGender | null;

	/** Host-confirmed payment status. Toggled only via the owner-scoped payment endpoint. */
	@Column({ default: false })
	paid!: boolean;

	/**
	 * Nullable (not just optional): TypeORM's save() omits `undefined` properties
	 * from the generated UPDATE entirely, so clearing this on unmark-as-paid
	 * requires writing an explicit SQL NULL via `null`, not leaving it `undefined`.
	 */
	@Column({ type: 'timestamptz', nullable: true })
	paidAt?: Date | null;
}
