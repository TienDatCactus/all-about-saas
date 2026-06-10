import { Injectable } from '@nestjs/common';
import { PayloadDto } from '../dto/jwt-payload.dto';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TokensUtils {
  constructor(private readonly jwtService: JwtService) {}
  async generateAccessToken(payload: PayloadDto): Promise<string> {
    return await this.jwtService.signAsync(payload, {
      expiresIn: '1h',
    });
  }
  async generateRefreshToken(payload: PayloadDto): Promise<string> {
    return await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });
  }
  async hashPassword(password: string): Promise<string> {
    const saltOrRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltOrRounds);
    return hashedPassword;
  }
}
