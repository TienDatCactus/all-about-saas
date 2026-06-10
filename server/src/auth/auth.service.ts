import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Users } from '../users/entities/users.entity';
import { UsersService } from '../users/services/users.service';
import { PayloadDto } from './dto/jwt-payload.dto';
import { UsersQueryService } from '../users/services/users-query.service';
import { UsersCommandService } from '../users/services/users-command.service';
import { TokensUtils } from './utils/tokens.utils';
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly uqService: UsersQueryService,
    private readonly ucService: UsersCommandService,
    private readonly configService: ConfigService,
    private readonly tokensUtils: TokensUtils,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.ucService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const payload: PayloadDto = {
      email: user.email,
      sub: user.id,
    };
    const refreshToken = await this.tokensUtils.generateRefreshToken(payload);
    const accessToken = await this.tokensUtils.generateAccessToken(payload);
    return {
      accessToken,
      refreshToken,
    };
  }

  async signup(
    email: string,
    password?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const existingUser = await this.uqService.findOneBy({ email });
    if (existingUser) {
      throw new UnauthorizedException('Email already in use');
    }
    const passwordHash = password
      ? await this.tokensUtils.hashPassword(password)
      : await this.tokensUtils.hashPassword(
          this.configService.get<string>('basePassword')!,
        );
    const newUser = await this.ucService.create({
      email,
      password: passwordHash,
    });
    const payload: PayloadDto = {
      email: newUser.email,
      sub: newUser.id,
    };
    return {
      accessToken: await this.tokensUtils.generateAccessToken(payload),
      refreshToken: await this.tokensUtils.generateRefreshToken(payload),
    };
  }

  async oauthAccess(
    provider: string,
    providerId: string,
    email: string,
    profileData: any,
  ): Promise<{
    user: Users;
    accessToken: string;
    refreshToken: string;
  }> {
    const { accessToken: ssoAccessToken, ...profile } = profileData;
    const user = await this.usersService.findOrCreateOAuthUser(
      provider,
      providerId,
      email,
      profile,
    );
    if (!user) {
      throw new UnauthorizedException('Failed to create user from OAuth data');
    }
    const payload: PayloadDto = { email: user.email, sub: user.id };
    const accessToken = await this.tokensUtils.generateAccessToken(payload);
    const refreshToken = await this.tokensUtils.generateRefreshToken(payload);
    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string): Promise<string> {
    try {
      const payload = await this.tokensUtils.verifyRefreshToken(refreshToken);
      const newAccessToken =
        await this.tokensUtils.generateAccessToken(payload);
      return newAccessToken;
    } catch (error) {
      console.error(error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
