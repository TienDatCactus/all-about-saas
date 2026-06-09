import { Injectable } from '@nestjs/common';
import { PayloadDto } from '../dto/jwt-payload.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TokensUtils {
  constructor(private readonly jwtService: JwtService) {}
  async generateToken(payload: PayloadDto): Promise<string> {
    return await this.jwtService.signAsync(payload);
  }
  async hashPassword(password: string): Promise<string> {
    const saltOrRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltOrRounds);
    return hashedPassword;
  }
}
