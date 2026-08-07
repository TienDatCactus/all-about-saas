import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { type Profile, Strategy } from 'passport-github2';
// No fallbacks: AuthModule only constructs this when the provider is fully
// configured, so a missing env var can no longer masquerade as a live client.
@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
	constructor(private readonly configService: ConfigService) {
		super({
			clientID: configService.get<string>('github.clientId')!,
			clientSecret: configService.get<string>('github.clientSecret')!,
			callbackURL: configService.get<string>('github.callbackURL')!,
			scope: ['user:email'],
		});
	}
	async validate(accessToken: string, refreshToken: string, profile: Profile) {
		return {
			id: profile.id,
			username: profile.username,
			displayName: profile.displayName,
			// Was `profile.emails[0].value`. GitHub omits `emails` entirely when the
			// account keeps its address private, so that threw inside the strategy
			// and the callback returned a 500 instead of a usable error.
			email: profile.emails?.[0]?.value,
			avatar: profile.photos?.[0]?.value,
			accessToken,
		};
	}
}
