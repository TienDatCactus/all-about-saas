import {
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
  Body,
  Response,
  Redirect,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from '../common/guard/local-auth.guard';
import { JwtAuthGuard } from '../common/guard/jwt-auth.guard';
import { GoogleAuthGuard } from '../common/guard/google-auth.guard';
import { Public } from '../common/decorator/is-public.decorator';
import { LoginDto } from './dto/sign-in.dto';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleAuth() {
    // Triggers the Passport Google authentication flow
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleAuthRedirect(@Request() req, @Response() res) {
    const user = await this.authService.oauthAccess(
      'google',
      req.user.id,
      req.user.email,
      req.user,
    );
    res.cookie('session', user.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });

    return res.redirect(
      this.configService.get<string>('frontendUrl') || 'http://localhost:3000',
    );
  }
}
