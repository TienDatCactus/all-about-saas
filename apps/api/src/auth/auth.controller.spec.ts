import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { OAuthProvider } from '../users/entities/oauth-account.entity';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import {
	VerificationToken,
	VerificationType,
} from './entities/verification-token.entity';
import { AuthService } from './services/auth.service';

const mockAuthService = {
	getSessionInfo: jest.fn(),
	login: jest.fn(),
	signup: jest.fn(),
	verifyVerificationTokenRecord: jest.fn(),
	resendResetPasswordEmail: jest.fn(),
	sendResetPasswordEmail: jest.fn(),
	resendVerificationEmail: jest.fn(),
	logout: jest.fn(),
	changePassword: jest.fn(),
	resetPasswordWithToken: jest.fn(),
	refresh: jest.fn(),
	oauthAccess: jest.fn(),
	setCookie: jest.fn(),
};

const mockUsersService = { update: jest.fn() };
const mockConfigService = { get: jest.fn(() => 'https://app.test') };
// Injected into the controller but never used by any handler — provided for DI only.
const mockVerificationTokenRepo = { findOne: jest.fn() };

// Minimal express doubles. Methods return `res` so chaining stays valid.
const makeRes = () => {
	const res: any = {};
	res.cookie = jest.fn(() => res);
	res.clearCookie = jest.fn(() => res);
	res.redirect = jest.fn(() => res);
	return res;
};

