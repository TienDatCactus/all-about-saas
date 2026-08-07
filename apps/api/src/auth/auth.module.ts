import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleAuthGuard } from '../common/guard/google-auth.guard';
import { LocalAuthGuard } from '../common/guard/local-auth.guard';
import { MailModule } from '../mail/mail.module';
import { MailService } from '../mail/mail.service';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { Session } from './entities/session.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { AuthService } from './services/auth.service';
import { TokensService } from './services/tokens.service';
import { GoogleStrategy } from './strategy/google.strategy';
import { JwtStrategy } from './strategy/jwt.strategy';
import { LocalStrategy } from './strategy/local.strategy';
import { User } from '../users/entities/user.entity';
import { GithubStrategy } from './strategy/github.strategy';
import { FacebookStrategy } from './strategy/facebook.strategy';

/**
 * A passport strategy registers itself with the provider's client id the
 * moment its constructor runs, so instantiating one unconditionally forces
 * every environment to carry OAuth env vars (the old `placeholder_id`
 * fallbacks). Local dev uses /auth/dev/login instead of OAuth apps, so an
 * unconfigured provider resolves to `null` and is simply never registered;
 * the matching guard turns the absence into an explicit 503.
 */
const optionalOAuthStrategy = (
	strategy: new (config: ConfigService) => object,
	configKey: 'google' | 'github' | 'facebook',
) => ({
	provide: strategy,
	inject: [ConfigService],
	useFactory: (config: ConfigService) =>
		config.get<string>(`${configKey}.clientId`) ? new strategy(config) : null,
});

@Module({
	imports: [
		TypeOrmModule.forFeature([Session, VerificationToken, User]),
		JwtModule.registerAsync({
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				secret: configService.get<string>('jwt.secret')!,
			}),
		}),
		PassportModule,
		UsersModule,
		MailModule,
	],
	controllers: [AuthController],
	providers: [
		AuthService,
		TokensService,
		LocalAuthGuard,
		LocalStrategy,
		JwtStrategy,
		GoogleAuthGuard,
		MailService,
		optionalOAuthStrategy(GoogleStrategy, 'google'),
		optionalOAuthStrategy(GithubStrategy, 'github'),
		optionalOAuthStrategy(FacebookStrategy, 'facebook'),
	],
	exports: [AuthService, TokensService],
})
export class AuthModule {}
