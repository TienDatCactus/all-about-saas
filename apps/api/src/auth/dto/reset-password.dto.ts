import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import {
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
} from './password.constraints';

/**
 * Completing a forgotten-password reset: proof of identity is the emailed
 * selector + token pair, so all three fields are mandatory. They used to be
 * `@IsOptional()` on a shared DTO with a hand-rolled `if (!selector || !token)`
 * check in the service — this moves that to the validation layer.
 */
export class ResetPasswordDto {
	@IsString()
	@IsNotEmpty()
	selector!: string;

	@IsString()
	@IsNotEmpty()
	token!: string;

	@IsString()
	@MinLength(PASSWORD_MIN_LENGTH)
	@MaxLength(PASSWORD_MAX_LENGTH)
	password!: string;
}
