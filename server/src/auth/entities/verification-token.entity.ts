import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
export enum VerificationType {
  EMAIL_VERIFY = 'EMAIL_VERIFY',
  PASSWORD_RESET = 'PASSWORD_RESET',
  CHANGE_EMAIL = 'CHANGE_EMAIL',
}
@Entity()
export class VerificationToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  tokenHash: string;

  @Column({
    type: 'enum',
    enum: VerificationType,
  })
  type: VerificationType;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  usedAt?: Date;
}
