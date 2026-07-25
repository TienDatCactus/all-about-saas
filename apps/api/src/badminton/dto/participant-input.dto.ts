import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ParticipantInputDto {
  /** Linked app user id, if this participant is a registered account. Omit for a free-text guest. */
  @IsOptional()
  @IsUUID()
  userId?: string;

  /** Display name — a free-text guest name, or a snapshot of the linked user's name. */
  @IsString()
  @MaxLength(120)
  name: string;

  /** Played fraction of the session, 0..1 (drives the time-proportional court split). Defaults to 1. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  courtFraction?: number;

  /** Whole-bill discount, 0..1 (e.g. 0.15). Defaults to 0. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  discount?: number;

  /** Whole shuttles attributed to this player. Defaults to 0. */
  @IsOptional()
  @IsInt()
  @Min(0)
  shuttleCount?: number;
}
