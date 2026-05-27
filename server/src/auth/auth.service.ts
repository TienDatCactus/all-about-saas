import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/sign-in.dto';
import { PayloadDto } from './dto/jwt-payload.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}
  async generateToken(payload: PayloadDto): Promise<string> {
    return await this.jwtService.signAsync(payload);
  }
  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneBy({ email });
    if (user) {
      const isMatch = await bcrypt.compare(pass, user.password);
      if (isMatch) {
        const { password, ...result } = user;
        return result;
      }
    }
    return null;
  }
  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload: PayloadDto = {
      email: user.email,
      sub: user.id,
    };
    return await this.generateToken(payload);
  }
  async signup(email: string) {
    const existingUser = await this.usersService.findOneBy({ email });
    if (existingUser) {
      throw new UnauthorizedException('Email already in use');
    }
    return await this.usersService.create({
      email,
    });
  }
  async hashPassword(password: string): Promise<string> {
    const saltOrRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltOrRounds);
    return hashedPassword;
  }
  async oauthAccess(
    provider: string,
    providerId: string,
    email: string,
    profileData: any,
  ) {
    const user = await this.usersService.findOrCreateOAuthUser(
      provider,
      providerId,
      email,
      profileData,
    );
    if (!user) {
      const token = await this.signup(email);
      return {
        user: email,
        accessToken: await this.login(email, token.password),
      };
    }
    const token = await this.login(user.email, user.password);
    return {
      user,
      accessToken: token,
    };
  }
}
