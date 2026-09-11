import {
	IsDateString,
	IsEnum,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
} from 'class-validator';
import { SessionPriority } from './entities/teaching-session.entity';

export class QuerySessionRangeDto {
	@IsDateString()
	from!: string;

	@IsDateString()
	to!: string;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateAdHocSessionDto {
	@IsString()
	@MaxLength(120)
	studentName!: string;

	@IsDateString()
	scheduledDate!: string;

	@Matches(HHMM, { message: 'startTime must be HH:mm' })
	startTime!: string;

	@Matches(HHMM, { message: 'endTime must be HH:mm' })
	endTime!: string;

	@IsOptional()
	@IsString()
	@MaxLength(2000)
	note?: string;
}

export class CancelSessionDto {
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	note?: string;
}

export class CompleteSessionDto {
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	note?: string;
}

export class ReopenSessionDto {
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	note?: string;
}

export class SetPrioritySessionDto {
	@IsEnum(SessionPriority)
	priority!: SessionPriority;
}

export class RescheduleSessionDto {
	@IsDateString()
	newDate!: string;

	@IsOptional()
	@Matches(HHMM, { message: 'newStartTime must be HH:mm' })
	newStartTime?: string;

	@IsOptional()
	@Matches(HHMM, { message: 'newEndTime must be HH:mm' })
	newEndTime?: string;

	@IsOptional()
	@IsString()
	@MaxLength(2000)
	note?: string;
}
