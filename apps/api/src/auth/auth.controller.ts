import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import type { Response } from "express";
import { Repository } from "typeorm";
import { Public } from "../common/decorator/is-public.decorator";
import { GoogleAuthGuard } from "../common/guard/google-auth.guard";
import { JwtAuthGuard } from "../common/guard/jwt-auth.guard";
import { UsersCommandService } from "../users/services/users-command.service";
import { SendVerificationEmailDto } from "./dto/send-verification-email.dto";
import { LoginDto } from "./dto/sign-in.dto";
import { SignUpDto } from "./dto/sign-up.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { VerificationToken, VerificationType } from "./entities/verification-token.entity";
import { AuthService, OAUTH_PROVIDERS } from "./services/auth.service";
import { ChangePasswordDto } from "./dto/change-password.dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly ucService: UsersCommandService,
    @InjectRepository(VerificationToken)
    private readonly verificationTokenRepo: Repository<VerificationToken>,
  ) {}
  @Public()
  @Post("login")
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res, @Req() req) {
    const sessionInfo = this.authService.getSessionInfo(req);
    const resp = await this.authService.login(body.email, body.password, sessionInfo);
    res.cookie("refresh_token", resp.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: this.configService.get("jwt.refreshExpiresIn"),
    });
    return {
      accessToken: resp.accessToken,
      message: "Login successful",
    };
  }

  @Public()
  @Post("signup")
  async signup(@Body() body: SignUpDto) {
    await this.authService.signup({
      email: body.email,
      password: body.password,
    });
    return {
      message: "User registered successfully",
    };
  }

  @Public()
  @Post("verify-email")
  async verifyEmail(@Body() body: VerifyEmailDto) {
    if (!body.selector || !body.token) {
      throw new BadRequestException("Selector and token are required.");
    }
    const user = await this.authService.verifyVerificationTokenRecord(
      body.selector,
      body.token,
      body.type,
      body.type !== VerificationType.PASSWORD_RESET,
    );
    if (!user) {
      throw new BadRequestException("Either invalid or expired verification token.");
    }
    if (body.type === VerificationType.EMAIL_VERIFY) {
      await this.ucService.update(
        {
          emailVerified: true,
          isActive: true,
        },
        {
          id: user.id,
        },
      );
    }
    return {
      message: "Email verified successfully.",
    };
  }

  @Public()
  @Post("send-verification-email")
  async sendVerificationEmail(
    @Body()
    body: SendVerificationEmailDto,
  ) {
    if (body.type === VerificationType.PASSWORD_RESET) {
      if (body.selector) {
        await this.authService.resendResetPasswordEmail(body.selector);
      } else if (body.email) {
        await this.authService.sendResetPasswordEmail(body.email);
      } else {
        throw new BadRequestException("Email or selector is required for password reset.");
      }
    } else if (body.type === "EMAIL_VERIFY") {
      if (!body.selector) {
        throw new BadRequestException("Selector is required for email verification.");
      }
      await this.authService.resendVerificationEmail(body.selector);
    } else {
      throw new BadRequestException("Invalid verification type.");
    }
    return {
      message: "Verification email sent successfully.",
    };
  }

  @Public()
  @Post("logout")
  async logout(
    @Req() req,
    @Res({
      passthrough: true,
    })
    res,
  ) {
    const refreshToken = req.cookies["refresh_token"];
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    res.clearCookie("refresh_token");
    return { message: "Logged out successfully" };
  }

  @Public()
  @Post("change-password")
  async changePassword(@Body() body: ChangePasswordDto) {
    await this.authService.changePassword(body);
    return { message: "Password changed successfully" };
  }

  @UseGuards(JwtAuthGuard)
  @Post("reset-password")
  async resetPassword(@Body() body: Pick<ChangePasswordDto, "password">, @Req() req) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException("User not authenticated");
    }
    await this.authService.resetPassword({
      password: body.password,
      email: req.user.email,
    });
    return { message: "Password reset successfully" };
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get("google")
  googleAuth() {
    // Triggers the Passport Google authentication flow
  }

  @Public()
  @Post("refresh")
  async refresh(@Req() req) {
    const refreshToken = req.cookies["refresh_token"];
    if (!refreshToken) {
      throw new Error("Refresh token not found");
    }
    const newAccessToken = await this.authService.refresh(refreshToken);
    return {
      accessToken: newAccessToken,
      message: "Token refreshed successfully",
    };
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get("google/callback")
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    const sessionInfo = this.authService.getSessionInfo(req);
    const result = await this.authService.oauthAccess(
      OAUTH_PROVIDERS.GOOGLE,
      req.user.id,
      req.user.email,
      req.user,
      sessionInfo,
    );

    res.cookie("refresh_token", result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: this.configService.get("jwt.refreshExpiresIn"),
    });
    const frontendUrl = this.configService.get<string>("frontendUrl")!;
    return res.redirect(frontendUrl);
  }
}
