import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum OAuthProvider {
  GOOGLE = 'google',
  GITHUB = 'github',
  DISCORD = 'discord',
}
@Entity()
@Unique(['provider', 'providerUserId'])
export class OAuthAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.oauthAccounts, {
    onDelete: 'CASCADE',
  })
  user: User;

  @Column({
    type: 'enum',
    enum: OAuthProvider,
  })
  provider: OAuthProvider;

  @Column()
  providerUserId: string;

  @Column({
    nullable: true,
  })
  providerEmail?: string;

  @Column({
    nullable: true,
  })
  providerUsername?: string;

  @Column({
    nullable: true,
  })
  avatarUrl?: string;

  @Column({
    nullable: true,
  })
  accessToken?: string;

  @Column({
    nullable: true,
  })
  refreshToken?: string;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  profileData?: Record<string, any>;

  @CreateDateColumn()
  linkedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
