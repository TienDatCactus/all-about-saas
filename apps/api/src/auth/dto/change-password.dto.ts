import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Changing the password of the currently authenticated user. The account comes
 * from the JWT, never from the body — the previous shared DTO carried an
 * optional `email`, which the endpoint would have been happy to accept.
 */
export class ChangePasswordDto {
	@IsString()
	@IsNotEmpty()
	password: string;
}
