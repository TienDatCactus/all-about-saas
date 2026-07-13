import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';
@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID:
        configService.get<string>('facebook.clientId') || 'placeholder_id',
      clientSecret:
        configService.get<string>('facebook.clientSecret') ||
        'placeholder_secret',
      callbackURL:
        configService.get<string>('facebook.callbackURL') ||
        'http://localhost:8000/auth/facebook/callback',
      profileFields: [
        'id',
        'emails',
        'name',
        'displayName',
        'picture.type(large)',
      ],
      scope: ['email'],
    });
  }
  async validate(accessToken: string, refreshToken: string, profile: Profile) {
    return {
      provider: 'facebook',
      providerId: profile.id,
      email: profile.emails?.[0]?.value,
      firstName: profile.name?.givenName,
      lastName: profile.name?.familyName,
      displayName: profile.displayName,
      avatar: profile.photos?.[0]?.value,
      accessToken,
    };
  }
}
