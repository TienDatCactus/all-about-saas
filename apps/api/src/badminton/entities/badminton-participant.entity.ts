import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BadmintonSession } from './badminton-session.entity';

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
export class BadmintonParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => BadmintonSession, (s) => s.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sessionId' })
  session: BadmintonSession;

  @Column('uuid')
  @Index()
  sessionId: string;

  /** Linked app user, if this participant is a registered account. Optional. */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column('uuid', { nullable: true })
  @Index()
  userId?: string;

  /** Display name: free-text guest name, or a snapshot of the linked user's name. */
  @Column()
  name: string;

  /** Played fraction of the session, 0..1. Drives the time-proportional court split; 0 = excluded from court. */
  @Column('float', { default: 1 })
  courtFraction: number;

  /** Discount on the whole bill, 0..1 (e.g. 0.15). Redistributed onto other players. */
  @Column('float', { default: 0 })
  discount: number;

  /** Whole shuttles attributed to this player. 0 = excluded from shuttle fee. */
  @Column('int', { default: 0 })
  shuttleCount: number;
}
