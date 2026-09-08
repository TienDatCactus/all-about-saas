import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { TeachingSession } from './teaching-session.entity';

export enum HistoryAction {
	CREATED = 'created',
	RESCHEDULED = 'rescheduled',
	CANCELLED = 'cancelled',
	COMPLETED = 'completed',
	REOPENED = 'reopened',
	NOTE_UPDATED = 'note_updated',
	PRIORITY_CHANGED = 'priority_changed',
}

@Entity()
export class TeachingSessionHistory extends BaseEntity {
	@ManyToOne(() => TeachingSession, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'sessionId' })
	session!: TeachingSession;

	@Column('uuid')
	@Index()
	sessionId!: string;

	@Column({ type: 'enum', enum: HistoryAction })
	action!: HistoryAction;

	@Column({ type: 'date', nullable: true })
	fromDate?: string | null;

	@Column({ type: 'date', nullable: true })
	toDate?: string | null;

	@Column({ type: 'text', nullable: true })
	note?: string | null;
}
