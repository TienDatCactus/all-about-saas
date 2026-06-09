import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Users } from '../users/entities/users.entity';
import { UsersService } from '../users/services/users.service';
import { PayloadDto } from './dto/jwt-payload.dto';
import { UsersQueryService } from '../users/services/users-query.service';
import { UsersCommandService } from '../users/services/users-command.service';
@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly uqService: UsersQueryService,
    private readonly ucService: UsersCommandService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}
  async generateToken(payload: PayloadDto): Promise<string> {
    return await this.jwtService.signAsync(payload);
  }
  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.uqService.findOneBy({ email });
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
      throw new UnauthorizedException('Not a valid user');
    }
    const payload: PayloadDto = {
      email: user.email,
      sub: user.id,
    };
    return await this.generateToken(payload);
  }
  async signup(email: string, password?: string): Promise<Users> {
    const existingUser = await this.uqService.findOneBy({ email });
    if (existingUser) {
      throw new UnauthorizedException('Email already in use');
    }
    const passwordHash = password
      ? await this.hashPassword(password)
      : await this.hashPassword(
          this.configService.get<string>('basePassword')!,
        ); // Generate a random password if not provided
    const newUser = await this.ucService.create({
      email,
      password: passwordHash,
    });
    return newUser;
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
    Logger.log(`OAuth access for provider: ${provider}, email: ${email}`);
    let user = await this.usersService.findOrCreateOAuthUser(
      provider,
      providerId,
      email,
      profileData,
    );
    if (!user) {
      Logger.debug('this 1');
      const newUser = await this.signup(email);
      Logger.debug(
        `Created new user from OAuth data: ${JSON.stringify(newUser)}`,
      );
      if (newUser) {
        user = newUser;
      }
      throw new UnauthorizedException('Failed to create user from OAuth data');
    }
    const payload: PayloadDto = { email: user.email, sub: user.id };
    const accessToken = await this.generateToken(payload);
    return {
      user,
      accessToken,
    };
  }
}
