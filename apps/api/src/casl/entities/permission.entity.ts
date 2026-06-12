import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Role } from '../../roles/entities/role.entity';

@Entity()
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  action: string; // e.g. "read", "update"

  @Column()
  subject: string; // e.g. "Article", "User"

  @Column({ type: 'jsonb', nullable: true })
  conditions: Record<string, any>; // e.g. { "authorId": "${user.id}" }

  @Column({ default: false })
  inverted: boolean; // true = Deny, false = Allow

  @ManyToOne(() => Role, (role) => role.permissions, { onDelete: 'CASCADE' })
  role: Role;
}