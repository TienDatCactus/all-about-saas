import { PartialType } from '@nestjs/swagger';
import { CreateBadmintonSessionDto } from './create-badminton-session.dto';

/**
 * Update replaces the full session, participants included: any participant omitted
 * from the array is removed (orphanedRowAction: 'delete' on the entity relation).
 */
export class UpdateBadmintonSessionDto extends PartialType(
	CreateBadmintonSessionDto,
) {}
