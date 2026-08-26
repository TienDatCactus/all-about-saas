import { PartialType } from '@nestjs/swagger';
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
import { IsEnum, IsNumber, IsUUID, Max } from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ParticipantGender } from './entities/badminton-participant.entity';

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

export class ParticipantInputDto {
	/** Linked app user id, if this participant is a registered account. Omit for a free-text guest. */
	@IsOptional()
	@IsUUID()
	userId?: string;

	/** Display name — a free-text guest name, or a snapshot of the linked user's name. */
	@IsString()
	@MaxLength(120)
	name!: string;

	/** Raw hours played this session (drives the time-proportional court split). Defaults to 1. */
	@IsOptional()
	@IsNumber()
	@Min(0)
	hoursPlayed?: number;

	/** Raw weight for the shared shuttle pot, 0-10 scale (10 = 100%). Defaults to 6 (nam-equivalent). */
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(10)
	shuttleWeight?: number;

	/** UI convenience only — the web app uses this to default shuttleWeight (6 nam / 4 nữ). */
	@IsOptional()
	@IsEnum(ParticipantGender)
	gender?: ParticipantGender;
}

export class UpdateBadmintonSessionDto extends PartialType(
	CreateBadmintonSessionDto,
) {}

export class QueryBadmintonSessionDto extends PaginationQueryDto {
	@IsOptional()
	@IsString()
	@MaxLength(100)
	search?: string;

	@IsOptional()
	@IsString()
	sort?: string; // "-createdAt,email"
}
