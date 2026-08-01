import {
	HttpException,
	Injectable,
	Logger,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { EmailTemplate } from '@transactional/emails';
import * as crypto from 'crypto';
import { Request, Response } from 'express';
import { DataSource, IsNull, LessThan, Not, Repository } from 'typeorm';
import { UAParser } from 'ua-parser-js';
import type { RequestUser } from '../../common/request-user';
import { MailService } from '../../mail/mail.service';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { PayloadDto } from '../dto/jwt-payload.dto';
import { SignUpDto } from '../dto/sign-up.dto';
import { Session } from '../entities/session.entity';
import {
	VerificationToken,
	VerificationType,
} from '../entities/verification-token.entity';
import { TokensService } from './tokens.service';

interface SessionInfo {
	ipAddress: string;
	userAgent: string;
	browser?: string;
	os?: string;
	deviceName?: string;
}

interface LoginResp {
	accessToken: string;
	refreshToken: string;
	/** Absolute end of the session, for the refresh cookie's maxAge. */
	refreshTokenExpiresAt: Date;
	user?: Partial<User>;
}

interface RefreshResp {
	accessToken: string;
	/**
	 * Present only when the token was actually rotated. When absent the caller
	 * must leave the existing cookie alone — see the grace window in
	 * {@link AuthService.refresh}.
	 */
	refreshToken?: string;
	refreshTokenExpiresAt?: Date;
}

interface CreateVTResp {
	selector: string;
	rawToken: string;
}
const VERIFY_PATH = '/verify-email';

/**
 * How long a just-rotated refresh token still buys an access token.
 *
 * Rotation means the second of two concurrent refreshes presents a token the
 * first already spent, which is indistinguishable from replay. Browsers produce
 * this constantly — a second tab, a restored session, two requests 401ing
 * together. Without a grace window every such race would revoke every session
 * the user has, so the honest reading of a *just*-rotated token is "lost the
 * race", not "stolen".
 *
 * The cost is a 10s window in which a stolen token still yields one short-lived
 * access token; the attacker must also already hold the token and lose the race
 * to the legitimate client.
 */
const ROTATION_GRACE_MS = 10_000;

@Injectable()
export class AuthService {
	constructor(
		private readonly usersService: UsersService,
		private readonly configService: ConfigService,
		@InjectRepository(Session)
		private readonly sessionRepo: Repository<Session>,
		@InjectRepository(VerificationToken)
		private readonly verificationTokenRepo: Repository<VerificationToken>,
		private readonly tokensService: TokensService,
		private readonly mailService: MailService,
		@InjectDataSource()
		private readonly dataSource: DataSource,
	) {}

	async login(
		email: string,
		password: string,
		sessionInfo: SessionInfo,
	): Promise<LoginResp> {
		const user = await this.usersService.validateUser(email, password);
		if (!user || !user.email || !user.id) {
			throw new HttpException('Invalid email or password', 400);
		}
		if (!user.isActive) {
			throw new HttpException('User is not active', 400);
		}
		const payload: PayloadDto = {
			email: user.email,
			sub: user.id,
		};
		const refreshToken = await this.tokensService.generateRefreshToken(payload);
		const accessToken = await this.tokensService.generateAccessToken(payload);
		const expiresAt = this.sessionExpiry();
		await this.sessionRepo.save(
			this.sessionRepo.create({
				userId: user.id,
				refreshTokenHash: this.tokensService.hashToken(refreshToken),
				deviceName: sessionInfo.deviceName,
				ipAddress: sessionInfo.ipAddress,
				userAgent: sessionInfo.userAgent,
				expiresAt,
			}),
		);
		return {
			accessToken,
			refreshToken,
			refreshTokenExpiresAt: expiresAt,
			user,
		};
	}

	/** refreshExpiresIn is configured in seconds; Date math is in ms. */
	private sessionExpiry(): Date {
		return new Date(
			Date.now() + +this.configService.get('jwt.refreshExpiresIn') * 1000,
		);
	}

	/**
	 * Registers a new account. Deliberately indistinguishable from signing up with
	 * an address that already exists: the old `400 Email already in use` turned
	 * this unauthenticated endpoint into a membership oracle for any address list.
	 */
	async signup(dto: SignUpDto) {
		const existing = await this.usersService.findOne({
			email: dto.email,
		});

		if (existing) {
			// One case where silence would be actively unhelpful: an account that
			// never finished verifying. Resending is safe — the mail goes to the
			// address's real owner, not to whoever made the request.
			if (!existing.emailVerified) {
				await this.sendVerificationEmail({
					pathname: VERIFY_PATH,
					user: existing,
					type: VerificationType.EMAIL_VERIFY,
					subject: 'Welcome to All about Saas',
					template: 'welcome',
				});
			}
			return;
		}
		const newUser = await this.usersService.create({
			email: dto.email,
			password: dto.password,
		});

		await this.sendVerificationEmail({
			pathname: VERIFY_PATH,
			user: newUser,
			type: VerificationType.EMAIL_VERIFY,
			subject: 'Welcome to All about Saas',
			template: 'welcome',
		});
	}

	/**
	 * @param email the address the provider released, which may be absent — see
	 * the guard below.
	 */
	async oauthAccess(
		provider: string,
		providerId: string,
		email: string | undefined,
		profileData: RequestUser,
		sessionInfo: SessionInfo,
	): Promise<LoginResp> {
		// `email` was typed `string` while every caller passed `req.user.email` from
		// an OAuth profile, which is genuinely optional: Facebook releases no address
		// for an account registered by phone number, and GitHub none for a private
		// one. `undefined` then reached `findOrCreateOAuthUser` → `findOne({ email })`,
		// and TypeORM's default `invalidWhereValuesBehavior.undefined` is 'ignore' —
		// so the condition was dropped from the query, `SELECT … LIMIT 1` matched an
		// ARBITRARY existing row, and this method minted that user's tokens for
		// whoever completed the OAuth flow. Full account takeover, no warning.
		if (!email) {
			throw new HttpException(
				`${provider} did not return an email address for this account`,
				400,
			);
		}
		const { accessToken: _ssoAccessToken, ...profile } = profileData;
		const user = await this.usersService.findOrCreateOAuthUser(
			provider,
			providerId,
			email,
			profile,
		);
		if (!user) {
			throw new HttpException('Failed to create user from OAuth data', 400);
		}

		const payload: PayloadDto = { email: user.email, sub: user.id };
		const accessToken = await this.tokensService.generateAccessToken(payload);
		const refreshToken = await this.tokensService.generateRefreshToken(payload);

		const expiresAt = this.sessionExpiry();
		const session = this.sessionRepo.create({
			userId: user.id,
			refreshTokenHash: this.tokensService.hashToken(refreshToken),
			deviceName: sessionInfo.deviceName,
			ipAddress: sessionInfo.ipAddress,
			userAgent: sessionInfo.userAgent,
			expiresAt,
		});
		await this.sessionRepo.save(session);

		return {
			user,
			accessToken,
			refreshToken,
			refreshTokenExpiresAt: expiresAt,
		};
	}

	/**
	 * Exchanges a refresh token for a fresh access token, rotating the refresh
	 * token in the process: the presented one is retired and a new one issued, so
	 * a token that leaks is only useful until the legitimate client next refreshes.
	 *
	 * Rotation is what makes replay *visible*. A revoked row being presented again
	 * outside {@link ROTATION_GRACE_MS} means two parties hold the same token, and
	 * since we cannot tell which one is the owner, every session is ended.
	 *
	 * The new token inherits the original session's expiry rather than extending
	 * it — a sliding window would let a stolen token be refreshed indefinitely, so
	 * the trade is a forced re-login once per refresh TTL.
	 */
	async refresh(refreshToken: string): Promise<RefreshResp> {
		let payload: PayloadDto;
		try {
			payload = await this.tokensService.verifyRefreshToken(refreshToken);
		} catch (error) {
			// Detail stays server-side: the client is unauthenticated here, so the
			// response must not describe why verification failed.
			Logger.debug(`Refresh token verification failed: ${String(error)}`);
			throw new UnauthorizedException('Invalid refresh token');
		}

		const tokenHash = this.tokensService.hashToken(refreshToken);
		const newPayload: PayloadDto = {
			sub: payload.sub,
			email: payload.email,
		};

		// One transaction so the retire-old / issue-new pair cannot half-apply and
		// leave the client holding a token that was never recorded.
		return this.dataSource.transaction(async (manager) => {
			const sessions = manager.getRepository(Session);
			const session = await sessions.findOne({
				where: { refreshTokenHash: tokenHash, userId: payload.sub },
			});
			if (!session) {
				throw new UnauthorizedException('Invalid refresh token');
			}

			if (session.revokedAt) {
				const rotatedRecently =
					session.rotatedAt &&
					Date.now() - session.rotatedAt.getTime() < ROTATION_GRACE_MS;
				if (rotatedRecently) {
					// Lost a rotation race. Hand out an access token — the JWT itself is
					// still valid and unexpired — but do not rotate again, so the winner's
					// cookie stays authoritative.
					return {
						accessToken:
							await this.tokensService.generateAccessToken(newPayload),
					};
				}
				await sessions.update(
					{ userId: payload.sub, revokedAt: IsNull() },
					{ revokedAt: new Date() },
				);
				Logger.warn(
					`Refresh token reuse detected for user ${payload.sub}; all sessions revoked`,
				);
				throw new UnauthorizedException('Invalid refresh token');
			}

			if (session.expiresAt < new Date()) {
				throw new UnauthorizedException('Session expired');
			}

			// Seconds left on the session, so the token cannot outlive its own row.
			// Floored at 1: jsonwebtoken treats expiresIn:0 as "already expired".
			const remainingSeconds = Math.max(
				1,
				Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
			);
			// Re-sign from a clean payload: the decoded token still carries `iat`/`exp`,
			// and jsonwebtoken rejects `expiresIn` when `exp` is already present.
			const nextRefreshToken = await this.tokensService.generateRefreshToken(
				newPayload,
				remainingSeconds,
			);

			const now = new Date();
			session.revokedAt = now;
			session.rotatedAt = now;
			await sessions.save(session);
			await sessions.save(
				sessions.create({
					userId: session.userId,
					refreshTokenHash: this.tokensService.hashToken(nextRefreshToken),
					deviceName: session.deviceName,
					userAgent: session.userAgent,
					ipAddress: session.ipAddress,
					expiresAt: session.expiresAt,
				}),
			);

			// Rotation appends a row every time, so an active user generates one per
			// access-token lifetime — roughly a hundred a day — and nothing ever
			// removed them. Rows past their expiry are dead weight: the JWT they
			// track no longer verifies, so they cannot even serve reuse detection.
			//
			// Pruned here rather than on a schedule: it is one indexed DELETE scoped
			// to this user, it runs exactly when the table grows, and it needs no
			// cron to be remembered.
			await sessions.delete({
				userId: session.userId,
				expiresAt: LessThan(new Date()),
			});

			return {
				accessToken: await this.tokensService.generateAccessToken(newPayload),
				refreshToken: nextRefreshToken,
				refreshTokenExpiresAt: session.expiresAt,
			};
		});
	}

	async logout(refreshToken: string): Promise<void> {
		await this.sessionRepo.update(
			{
				refreshTokenHash: this.tokensService.hashToken(refreshToken),
				revokedAt: IsNull(),
			},
			{ revokedAt: new Date() },
		);
	}

	/**
	 * Completes a forgotten-password reset. Unauthenticated by design: the
	 * emailed selector + token pair is the proof of identity.
	 *
	 * (Was named `changePassword`, which read as the in-session operation.)
	 */
	async resetPasswordWithToken({
		selector,
		token,
		password,
	}: ResetPasswordDto): Promise<void> {
		const user = await this.verifyVerificationTokenRecord(
			selector,
			token,
			VerificationType.PASSWORD_RESET,
			true, // consume = true
		);
		if (!user) {
			throw new HttpException('Invalid or expired verification token', 400);
		}
		const rec = await this.usersService.findOneWithPassword({ id: user.id });
		if (!rec) {
			throw new HttpException('User not found', 404);
		}
		// `User.password` is a nullable column, so a row can carry no hash at all —
		// and `bcrypt.compare(x, undefined)` throws, which would surface as a 500 on
		// this endpoint rather than a reset. With nothing on record there is also
		// nothing for the new password to be a duplicate of, so the check is skipped.
		const comparison = rec.password
			? await this.tokensService.comparePassword(password, rec.password)
			: false;
		if (comparison) {
			throw new HttpException(
				'New password cannot be the same as the old password',
				400,
			);
		}
		await this.usersService.update(user.id, {
			password: password,
		});
		// A reset is the remedy for "someone else has my account", so it has to end
		// every session — including any the attacker holds.
		await this.revokeSessions(user.id);
	}

	/**
	 * Revokes every live session for a user, optionally sparing one.
	 *
	 * @param exceptRefreshToken raw token of the session to keep, so an in-session
	 * password change doesn't log the user out of the tab they're using.
	 */
	private async revokeSessions(
		userId: string,
		exceptRefreshToken?: string,
	): Promise<void> {
		await this.sessionRepo.update(
			{
				userId,
				revokedAt: IsNull(),
				...(exceptRefreshToken
					? {
							refreshTokenHash: Not(
								this.tokensService.hashToken(exceptRefreshToken),
							),
						}
					: {}),
			},
			{ revokedAt: new Date() },
		);
	}

	async resendResetPasswordEmail(selector: string): Promise<void> {
		const token = await this.verificationTokenRepo.findOne({
			where: { selector, type: VerificationType.PASSWORD_RESET },
			relations: ['user'],
		});
		if (!token) {
			throw new HttpException('Verification token not found', 404);
		}
		const user = token.user;
		if (!user) {
			throw new HttpException('User not found', 404);
		}
		await this.sendVerificationEmail({
			user,
			type: VerificationType.PASSWORD_RESET,
			pathname: VERIFY_PATH,
			subject: 'Reset Your Password',
			template: 'passwordReset',
		});
	}
	/**
	 * Changes the password of an already-authenticated user. `userId` comes from
	 * the verified JWT, never from the request body.
	 *
	 * Requires the current password even though the caller is already
	 * authenticated: the access token lives in localStorage, so one XSS payload is
	 * enough to obtain it, and without this check that token alone would be a
	 * complete account takeover. Knowing the current password is the second factor.
	 *
	 * (Was named `resetPassword`, which read as the forgot-password flow.)
	 */
	async changePassword({
		userId,
		currentPassword,
		newPassword,
		keepRefreshToken,
	}: {
		userId: string;
		currentPassword: string;
		newPassword: string;
		keepRefreshToken?: string;
	}): Promise<void> {
		// findOne would not return `password` at all — the column is select:false —
		// so the comparison below used to receive `undefined` and bcrypt threw,
		// surfacing as a 500 on every call to this endpoint.
		const user = await this.usersService.findOneWithPassword({ id: userId });
		if (!user) {
			throw new HttpException('User not found', 404);
		}
		// Same nullable column as in resetPasswordWithToken, opposite conclusion:
		// proving you know the current password is impossible when there is no
		// current password, so this must fail. It falls through to the ordinary
		// wrong-password response so the caller cannot tell the two apart.
		const currentMatches = user.password
			? await this.tokensService.comparePassword(currentPassword, user.password)
			: false;
		if (!currentMatches) {
			throw new UnauthorizedException('Current password is incorrect');
		}
		if (currentPassword === newPassword) {
			throw new HttpException(
				'New password cannot be the same as the old password',
				400,
			);
		}
		await this.usersService.update(user.id, {
			password: newPassword,
		});
		// Anyone who got in with the old password stays in otherwise.
		await this.revokeSessions(user.id, keepRefreshToken);
	}

	async resendVerificationEmail(selector: string): Promise<void> {
		const token = await this.verificationTokenRepo.findOne({
			where: { selector },
			relations: ['user'],
		});
		if (!token) {
			throw new HttpException('Verification token not found', 404);
		}
		const user = token.user;
		if (!user) {
			throw new HttpException('User not found', 404);
		}

		await this.sendVerificationEmail({
			user,
			type: VerificationType.EMAIL_VERIFY,
			pathname: VERIFY_PATH,
			subject: 'Resend Verification Email',
			template: 'welcome',
		});
	}

	async sendResetPasswordEmail(email: string): Promise<void> {
		const user = await this.usersService.findOne({ email });
		if (!user) {
			// Returns as if the mail was sent. A `404 User not found` here let anyone
			// test an address list for membership, one unauthenticated request each.
			Logger.debug('Password reset requested for an unregistered address');
			return;
		}
		await this.sendVerificationEmail({
			user,
			type: VerificationType.PASSWORD_RESET,
			pathname: VERIFY_PATH,
			subject: 'Reset Your Password',
			template: 'passwordReset',
		});
	}

	async sendVerificationEmail({
		user,
		type,
		pathname,
		subject = 'Verify Your Email',
		template = 'welcome',
		props,
	}: {
		user: User;
		pathname: string;
		type: VerificationType;
		subject?: string;
		template?: EmailTemplate;
		props?: Record<string, unknown>;
	}) {
		const { rawToken, selector: newSelector } =
			await this.createVerificationTokenRecord({
				userId: user.id,
				type: type,
			});
		const url = new URL(this.configService.get('frontendUrl') ?? '');
		url.pathname = pathname;
		url.searchParams.set('token', rawToken);
		url.searchParams.set('selector', newSelector);
		url.searchParams.set('type', type);
		return await this.mailService.sendEmail(
			{
				subject: subject,
				to: user.email,
				headers: {
					'X-Entity-Ref-ID': user.id,
				},
			},
			template,
			{
				url: url.toString(),
				...props,
			},
		);
	}

	async createVerificationTokenRecord({
		userId,
		type,
		expiresInMs = 3600000, // default 1 hour
	}: {
		userId: string;
		type: VerificationType;
		expiresInMs?: number;
	}): Promise<CreateVTResp> {
		const user = await this.usersService.findOne({ id: userId });
		if (!user) {
			throw new HttpException('User not found', 404);
		}

		const { rawToken, tokenHash } =
			await this.tokensService.createVerificationToken();
		const selector = crypto.randomUUID();
		const expiresAt = new Date(Date.now() + expiresInMs);

		const record = this.verificationTokenRepo.create({
			user,
			selector,
			tokenHash,
			type,
			expiresAt,
		});
		await this.verificationTokenRepo.save(record);

		return {
			selector,
			rawToken,
		};
	}

	async verifyVerificationTokenRecord(
		selector: string,
		token: string,
		type: VerificationType,
		consume = true,
	): Promise<User | null> {
		const record = await this.verificationTokenRepo.findOne({
			relations: ['user'],
			where: {
				selector,
				type,
			},
		});
		if (!record) {
			return null;
		}

		if (record.usedAt || record.expiresAt < new Date()) {
			return null;
		}

		const isValid = await this.tokensService.verifyToken(
			token,
			record.tokenHash,
		);
		if (isValid) {
			if (consume) {
				record.usedAt = new Date();
				await this.verificationTokenRepo.save(record);
			}
			return record.user;
		}

		return null;
	}

	getSessionInfo(req: Request): SessionInfo {
		const userAgent = req.headers['user-agent'] ?? '';
		const parser = new UAParser(userAgent);

		return {
			ipAddress: req.ip || req.headers['forwarded'] || '',
			userAgent,
			deviceName: `${parser.getBrowser().name} on ${parser.getOS().name}`,
		};
	}
	/**
	 * @param expiresAt when the session actually ends. Rotation keeps the original
	 * expiry, so re-issuing the cookie with a full TTL would make the browser hold
	 * a token past the point the server stops honouring it.
	 */
	setCookie(res: Response, token: string, expiresAt?: Date) {
		const maxAge = expiresAt
			? Math.max(0, expiresAt.getTime() - Date.now())
			: +this.configService.get('jwt.refreshExpiresIn') * 1000;
		return res.cookie('refresh_token', token, {
			httpOnly: true,
			secure: this.configService.get<boolean>('cookie.secure') ?? true,
			sameSite:
				this.configService.get<'lax' | 'strict' | 'none'>('cookie.sameSite') ??
				'lax',
			maxAge,
		});
	}
}
