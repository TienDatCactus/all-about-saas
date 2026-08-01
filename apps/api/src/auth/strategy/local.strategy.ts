import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import type { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
	constructor(private readonly usersService: UsersService) {
		super({
			usernameField: 'email',
			passwordField: 'password',
		});
	}

	async validate(email: string, pass: string): Promise<Partial<User>> {
		const user = await this.usersService.validateUser(email, pass);
		if (!user) {
			throw new UnauthorizedException('Invalid credentials');
		}
		return user;
	}
}
