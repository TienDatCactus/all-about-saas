import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
	@IsEmail()
	email: string;

	/**
	 * No length bound on purpose. This is a *submitted* password, not a chosen
	 * one — enforcing the new 8-char minimum here would 400 every account created
	 * under the old 6-char rule, locking those users out of the one flow that
	 * would let them set a longer one.
	 */
	@IsString()
	@IsNotEmpty()
	password: string;
}
