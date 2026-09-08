import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteBaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Student } from './student.entity';
import { WeeklyScheduleSlot } from './weekly-schedule-slot.entity';

export enum SessionStatus {
	SCHEDULED = 'scheduled',
	COMPLETED = 'completed',
	CANCELLED = 'cancelled',
}

export enum SessionType {
	REGULAR = 'regular',
	MAKEUP = 'makeup',
	EXTRA = 'extra',
}

/** Manual escalation for the "chưa chốt" backlog — not computed, the teacher sets it. */
export enum SessionPriority {
	LOW = 'low',
	NORMAL = 'normal',
	HIGH = 'high',
}

@Entity()
@Index(['ownerId', 'scheduledDate'])
@Index(['slotId', 'scheduledDate'], {
	unique: true,
	where: '"slotId" IS NOT NULL',
})
export class TeachingSession extends SoftDeleteBaseEntity {
	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'ownerId' })
	owner!: User;

	@Column('uuid')
	@Index()
	ownerId!: string;

	@ManyToOne(() => Student, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'studentId' })
	student!: Student;

	@Column('uuid')
	@Index()
	studentId!: string;

	/** null = ad-hoc "buổi thêm", not generated from a slot. */
	@ManyToOne(() => WeeklyScheduleSlot, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'slotId' })
	slot?: WeeklyScheduleSlot | null;

	@Column('uuid', { nullable: true })
	@Index()
	slotId?: string | null;

	/** 'YYYY-MM-DD'. */
	@Column({ type: 'date' })
	scheduledDate!: string;

	@Column()
	startTime!: string;

	@Column()
	endTime!: string;

	@Column({ type: 'enum', enum: SessionStatus, default: SessionStatus.SCHEDULED })
	status!: SessionStatus;

	@Column({ type: 'enum', enum: SessionType, default: SessionType.REGULAR })
	type!: SessionType;

	@Column({ type: 'enum', enum: SessionPriority, default: SessionPriority.NORMAL })
	priority!: SessionPriority;

	@Column({ type: 'text', nullable: true })
	note?: string | null;

	@Column({ type: 'timestamptz', nullable: true })
	confirmedAt?: Date | null;

	/** Set once the pre-class reminder email fires, so the polling cron never re-sends it. */
	@Column({ type: 'timestamptz', nullable: true })
	preReminderSentAt?: Date | null;

	/** Set once the post-class follow-up email fires, so the polling cron never re-sends it. */
	@Column({ type: 'timestamptz', nullable: true })
	postReminderSentAt?: Date | null;
}
