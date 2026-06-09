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
import { SignUpDto } from './dto/sign-up.dto';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Public()
  @Post('signup')
  async signup(@Body() body: SignUpDto) {
    return this.authService.signup(body.email, body.password);
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
    const authResult = await this.authService.oauthAccess(
      'google',
      req.user.id,
      req.user.email,
      req.user,
    );
    const frontendUrl =
      this.configService.get<string>('frontendUrl') || 'http://localhost:3000';
    const redirectUrl = new URL('/login', frontendUrl);
    redirectUrl.searchParams.set('accessToken', authResult.accessToken);
    redirectUrl.searchParams.set('provider', 'google');

    return res.redirect(redirectUrl.toString());
  }
}
