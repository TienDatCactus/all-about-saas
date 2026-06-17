import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UAParser } from 'ua-parser-js';
import { User } from '../users/entities/user.entity';
import { UsersCommandService } from '../users/services/users-command.service';
import { UsersQueryService } from '../users/services/users-query.service';
import { UsersService } from '../users/services/users.service';
import { PayloadDto } from './dto/jwt-payload.dto';
import { TokensUtils } from './utils/tokens.utils';
import { Repository } from 'typeorm';
import { Session } from './entities/session.entity';
import { InjectRepository } from '@nestjs/typeorm';

interface SessionInfo {
  ipAddress: string;
  userAgent: string;
  browser?: string;
  os?: string;
  deviceName?: string;
}

interface LoginResp {
  accessToken: string;
  refreshToken: string;
  user?: User;
}
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly uqService: UsersQueryService,
    private readonly ucService: UsersCommandService,
    private readonly configService: ConfigService,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    private readonly tokensUtils: TokensUtils,
  ) {}

  async login(
    email: string,
    password: string,
    sessionInfo: SessionInfo,
  ): Promise<LoginResp> {
    const user = await this.ucService.validateUser(email, password);
    if (!user) {
      throw new HttpException('Invalid email or password', 400);
    }
    const payload: PayloadDto = {
      email: user.email,
      sub: user.id,
    };
    const refreshToken = await this.tokensUtils.generateRefreshToken(payload);
    const accessToken = await this.tokensUtils.generateAccessToken(payload);
    await this.sessionRepo.save(
      this.sessionRepo.create({
        user: user,
        refreshToken: refreshToken,
        deviceName: sessionInfo.deviceName,
        ipAddress: sessionInfo.ipAddress,
        userAgent: sessionInfo.userAgent,
        expiresAt: new Date(
          Date.now() + +this.configService.get('jwt.refreshExpiresIn'),
        ),
      }),
    );
    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  async signup(
    email: string,
    password?: string,
  ): Promise<Pick<LoginResp, 'refreshToken' | 'accessToken'>> {
    const existingUser = await this.uqService.findOneBy({ email });
    if (existingUser) {
      throw new HttpException('Email already in use', 400);
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
    sessionInfo: SessionInfo, // SỬA: Nhận thêm thông tin session (IP, User Agent)
  ): Promise<LoginResp> {
    const { accessToken: ssoAccessToken, ...profile } = profileData;
    const user = await this.usersService.findOrCreateOAuthUser(
      provider,
      providerId,
      email,
      profile,
    );
    if (!user) {
      throw new HttpException('Failed to create user from OAuth data', 400);
    }

    const payload: PayloadDto = { email: user.email, sub: user.id };
    const accessToken = await this.tokensUtils.generateAccessToken(payload);
    const refreshToken = await this.tokensUtils.generateRefreshToken(payload);

    const session = this.sessionRepo.create({
      user: user,
      refreshToken: refreshToken,
      deviceName: sessionInfo.deviceName,
      ipAddress: sessionInfo.ipAddress,
      userAgent: sessionInfo.userAgent,
      expiresAt: new Date(
        Date.now() + +this.configService.get('jwt.refreshExpiresIn'),
      ),
    });
    await this.sessionRepo.save(session);

    return {
      user,
      accessToken,
      refreshToken,
    };
  }
  async refresh(refreshToken: string): Promise<string> {
    try {
      const payload = await this.tokensUtils.verifyRefreshToken(refreshToken);
      const session = await this.sessionRepo.findOne({
        where: {
          refreshToken,
          user: {
            id: payload.sub,
          },
        },
      });
      if (!session || !!session.revokedAt || session.expiresAt < new Date()) {
        throw new HttpException('Session expired or revoked', 401);
      }
      const newAccessToken =
        await this.tokensUtils.generateAccessToken(payload);
      return newAccessToken;
    } catch (error) {
      throw new HttpException('Invalid refresh token', 401);
    }
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: {
        refreshToken,
      },
    });
    if (session) {
      session.revokedAt = new Date();
      await this.sessionRepo.save(session);
    }
  }

  getSessionInfo(req: Request): SessionInfo {
    const userAgent = req.headers['user-agent'] ?? '';
    const parser = new UAParser(userAgent);

    return {
      ipAddress: req.ip || req.headers['forwarded'] || '',
      userAgent,
      deviceName: `${parser.getBrowser().name} on ${parser.getOS().name}`,
    };
  }
}
