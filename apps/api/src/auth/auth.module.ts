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

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, VerificationToken, User]),
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
