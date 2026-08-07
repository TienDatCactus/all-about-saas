import {
	BadRequestException,
	NotFoundException,
	UnauthorizedException,
	Body,
	Controller,
	Get,
	Logger,
	Post,
	Req,
	Res,
	UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../common/decorator/is-public.decorator';
import { ResponseMessage } from '../common/decorator/response-message.decorator';
import { FacebookAuthGuard } from '../common/guard/facebook-auth.guard';
import { consumeOAuthReturnTo } from '../common/guard/oauth-state';
import { GithubAuthGuard } from '../common/guard/github-auth.guard';
import { GoogleAuthGuard } from '../common/guard/google-auth.guard';
import { JwtAuthGuard } from '../common/guard/jwt-auth.guard';
import { requireUser } from '../common/request-user';
import { OAuthProvider } from '../users/entities/oauth-account.entity';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DevLoginDto } from './dto/dev-login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendVerificationEmailDto } from './dto/send-verification-email.dto';
import { LoginDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerificationType } from './entities/verification-token.entity';
import { AuthService } from './services/auth.service';

@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly configService: ConfigService,
		private readonly usersService: UsersService,
	) {}

	/**
	 * Credential-guessing surface: the global limit (10/min) is meant for normal
	 * traffic, which is far too generous for an endpoint where each request is a
	 * password attempt. There is no account lockout, so this is the only brake.
	 */
	@Throttle({ default: { limit: 5, ttl: 60_000 } })
	@Public()
	@ResponseMessage('Login successful')
	@Post('login')
	async login(
		@Body() body: LoginDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	) {
		const sessionInfo = this.authService.getSessionInfo(req);
		const result = await this.authService.login(
			body.email,
			body.password,
			sessionInfo,
		);
		this.authService.setCookie(
			res,
			result.refreshToken,
			result.refreshTokenExpiresAt,
		);
		// The envelope message comes from @ResponseMessage, so this returns data only
		// — TransformInterceptor no longer lifts a `message` out of a payload that
		// has other fields in it.
		return {
			accessToken: result.accessToken,
		};
	}

	/**
	 * Local-stand-in for the OAuth flows: mints a real session for any email,
	 * so development needs no GitHub/Google/Facebook apps and no verification
	 * mail. Guarded twice — the env flag (refused at boot in production) and a
	 * NODE_ENV check here — and hidden as a 404 rather than announced as a 403.
	 */
	@Public()
	@ResponseMessage('Dev login successful')
	@Post('dev/login')
	async devLogin(
		@Body() body: DevLoginDto,
		@Res({ passthrough: true }) res: Response,
		@Req() req: Request,
	) {
		if (
			!this.configService.get<boolean>('devAuthBypass') ||
			process.env.NODE_ENV === 'production'
		) {
			throw new NotFoundException(`Cannot POST /auth/dev/login`);
		}
		const result = await this.authService.devLogin(
			body.email,
			this.authService.getSessionInfo(req),
		);
		this.authService.setCookie(
			res,
			result.refreshToken,
			result.refreshTokenExpiresAt,
		);
		return {
			accessToken: result.accessToken,
		};
	}

	@Public()
	@Throttle({ default: { limit: 5, ttl: 60_000 } })
	@Post('signup')
	async signup(@Body() body: SignUpDto) {
		await this.authService.signup({
			email: body.email,
			password: body.password,
		});
		// Phrased to be true whether or not the address was already taken — the
		// service deliberately does not tell us which, so neither can this.
		return {
			message: 'Check your email to finish signing up.',
		};
	}

	@Public()
	@Post('verify-email')
	async verifyEmail(@Body() body: VerifyEmailDto) {
		if (!body.selector || !body.token) {
			throw new BadRequestException('Selector and token are required.');
		}
		const user = await this.authService.verifyVerificationTokenRecord(
			body.selector,
			body.token,
			body.type,
			body.type !== VerificationType.PASSWORD_RESET,
		);
		if (!user) {
			throw new BadRequestException(
				'Either invalid or expired verification token.',
			);
		}
		if (body.type === VerificationType.EMAIL_VERIFY) {
			await this.usersService.update(user.id, {
				emailVerified: true,
				isActive: true,
			});
		}
		return {
			message: 'Email verified successfully.',
		};
	}

	@Public()
	// Each call sends real mail, so this doubles as an outbound-spam brake.
	@Throttle({ default: { limit: 3, ttl: 60_000 } })
	@Post('send-verification-email')
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
				throw new BadRequestException(
					'Email or selector is required for password reset.',
				);
			}
		} else if (body.type === VerificationType.EMAIL_VERIFY) {
			if (!body.selector) {
				throw new BadRequestException(
					'Selector is required for email verification.',
				);
			}
			await this.authService.resendVerificationEmail(body.selector);
		} else {
			throw new BadRequestException('Invalid verification type.');
		}
		return {
			message: 'Verification email sent successfully.',
		};
	}

	@Public()
	@Post('logout')
	async logout(
		@Req() req: Request,
		@Res({
			passthrough: true,
		})
		res: Response,
	) {
		const refreshToken = req.cookies['refresh_token'];
		if (refreshToken) {
			await this.authService.logout(refreshToken);
		}
		res.clearCookie('refresh_token');
		return { message: 'Logged out successfully' };
	}

	/**
	 * Finishes a forgotten-password reset with the emailed selector + token.
	 * Public by design; the token is the credential, so it needs a rate limit.
	 */
	@Public()
	@Throttle({ default: { limit: 5, ttl: 60_000 } })
	@Post('password/reset')
	async resetPassword(@Body() body: ResetPasswordDto) {
		await this.authService.resetPasswordWithToken(body);
		return { message: 'Password reset successfully' };
	}

	/**
	 * Changes the signed-in user's own password. Every other session is revoked;
	 * the caller's own is spared so this doesn't log them out of the tab they
	 * submitted from.
	 */
	@UseGuards(JwtAuthGuard)
	@Throttle({ default: { limit: 5, ttl: 60_000 } })
	@Post('password/change')
	async changePassword(@Body() body: ChangePasswordDto, @Req() req: Request) {
		if (!req.user?.id) {
			throw new BadRequestException('User not authenticated');
		}
		// The account is taken from the verified JWT, not the body.
		await this.authService.changePassword({
			userId: req.user.id,
			currentPassword: body.currentPassword,
			newPassword: body.newPassword,
			keepRefreshToken: req.cookies?.['refresh_token'],
		});
		return { message: 'Password changed successfully' };
	}

	@Public()
	@Throttle({ default: { limit: 20, ttl: 60_000 } })
	@Post('refresh')
	async refresh(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		const refreshToken = req.cookies['refresh_token'];
		Logger.debug(`Refresh token: ${refreshToken}`);
		if (!refreshToken) {
			// A bare Error here became a 500 (and, in production, a generic
			// "Internal server error"), so a client with no cookie could not tell
			// it simply needed to log in again.
			throw new UnauthorizedException('Refresh token not found');
		}
		const result = await this.authService.refresh(refreshToken);
		// Absent when the call landed inside the rotation grace window, where the
		// cookie already holds a newer token than the one we were handed.
		if (result.refreshToken) {
			this.authService.setCookie(
				res,
				result.refreshToken,
				result.refreshTokenExpiresAt,
			);
		}
		return {
			accessToken: result.accessToken,
		};
	}
	/* =================================  */
	/**
	 * Finishes every OAuth callback: back into the SPA at the path the user
	 * started from (parked in a cookie by the authorize leg — see
	 * oauth-state.ts), not dumped on the home page.
	 *
	 * `sso=1` tells the frontend "a refresh cookie was just minted": the access
	 * token lives only in JS memory, so after this full-page redirect the SPA
	 * has no way to know it is signed in until it exchanges the cookie — the
	 * marker is what triggers that exchange immediately instead of after the
	 * first 401.
	 */
	private redirectAfterOAuth(req: Request, res: Response) {
		// FRONTEND_URL doubles as the CORS allowlist and may be comma-separated;
		// only the first origin is the canonical web app.
		const base = (this.configService.get<string>('frontendUrl') ?? '')
			.split(',')[0]
			.trim()
			.replace(/\/+$/, '');
		const returnTo = consumeOAuthReturnTo(req, res);
		const separator = returnTo.includes('?') ? '&' : '?';
		return res.redirect(`${base}${returnTo}${separator}sso=1`);
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
	async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
		const user = requireUser(req);
		const sessionInfo = this.authService.getSessionInfo(req);
		const result = await this.authService.oauthAccess(
			OAuthProvider.GOOGLE,
			user.id,
			user.email,
			user,
			sessionInfo,
		);

		this.authService.setCookie(
			res,
			result.refreshToken,
			result.refreshTokenExpiresAt,
		);
		return this.redirectAfterOAuth(req, res);
	}
	@Public()
	@Get('github')
	@UseGuards(GithubAuthGuard)
	githubLogin() {
		// redirect to GitHub
	}
	// A login flow cannot require a JWT to start or finish it. Once
	// JwtAuthGuard is global, an OAuth route without @Public() 401s.
	@Public()
	@Get('github/callback')
	@UseGuards(GithubAuthGuard)
	async githubCallback(@Req() req: Request, @Res() res: Response) {
		const user = requireUser(req);
		const sessionInfo = this.authService.getSessionInfo(req);
		const result = await this.authService.oauthAccess(
			OAuthProvider.GITHUB,
			user.id,
			user.email,
			user,
			sessionInfo,
		);
		this.authService.setCookie(
			res,
			result.refreshToken,
			result.refreshTokenExpiresAt,
		);
		return this.redirectAfterOAuth(req, res);
	}
	@Public()
	@Get('facebook')
	@UseGuards(FacebookAuthGuard)
	facebookLogin() {}

	@Public()
	@Get('facebook/callback')
	@UseGuards(FacebookAuthGuard)
	async facebookCallback(@Req() req: Request, @Res() res: Response) {
		const user = requireUser(req);
		const sessionInfo = this.authService.getSessionInfo(req);
		const result = await this.authService.oauthAccess(
			OAuthProvider.FACEBOOK,
			user.id,
			user.email,
			user,
			sessionInfo,
		);
		this.authService.setCookie(
			res,
			result.refreshToken,
			result.refreshTokenExpiresAt,
		);
		return this.redirectAfterOAuth(req, res);
	}
}
