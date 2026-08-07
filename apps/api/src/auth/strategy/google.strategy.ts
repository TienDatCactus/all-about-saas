import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
// Direct dependency on the module that actually runs. `passport-google-oauth`
// was only ever a wrapper re-exporting this class as `OAuth2Strategy`, and its
// @types describe the wrapper's pre-2.0 API — no VerifyCallback, no `scope`
// option — so typing against it meant typing against an API that isn't there.
import {
	Strategy,
	type Profile,
	type VerifyCallback,
} from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

// No fallbacks: AuthModule only constructs this when the provider is fully
// configured, so a missing env var can no longer masquerade as a live client.
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
	constructor(private readonly configService: ConfigService) {
		super({
			clientID: configService.get<string>('google.clientId')!,
			clientSecret: configService.get<string>('google.clientSecret')!,
			callbackURL: configService.get<string>('google.callbackURL')!,
			scope: ['email', 'profile'],
		});
	}

	async validate(
		accessToken: string,
		refreshToken: string,
		profile: Profile,
		done: VerifyCallback,
	): Promise<void> {
		const { name, emails, photos } = profile;
		const user = {
			id: profile.id,
			// Was `emails[0].value` on an implicitly-`any` profile. `emails` is
			// optional on a passport profile, so a Google account that releases no
			// address threw `Cannot read properties of undefined (reading '0')`
			// inside the strategy — a 500 on the callback, not a login failure.
			// oauthAccess() now rejects the missing address explicitly.
			email: emails?.[0]?.value,
			firstName: name?.givenName,
			lastName: name?.familyName,
			picture: photos?.[0]?.value,
			accessToken,
		};
		done(null, user);
	}
}
