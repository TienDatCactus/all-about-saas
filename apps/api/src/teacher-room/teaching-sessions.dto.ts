import { IsDateString } from 'class-validator';

export class QuerySessionRangeDto {
	@IsDateString()
	from!: string;

	@IsDateString()
	to!: string;
}
