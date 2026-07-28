import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BadmintonParticipant } from './badminton-participant.entity';
import type { ComputedSnapshot } from '../types/computed-snapshot';

/**
 * A single badminton money-split session, owned by the authenticated organizer.
 * Only the owner may edit; anyone with {@link shareToken} may read the frozen result.
 */
@Entity()
export class BadmintonSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column('uuid')
  @Index()
  ownerId: string;

  /** Date the session was played, 'YYYY-MM-DD'. */
  @Column({ type: 'date' })
  playedOn: string;

  @Column({ nullable: true })
  title?: string;

  /** Court cost, VND (no decimals). */
  @Column('int')
  courtCost: number;

  /** Price per shuttle, VND. Total shuttle cost is DERIVED: unitPrice * totalShuttleCount. */
  @Column('int')
  shuttleUnitPrice: number;

  /** Total shuttles used in the session (shared pot). Drives shuttleCost = unitPrice * this. */
  @Column('int', { default: 0 })
  totalShuttleCount: number;

  /** Unguessable token for the public read-only share link. */
  @Index({ unique: true })
  @Column()
  shareToken: string;

  /** Frozen split result, recomputed on every save; served to the share link. */
  @Column({ type: 'jsonb', nullable: true })
  computed?: ComputedSnapshot;

  @OneToMany(() => BadmintonParticipant, (p) => p.session, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  participants: BadmintonParticipant[];

  @DeleteDateColumn()
  deletedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
