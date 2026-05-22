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
  async validateUser(body: LoginDto) {
    const user = await this.usersService.findOneBy({ email: body.email });
    if (!user || user?.password !== body.password) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const { password, ...result } = user;
    return result;
  }
  async login(user: User) {
    const payload: PayloadDto = {
      email: user.email,
      sub: user.id,
    };
    return await this.generateToken(payload);
  }
  async hashPassword(password: string): Promise<string> {
    const saltOrRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltOrRounds);
    return hashedPassword;
  }
}
