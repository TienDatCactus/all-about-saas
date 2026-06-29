import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions, JwtVerifyOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PayloadDto } from '../dto/jwt-payload.dto';

export interface GeneratedToken {
  rawToken: string;
  tokenHash: string;
}

@Injectable()
export class TokensService {
  constructor(private readonly jwtService: JwtService) {}

  // ==========================================
  // JWT Support
  // ==========================================

  async signJwt(payload: any, options?: JwtSignOptions): Promise<string> {
    return this.jwtService.signAsync(payload, options);
  }

  async verifyJwt(token: string, options?: JwtVerifyOptions): Promise<any> {
    return this.jwtService.verifyAsync(token, options);
  }

  async generateAccessToken(payload: PayloadDto): Promise<string> {
    return this.signJwt(payload, {
      expiresIn: '1h',
    });
  }

  async generateRefreshToken(payload: PayloadDto): Promise<string> {
    return this.signJwt(payload, {
      expiresIn: '7d',
    });
  }

  async verifyRefreshToken(token: string): Promise<PayloadDto> {
    return this.verifyJwt(token);
  }

  // ==========================================
  // Hashing Support
  // ==========================================

  async hashPassword(password: string): Promise<string> {
    const saltOrRounds = 10;
    return bcrypt.hash(password, saltOrRounds);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // fast hash for high-entropy tokens using sha256
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  compareToken(token: string, hash: string): boolean {
    const hashed = this.hashToken(token);
    const hashedBuf = Buffer.from(hashed, 'hex');
    const hashBuf = Buffer.from(hash, 'hex');
    if (hashedBuf.length !== hashBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(hashedBuf, hashBuf);
  }

  // Generic helpers as requested
  async hash(value: string): Promise<string> {
    return this.hashToken(value);
  }

  async compare(value: string, hash: string): Promise<boolean> {
    return this.compareToken(value, hash);
  }

  // ==========================================
  // Verification Token Factory
  // ==========================================

  async createVerificationToken(): Promise<GeneratedToken> {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = await this.hash(rawToken);
    return {
      rawToken,
      tokenHash,
    };
  }

  async verifyToken(rawToken: string, tokenHash: string): Promise<boolean> {
    return this.compare(rawToken, tokenHash);
  }
}
