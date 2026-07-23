import { Entity, Column } from 'typeorm';
import { Action } from '../enums/actions.enum';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity()
export class ResourceRegistry extends BaseEntity {
	@Column({ unique: true })
	name: string; // e.g. "Article", "Invoice"

	@Column({ type: 'jsonb' })
	actions: Action[]; // e.g. ["create", "read", "update", "delete"]
}
