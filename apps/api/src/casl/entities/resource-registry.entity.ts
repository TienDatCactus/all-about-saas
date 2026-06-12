import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { Action } from '../enums/actions.enum';

@Entity()
export class ResourceRegistry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string; // e.g. "Article", "Invoice"

  @Column({ type: 'jsonb' })
  actions: Action[]; // e.g. ["create", "read", "update", "delete"]
}
