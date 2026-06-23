import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Public } from '../common/decorator/is-public.decorator';
import { GoogleAuthGuard } from '../common/guard/google-auth.guard';
import { JwtAuthGuard } from '../common/guard/jwt-auth.guard';
import { AuthService } from './services/auth.service';
import { LoginDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import {
  VerificationToken,
  VerificationType,
} from './entities/verification-token.entity';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UsersCommandService } from '../users/services/users-command.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly ucService: UsersCommandService,
  ) {}
  @Public()
  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res,
    @Req() req,
  ) {
    const sessionInfo = this.authService.getSessionInfo(req);
    const resp = await this.authService.login(
      body.email,
      body.password,
      sessionInfo,
    );
    res.cookie('refresh_token', resp.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: this.configService.get('jwt.refreshExpiresIn'),
    });
    return {
      accessToken: resp.accessToken,
      message: 'Login successful',
    };
  }

  @Public()
  @Post('signup')
  async signup(@Body() body: SignUpDto) {
    await this.authService.signup(body.email, body.password);
    return {
      message: 'User registered successfully',
    };
  }

  // apps/api/src/auth/auth.controller.ts

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() body: VerifyEmailDto) {
    const user = await this.authService.verifyVerificationTokenRecord(
      body.selector,
      body.token,
      VerificationType.EMAIL_VERIFY,
    );

    if (!user) {
      throw new BadRequestException(
        'Either invalid or expired verification token.',
      );
    }

    await this.ucService.update(
      {
        emailVerified: true,
        isActive: true,
      },
      {
        id: user.id,
      },
    );

    return {
      message: 'Email verified successfully.',
    };
  }

  @Public()
  @Post('logout')
  async logout(
    @Req() req,
    @Res({
      passthrough: true,
    })
    res,
  ) {
    const refreshToken = req.cookies['refresh_token'];
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
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
    const sessionInfo = this.authService.getSessionInfo(req);
    const result = await this.authService.oauthAccess(
      'google',
      req.user.id,
      req.user.email,
      req.user,
      sessionInfo,
    );

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: this.configService.get('jwt.refreshExpiresIn'),
    });
    const frontendUrl = this.configService.get<string>('frontendUrl')!;
    return res.redirect(frontendUrl);
  }
}
