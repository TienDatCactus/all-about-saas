import { Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsDateString,
	IsInt,
	IsOptional,
	IsString,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';
import { ParticipantInputDto } from './participant-input.dto';

export class CreateBadmintonSessionDto {
	/** Date the session was played, 'YYYY-MM-DD'. */
	@IsDateString()
	playedOn!: string;

	@IsOptional()
	@IsString()
	@MaxLength(120)
	title?: string;

	/** Court cost, VND (whole number). */
	@IsInt()
	@Min(0)
	courtCost!: number;

	/** Price per shuttle, VND (whole number). Total shuttle cost = unitPrice × totalShuttleCount. */
	@IsInt()
	@Min(0)
	shuttleUnitPrice!: number;

	/** Total shuttles used in the session (shared pot). Defaults to 0. */
	@IsInt()
	@Min(0)
	totalShuttleCount!: number;

	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => ParticipantInputDto)
	participants!: ParticipantInputDto[];
}
