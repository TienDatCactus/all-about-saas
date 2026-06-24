import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UAParser } from 'ua-parser-js';
import { User } from '../../users/entities/user.entity';
import { UsersCommandService } from '../../users/services/users-command.service';
import { UsersQueryService } from '../../users/services/users-query.service';
import { UsersService } from '../../users/services/users.service';
import { PayloadDto } from '../dto/jwt-payload.dto';
import { TokensService } from './tokens.service';
import { Repository } from 'typeorm';
import { Session } from '../entities/session.entity';
import {
  VerificationToken,
  VerificationType,
} from '../entities/verification-token.entity';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { MailService } from '../../mail/mail.service';
import { SignUpDto } from '../dto/sign-up.dto';

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
  user?: Partial<User>;
}

interface CreateVTResp {
  selector: string;
  rawToken: string;
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
    @InjectRepository(VerificationToken)
    private readonly verificationTokenRepo: Repository<VerificationToken>,
    private readonly tokensService: TokensService,
    private readonly mailService: MailService,
  ) {}

  async login(
    email: string,
    password: string,
    sessionInfo: SessionInfo,
  ): Promise<LoginResp> {
    const user = await this.ucService.validateUser(email, password);
    if (!user || !user.email || !user.id) {
      throw new HttpException('Invalid email or password', 400);
    }
    if (!user.isActive) {
      throw new HttpException('User is not active', 400);
    }
    const payload: PayloadDto = {
      email: user.email,
      sub: user.id,
    };
    const refreshToken = await this.tokensService.generateRefreshToken(payload);
    const accessToken = await this.tokensService.generateAccessToken(payload);
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

  async signup(dto: SignUpDto) {
    const passwordHash = await this.tokensService.hashPassword(dto.password);

    try {
      const newUser = await this.ucService.create({
        email: dto.email,
        password: passwordHash,
      });

      const { rawToken, selector } = await this.createVerificationTokenRecord({
        userId: newUser.id,
        type: VerificationType.EMAIL_VERIFY,
      });
      const url = new URL(this.configService.get('frontendUrl') ?? '');
      url.pathname = '/verify-email';
      url.searchParams.set('token', rawToken);
      url.searchParams.set('selector', selector);
      await this.mailService.sendEmail(
        {
          subject: 'Welcome to All about Saas',
          to: newUser.email,
          headers: {
            'X-Entity-Ref-ID': newUser.id,
          },
        },
        'welcome',
        {
          url: url.toString(),
        },
      );
    } catch (e: any) {
      if (e.code === '23505') {
        throw new HttpException('Email already in use', 400);
      }

      throw e;
    }
  }

  async oauthAccess(
    provider: string,
    providerId: string,
    email: string,
    profileData: any,
    sessionInfo: SessionInfo,
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
    const accessToken = await this.tokensService.generateAccessToken(payload);
    const refreshToken = await this.tokensService.generateRefreshToken(payload);

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
      const payload = await this.tokensService.verifyRefreshToken(refreshToken);
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
        await this.tokensService.generateAccessToken(payload);
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

  async resendVerificationEmail(selector: string): Promise<void> {
    const token = await this.verificationTokenRepo.findOne({
      where: { selector },
      relations: ['user'],
    });
    if (!token) {
      throw new HttpException('Verification token not found', 404);
    }
    const user = token.user;
    if (!user) {
      throw new HttpException('User not found', 404);
    }
    if (user.emailVerified === true) {
      throw new HttpException('Email already verified', 400);
    }
    const { rawToken, selector: newSelector } = await this.createVerificationTokenRecord({
      userId: user.id,
      type: VerificationType.EMAIL_VERIFY,
    });
    const url = new URL(this.configService.get('frontendUrl') ?? '');
    url.pathname = '/verify-email';
    url.searchParams.set('token', rawToken);
    url.searchParams.set('selector', newSelector);
    await this.mailService.sendEmail(
      {
        subject: 'Resend Verification Email',
        to: user.email,
        headers: {
          'X-Entity-Ref-ID': user.id,
        },
      },
      'welcome',
      {
        url: url.toString(),
      },
    );
  }

  // ==========================================
  // Verification Tokens Record Management
  // ==========================================

  async createVerificationTokenRecord({
    userId,
    type,
    expiresInMs = 3600000, // default 1 hour
  }: {
    userId: string;
    type: VerificationType;
    expiresInMs?: number;
  }): Promise<CreateVTResp> {
    const user = await this.uqService.findOneBy({ id: userId });
    if (!user) {
      throw new HttpException('User not found', 404);
    }

    const { rawToken, tokenHash } =
      await this.tokensService.createVerificationToken();
    const selector = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + expiresInMs);

    const record = this.verificationTokenRepo.create({
      user,
      selector,
      tokenHash,
      type,
      expiresAt,
    });
    await this.verificationTokenRepo.save(record);

    return {
      selector,
      rawToken,
    };
  }

  async verifyVerificationTokenRecord(
    selector: string,
    token: string,
    type: VerificationType,
  ): Promise<User | null> {
    const record = await this.verificationTokenRepo.findOne({
      where: { selector, type },
      relations: ['user'], // lấy kèm thông tin user
    });

    if (!record) {
      return null;
    }
    if (record.user.emailVerified === true) {
      throw new HttpException('Email already verified.', 400);
    }
    if (record.usedAt || record.expiresAt < new Date()) {
      return null;
    }

    const isValid = await this.tokensService.verifyToken(
      token,
      record.tokenHash,
    );
    if (isValid) {
      record.usedAt = new Date();
      await this.verificationTokenRepo.save(record);
      return record.user; // Trả về user thay vì true
    }

    return null;
  }
}
