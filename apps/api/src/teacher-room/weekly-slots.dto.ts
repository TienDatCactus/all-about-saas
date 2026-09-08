import { OmitType, PartialType } from '@nestjs/swagger';
import {
	IsBoolean,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	Max,
	MaxLength,
	Min,
} from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateWeeklyScheduleSlotDto {
	/** Free text — resolved to an existing or newly-created Student by name. */
	@IsString()
	@MaxLength(120)
	studentName!: string;

	@IsInt()
	@Min(0)
	@Max(6)
	dayOfWeek!: number;

	@Matches(HHMM, { message: 'startTime must be HH:mm' })
	startTime!: string;

	@Matches(HHMM, { message: 'endTime must be HH:mm' })
	endTime!: string;
}

// Renaming the student on an existing slot isn't supported — delete and
// recreate the slot instead. Keeps this DTO from carrying a field the
// service never reads.
export class UpdateWeeklyScheduleSlotDto extends PartialType(
	OmitType(CreateWeeklyScheduleSlotDto, ['studentName'] as const),
) {
	@IsOptional()
	@IsBoolean()
	active?: boolean;
}

export class QueryWeeklyScheduleSlotDto extends PaginationQueryDto {
	@IsOptional()
	@IsUUID()
	studentId?: string;
}
