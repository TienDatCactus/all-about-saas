import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteBaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Student } from './student.entity';

/** Recurring weekly template a session generator reads from. */
@Entity()
export class WeeklyScheduleSlot extends SoftDeleteBaseEntity {
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

	/** 0 = Sunday .. 6 = Saturday. */
	@Column('int')
	dayOfWeek!: number;

	/** 'HH:mm'. */
	@Column()
	startTime!: string;

	@Column()
	endTime!: string;

	/** false stops future generation without deleting past sessions. */
	@Column({ default: true })
	active!: boolean;
}
