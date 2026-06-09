import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Users } from './users.entity';

@Entity()
export class OAuthAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  provider: string; // e.g. 'google', 'github', 'discord'

  @Column({
    nullable: true,
  })
  providerUserId: string; // The user ID returned by the OAuth provider (Google sub, GitHub id, etc.)

  @Column({ type: 'jsonb', nullable: true })
  profileData: Record<string, any>; // Store raw profile payload from provider

  @ManyToOne(() => Users, (user) => user.oauthAccounts, { onDelete: 'CASCADE' })
  user: Users;
}
