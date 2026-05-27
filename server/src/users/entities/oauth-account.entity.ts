import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.entity';

@Entity()
export class OAuthAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  provider: string; // e.g. 'google', 'github', 'discord'

  @Column()
  providerUserId: string; // The user ID returned by the OAuth provider (Google sub, GitHub id, etc.)

  @Column({ type: 'jsonb', nullable: true })
  profileData: Record<string, any>; // Store raw profile payload from provider

  @ManyToOne(() => User, (user) => user.oauthAccounts, { onDelete: 'CASCADE' })
  user: User;
}
