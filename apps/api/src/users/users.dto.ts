// common/dto/pagination-query.dto.ts
import { Type } from 'class-transformer';
import {
	IsBoolean,
	IsDate,
	IsOptional,
	IsString,
	MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

export class QueryUsersDto extends PaginationQueryDto {
	@IsOptional()
	@IsString()
	@MaxLength(100)
	search?: string;

	@IsOptional()
	role?: string;

	@IsOptional()
	@Type(() => Boolean)
	@IsBoolean()
	isActive?: boolean;

	@IsOptional()
	@Type(() => Date)
	@IsDate()
	createdFrom?: Date;

	@IsOptional()
	@Type(() => Date)
	@IsDate()
	createdTo?: Date;

	@IsOptional()
	@IsString()
	sort?: string; // "-createdAt,email"
}
