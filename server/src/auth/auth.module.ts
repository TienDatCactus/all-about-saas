import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { jwtConstants } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from '../common/guard/local-auth.guard';
import { JwtStrategy } from './strategy/jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: jwtConstants.options,
    }),
    PassportModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
