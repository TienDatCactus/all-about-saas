import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';
// No fallbacks: AuthModule only constructs this when the provider is fully
// configured, so a missing env var can no longer masquerade as a live client.
@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
	constructor(private readonly configService: ConfigService) {
		super({
			clientID: configService.get<string>('facebook.clientId')!,
			clientSecret: configService.get<string>('facebook.clientSecret')!,
			callbackURL: configService.get<string>('facebook.callbackURL')!,
			profileFields: ['id', 'displayName', 'emails', 'photos'],
			scope: ['email'],
		});
	}
	async validate(accessToken: string, refreshToken: string, profile: Profile) {
		return {
			id: profile.id,
			email: profile.emails?.[0]?.value,
			firstName: profile.name?.givenName,
			lastName: profile.name?.familyName,
			displayName: profile.displayName,
			avatar: profile.photos?.[0]?.value,
			accessToken,
		};
	}
}
