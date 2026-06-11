import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OAuthAccount } from './oauth-account.entity';
import { Session } from '../../auth/entities/session.entity';
import { VerificationToken } from '../../auth/entities/verification-token.entity';
import { UserProfile } from './user-profile.entity';
import { Role } from '../../roles/entities/role.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  passwordHash: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  emailVerified: boolean;

  @DeleteDateColumn()
  deletedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => OAuthAccount, (oauthAccount) => oauthAccount.user)
  oauthAccounts: OAuthAccount[];

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];

  @OneToMany(() => VerificationToken, (token) => token.user)
  verificationTokens: VerificationToken[];

  @ManyToOne(() => Role, (role) => role.users, { nullable: true })
  role: Role;

  @OneToOne(() => UserProfile, (profile) => profile.user, {
    cascade: true,
  })
  profile: UserProfile;
}
