import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalStrategy } from '../common/guard/local-auth.guard';
import { JwtAuthGuard } from '../common/guard/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalStrategy)
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  logout(@Request() req) {
    return req.logout();
  }

  @UseGuards(LocalStrategy)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }
}
