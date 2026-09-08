import {
	IsDateString,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
} from 'class-validator';

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
