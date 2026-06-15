import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity()
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  user: User;

  @Column()
  refreshToken: string;

  @Column()
  deviceName: string;

  @Column()
  userAgent: string;

  @Column()
  ipAddress: string;

  @Column({ nullable: true })
  revokedAt?: Date;

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
