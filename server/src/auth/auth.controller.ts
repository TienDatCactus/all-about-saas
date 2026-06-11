import {
  Body,
  Controller,
  Get,
  Post,
  Redirect,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorator/is-public.decorator';
import { GoogleAuthGuard } from '../common/guard/google-auth.guard';
import { JwtAuthGuard } from '../common/guard/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import type { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res) {
    const resp = await this.authService.login(body.email, body.password);
    const { refreshToken } = resp;
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
    return {
      accessToken: resp.accessToken,
      message: 'Login successful',
    };
  }

  @Public()
  @Post('signup')
  async signup(@Body() body: SignUpDto) {
    return {
      ...(await this.authService.signup(body.email, body.password)),
      message: 'User registered successfully',
    };
  }

  @Public()
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token');
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req) {
    return { user: req.user, message: 'Profile retrieved successfully' };
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleAuth() {
    // Triggers the Passport Google authentication flow
  }

  @Post('refresh')
  async refresh(@Req() req, @Res({ passthrough: true }) res) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      throw new Error('Refresh token not found');
    }
    const newAccessToken = await this.authService.refresh(refreshToken);
    return {
      accessToken: newAccessToken,
      message: 'Token refreshed successfully',
    };
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    const result = await this.authService.oauthAccess(
      'google',
      req.user.id,
      req.user.email,
      req.user,
    );

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
    const frontendUrl = this.configService.get<string>('frontendUrl')!;
    return res.redirect(frontendUrl);
  }
}
