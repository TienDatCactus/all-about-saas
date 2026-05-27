import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { OAuthAccount } from './oauth-account.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column()
  password: string;

  @Exclude()
  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Role, (role) => role.users, { nullable: true })
  role: Role;

  @OneToMany(() => OAuthAccount, (oauth) => oauth.user, { cascade: true })
  oauthAccounts: OAuthAccount[];

  @CreateDateColumn()
  createdAt: Date;
}