describe('AuthController', () => {
	let controller: AuthController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AuthController],
			providers: [
				{ provide: AuthService, useValue: mockAuthService },
				{ provide: UsersService, useValue: mockUsersService },
				{ provide: ConfigService, useValue: mockConfigService },
				{
					provide: getRepositoryToken(VerificationToken),
					useValue: mockVerificationTokenRepo,
				},
			],
		}).compile();

		controller = module.get<AuthController>(AuthController);
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	describe('login', () => {
		it('builds session info, logs in, sets the cookie and returns the access token', async () => {
			const req: any = { headers: {}, ip: '127.0.0.1' };
			const res = makeRes();
			const sessionInfo = { ipAddress: '127.0.0.1', userAgent: 'jest' };
			mockAuthService.getSessionInfo.mockReturnValue(sessionInfo);
			const expiresAt = new Date('2026-08-07T00:00:00.000Z');
			mockAuthService.login.mockResolvedValue({
				accessToken: 'access-tok',
				refreshToken: 'refresh-tok',
				refreshTokenExpiresAt: expiresAt,
			});

			const result = await controller.login(
				{ email: 'dat@test.com', password: 'pw' },
				res,
				req,
			);

			expect(mockAuthService.getSessionInfo).toHaveBeenCalledWith(req);
			expect(mockAuthService.login).toHaveBeenCalledWith(
				'dat@test.com',
				'pw',
				sessionInfo,
			);
			// The session's absolute expiry rides along, so the cookie cannot outlive
			// the row that authorises it.
			expect(mockAuthService.setCookie).toHaveBeenCalledWith(
				res,
				'refresh-tok',
				expiresAt,
			);
			// Data only — "Login successful" now lives on @ResponseMessage, so the
			// interceptor no longer has to dig it out of the payload.
			expect(result).toEqual({ accessToken: 'access-tok' });
		});
	});

	describe('verifyEmail', () => {
		it('throws when selector or token is missing', async () => {
			await expect(
				controller.verifyEmail({
					token: 't',
					type: VerificationType.EMAIL_VERIFY,
				} as any),
			).rejects.toThrow(BadRequestException);
			expect(
				mockAuthService.verifyVerificationTokenRecord,
			).not.toHaveBeenCalled();
		});

		it('passes consume=false for PASSWORD_RESET, consume=true otherwise', async () => {
			mockAuthService.verifyVerificationTokenRecord.mockResolvedValue({
				id: 'u1',
			});

			await controller.verifyEmail({
				selector: 's',
				token: 't',
				type: VerificationType.PASSWORD_RESET,
			});

			expect(
				mockAuthService.verifyVerificationTokenRecord,
			).toHaveBeenCalledWith('s', 't', VerificationType.PASSWORD_RESET, false);
		});

		it('throws when the token record resolves to no user', async () => {
			mockAuthService.verifyVerificationTokenRecord.mockResolvedValue(null);

			await expect(
				controller.verifyEmail({
					selector: 's',
					token: 't',
					type: VerificationType.EMAIL_VERIFY,
				} as any),
			).rejects.toThrow(BadRequestException);
		});

		it('activates the user and marks email verified for EMAIL_VERIFY', async () => {
			mockAuthService.verifyVerificationTokenRecord.mockResolvedValue({
				id: 'u1',
			});

			const result = await controller.verifyEmail({
				selector: 's',
				token: 't',
				type: VerificationType.EMAIL_VERIFY,
			});

			expect(
				mockAuthService.verifyVerificationTokenRecord,
			).toHaveBeenCalledWith('s', 't', VerificationType.EMAIL_VERIFY, true);
			expect(mockUsersService.update).toHaveBeenCalledWith('u1', {
				emailVerified: true,
				isActive: true,
			});
			expect(result).toEqual({ message: 'Email verified successfully.' });
		});

		it('does not update the user for non-EMAIL_VERIFY types', async () => {
			mockAuthService.verifyVerificationTokenRecord.mockResolvedValue({
				id: 'u1',
			});

			await controller.verifyEmail({
				selector: 's',
				token: 't',
				type: VerificationType.PASSWORD_RESET,
			});

			expect(mockUsersService.update).not.toHaveBeenCalled();
		});
	});

	describe('signup', () => {
		it('delegates email/password and returns a message that reveals nothing', async () => {
			const result = await controller.signup({
				email: 'dat@test.com',
				password: 'pw',
			});

			expect(mockAuthService.signup).toHaveBeenCalledWith({
				email: 'dat@test.com',
				password: 'pw',
			});
			// Identical whether or not the address already had an account — the old
			// "User registered successfully" vs "Email already in use" pair was an
			// enumeration oracle.
			expect(result).toEqual({
				message: 'Check your email to finish signing up.',
			});
		});
	});

	// POST /auth/password/reset — finishing a forgotten-password reset.
	describe('resetPassword', () => {
		it('forwards the emailed selector/token body and returns success', async () => {
			const body = { selector: 's', token: 't', password: 'pw' };

			const result = await controller.resetPassword(body);

			expect(mockAuthService.resetPasswordWithToken).toHaveBeenCalledWith(body);
			expect(result).toEqual({ message: 'Password reset successfully' });
		});
	});

	describe('refresh', () => {
		it('throws when no refresh_token cookie is present', async () => {
			const req: any = { cookies: {} };

			await expect(controller.refresh(req, makeRes())).rejects.toThrow(
				'Refresh token not found',
			);
			expect(mockAuthService.refresh).not.toHaveBeenCalled();
		});

		it('re-sets the cookie when the token was rotated', async () => {
			const req: any = { cookies: { refresh_token: 'refresh-tok' } };
			const res = makeRes();
			const expiresAt = new Date('2026-08-07T00:00:00.000Z');
			mockAuthService.refresh.mockResolvedValue({
				accessToken: 'new-access-tok',
				refreshToken: 'next-refresh-tok',
				refreshTokenExpiresAt: expiresAt,
			});

			const result = await controller.refresh(req, res);

			expect(mockAuthService.refresh).toHaveBeenCalledWith('refresh-tok');
			expect(mockAuthService.setCookie).toHaveBeenCalledWith(
				res,
				'next-refresh-tok',
				expiresAt,
			);
			expect(result).toEqual({ accessToken: 'new-access-tok' });
		});

		it('leaves the cookie alone inside the rotation grace window', async () => {
			const req: any = { cookies: { refresh_token: 'refresh-tok' } };
			const res = makeRes();
			// No refreshToken in the response: a concurrent refresh already rotated,
			// so the cookie holds a newer token than the one we were handed.
			mockAuthService.refresh.mockResolvedValue({
				accessToken: 'new-access-tok',
			});

			const result = await controller.refresh(req, res);

			expect(mockAuthService.setCookie).not.toHaveBeenCalled();
			expect(result).toEqual({ accessToken: 'new-access-tok' });
		});
	});

	describe('logout', () => {
		it('revokes the session and clears the cookie when a token is present', async () => {
			const req: any = { cookies: { refresh_token: 'refresh-tok' } };
			const res = makeRes();

			const result = await controller.logout(req, res);

			expect(mockAuthService.logout).toHaveBeenCalledWith('refresh-tok');
			expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
			expect(result).toEqual({ message: 'Logged out successfully' });
		});

		it('still clears the cookie when no token is present', async () => {
			const req: any = { cookies: {} };
			const res = makeRes();

			await controller.logout(req, res);

			expect(mockAuthService.logout).not.toHaveBeenCalled();
			expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
		});
	});

	// POST /auth/password/change — the signed-in user changing their own.
	describe('changePassword', () => {
		it('throws when the request has no authenticated user', async () => {
			const req: any = { user: null };

			await expect(
				controller.changePassword(
					{ currentPassword: 'old-pw', newPassword: 'new-pw-1234' },
					req,
				),
			).rejects.toThrow(BadRequestException);
			expect(mockAuthService.changePassword).not.toHaveBeenCalled();
		});

		it('takes the account from the JWT, not the request body', async () => {
			const req: any = {
				user: { id: 'u1', email: 'dat@test.com' },
				cookies: { refresh_token: 'refresh-tok' },
			};

			const result = await controller.changePassword(
				// An attacker-supplied userId/email must not reach the service.
				{
					currentPassword: 'old-pw',
					newPassword: 'new-pw-1234',
					userId: 'victim-id',
				} as any,
				req,
			);

			expect(mockAuthService.changePassword).toHaveBeenCalledWith({
				userId: 'u1',
				currentPassword: 'old-pw',
				newPassword: 'new-pw-1234',
				// The caller's own session is spared the revoke-all.
				keepRefreshToken: 'refresh-tok',
			});
			expect(result).toEqual({ message: 'Password changed successfully' });
		});
	});

	describe('sendVerificationEmail', () => {
		it('PASSWORD_RESET with selector → resendResetPasswordEmail', async () => {
			await controller.sendVerificationEmail({
				type: VerificationType.PASSWORD_RESET,
				selector: 's',
			});

			expect(mockAuthService.resendResetPasswordEmail).toHaveBeenCalledWith(
				's',
			);
			expect(mockAuthService.sendResetPasswordEmail).not.toHaveBeenCalled();
		});

		it('PASSWORD_RESET with email only → sendResetPasswordEmail', async () => {
			await controller.sendVerificationEmail({
				type: VerificationType.PASSWORD_RESET,
				email: 'dat@test.com',
			});

			expect(mockAuthService.sendResetPasswordEmail).toHaveBeenCalledWith(
				'dat@test.com',
			);
		});

		it('PASSWORD_RESET with neither selector nor email → throws', async () => {
			await expect(
				controller.sendVerificationEmail({
					type: VerificationType.PASSWORD_RESET,
				} as any),
			).rejects.toThrow(BadRequestException);
		});

		it('EMAIL_VERIFY without selector → throws', async () => {
			await expect(
				controller.sendVerificationEmail({
					type: VerificationType.EMAIL_VERIFY,
				} as any),
			).rejects.toThrow(BadRequestException);
		});

		it('EMAIL_VERIFY with selector → resendVerificationEmail', async () => {
			await controller.sendVerificationEmail({
				type: VerificationType.EMAIL_VERIFY,
				selector: 's',
			});

			expect(mockAuthService.resendVerificationEmail).toHaveBeenCalledWith('s');
		});

		it('unknown verification type → throws', async () => {
			await expect(
				controller.sendVerificationEmail({
					type: 'SOMETHING_ELSE' as VerificationType,
					selector: 's',
				} as any),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('oauth callbacks', () => {
		const cases = [
			['googleAuthRedirect', OAuthProvider.GOOGLE] as const,
			['githubCallback', OAuthProvider.GITHUB] as const,
			['facebookCallback', OAuthProvider.FACEBOOK] as const,
		];

		it.each(cases)(
			'%s: runs oauthAccess, sets the cookie and redirects to the frontend',
			async (method, provider) => {
				const req: any = {
					headers: {},
					user: { id: 'u1', email: 'dat@test.com' },
				};
				const res = makeRes();
				mockAuthService.getSessionInfo.mockReturnValue({ userAgent: 'jest' });
				const expiresAt = new Date('2026-08-07T00:00:00.000Z');
				mockAuthService.oauthAccess.mockResolvedValue({
					refreshToken: 'refresh-tok',
					refreshTokenExpiresAt: expiresAt,
				});

				await (controller as any)[method](req, res);

				expect(mockAuthService.oauthAccess).toHaveBeenCalledWith(
					provider,
					'u1',
					'dat@test.com',
					req.user,
					{ userAgent: 'jest' },
				);
				expect(mockAuthService.setCookie).toHaveBeenCalledWith(
					res,
					'refresh-tok',
					expiresAt,
				);
				expect(res.redirect).toHaveBeenCalledWith('https://app.test');
			},
		);
	});
});
