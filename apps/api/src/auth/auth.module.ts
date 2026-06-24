import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { LocalAuthGuard } from '../common/guard/local-auth.guard';
import { LocalStrategy } from './strategy/local.strategy';
import { JwtStrategy } from './strategy/jwt.strategy';
import { GoogleStrategy } from './strategy/google.strategy';
import { GoogleAuthGuard } from '../common/guard/google-auth.guard';
import { UsersModule } from '../users/users.module';
import { ConfigService } from '@nestjs/config';
import { TokensService } from './services/tokens.service';
import { Session } from './entities/session.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { MailModule } from '../mail/mail.module';
import { MailService } from '../mail/mail.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, VerificationToken]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret')!,
        signOptions: {
          expiresIn: Number(configService.get<string>('jwt.expiresIn')!),
        },
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
    GoogleStrategy,
    GoogleAuthGuard,
    MailService,
  ],
  exports: [AuthService, TokensService],
})
export class AuthModule {}
