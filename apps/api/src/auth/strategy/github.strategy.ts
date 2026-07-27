import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
	constructor(private readonly configService: ConfigService) {
		super({
			clientID:
				configService.get<string>('github.clientId') || 'placeholder_id',
			clientSecret:
				configService.get<string>('github.clientSecret') ||
				'placeholder_secret',
			callbackURL:
				configService.get<string>('github.callbackURL') ||
				'http://localhost:8000/auth/google/callback',
			scope: ['user:email'],
		});
	}
	async validate(accessToken: string, refreshToken: string, profile: any) {
		return {
			id: profile.id,
			username: profile.username,
			displayName: profile.displayName,
			email: profile.emails[0].value,
			avatar: profile.photos?.[0]?.value,
			accessToken,
		};
	}
}
