import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum ChatMessageRole {
	USER = 'user',
	ASSISTANT = 'assistant',
	TOOL = 'tool',
}

export enum ToolCallState {
	NONE = 'none',
	PENDING = 'pending',
	CONFIRMED = 'confirmed',
	REJECTED = 'rejected',
	EXECUTED = 'executed',
}

/** One turn of a chat thread. A `pending` write proposal lives entirely on
 *  this row — there is no separate confirmation table. */
@Entity()
export class ChatMessage extends BaseEntity {
	@Column('uuid')
	@Index()
	threadId!: string;

	@Column('uuid')
	@Index()
	userId!: string;

	@Column({ type: 'enum', enum: ChatMessageRole })
	role!: ChatMessageRole;

	@Column('text')
	content!: string;

	/** `{ name, args }` for the tool the model proposed calling. Set only
	 *  alongside `toolCallState !== 'none'`. */
	@Column({ type: 'jsonb', nullable: true })
	toolCall?: { name: string; args: Record<string, unknown> } | null;

	@Column({ type: 'enum', enum: ToolCallState, default: ToolCallState.NONE })
	toolCallState!: ToolCallState;
}
