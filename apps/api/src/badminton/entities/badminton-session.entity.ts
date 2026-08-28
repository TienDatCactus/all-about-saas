import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BadmintonParticipant } from './badminton-participant.entity';
import type { ComputedSnapshot } from '@repo/badminton-calc';
import { SoftDeleteBaseEntity } from '../../common/entities/base.entity';
import { PaymentMethod } from '../../payment-methods/entities/payment-method.entity';

/**
 * A single badminton money-split session, owned by the authenticated organizer.
 * Only the owner may edit; anyone with {@link shareToken} may read the frozen result.
 */
@Entity()
export class BadmintonSession extends SoftDeleteBaseEntity {
	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'ownerId' })
	owner!: User;

	@Column('uuid')
	@Index()
	ownerId!: string;

	/** Date the session was played, 'YYYY-MM-DD'. */
	@Column({ type: 'date' })
	playedOn!: string;

	@Column({ nullable: true })
	title?: string;

	/** Court cost, VND (no decimals). */
	@Column('int')
	courtCost!: number;

	/** Price per shuttle, VND. Total shuttle cost is DERIVED: unitPrice * totalShuttleCount. */
	@Column('int')
	shuttleUnitPrice!: number;

	/** Total shuttles used in the session (shared pot). Drives shuttleCost = unitPrice * this. */
	@Column('int', { default: 0 })
	totalShuttleCount!: number;

	/** Unguessable token for the public read-only share link. */
	@Index({ unique: true })
	@Column()
	shareToken!: string;

	/** Reusable payment method to show on the share page. SET NULL on delete — a
	 *  session with no method just renders no payment block, never a broken FK. */
	@ManyToOne(() => PaymentMethod, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'paymentMethodId' })
	paymentMethod?: PaymentMethod;

	/**
	 * Nullable (not just optional), for the same reason as
	 * {@link BadmintonParticipant.paidAt}: save() drops `undefined` properties
	 * from the generated UPDATE, so detaching a method needs an explicit SQL NULL.
	 * `PATCH /badminton/sessions/:id` with `paymentMethodId: null` is the only way
	 * to clear it, and that value has to survive all the way to the column.
	 */
	@Column('uuid', { nullable: true })
	paymentMethodId?: string | null;

	/** Frozen split result, recomputed on every save; served to the share link. */
	@Column({ type: 'jsonb', nullable: true })
	computed?: ComputedSnapshot;

	@OneToMany(() => BadmintonParticipant, (p) => p.session, {
		cascade: true,
		orphanedRowAction: 'delete',
	})
	participants!: BadmintonParticipant[];
}
