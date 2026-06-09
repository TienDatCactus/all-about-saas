import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from '../common/guard/local-auth.guard';
import { LocalStrategy } from './strategy/local.strategy';
import { JwtStrategy } from './strategy/jwt.strategy';
import { GoogleStrategy } from './strategy/google.strategy';
import { GoogleAuthGuard } from '../common/guard/google-auth.guard';
import { UsersModule } from '../users/users.module';
import { ConfigService } from '@nestjs/config';
import { TokensUtils } from './utils/tokens.utils';

@Module({
  imports: [
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
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokensUtils,
    LocalAuthGuard,
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,
    GoogleAuthGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
