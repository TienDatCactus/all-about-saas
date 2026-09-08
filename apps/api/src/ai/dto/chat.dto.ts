import {
	IsBoolean,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
} from 'class-validator';

export class SendChatMessageDto {
	@IsString()
	@MaxLength(2000)
	message!: string;

	@IsOptional()
	@IsUUID()
	threadId?: string;
}

export class ConfirmChatActionDto {
	@IsUUID()
	threadId!: string;

	@IsBoolean()
	approve!: boolean;
}
