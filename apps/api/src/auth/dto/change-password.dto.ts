import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import {
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
} from './password.constraints';

/**
 * Changing the password of the currently authenticated user. The account comes
 * from the JWT, never from the body — the previous shared DTO carried an
 * optional `email`, which the endpoint would have been happy to accept.
 *
 * `currentPassword` is required: being authenticated is not proof of being the
 * owner when the access token sits in localStorage.
 */
export class ChangePasswordDto {
	// No length bound — an account created under the old 6-char rule still has to
	// be able to prove ownership in order to move off it.
	@IsString()
	@IsNotEmpty()
	currentPassword!: string;

	@IsString()
	@MinLength(PASSWORD_MIN_LENGTH)
	@MaxLength(PASSWORD_MAX_LENGTH)
	newPassword!: string;
}
