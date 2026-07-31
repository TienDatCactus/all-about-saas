import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EmailTemplate } from '@transactional/emails';
import * as crypto from 'crypto';
import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { UAParser } from 'ua-parser-js';
import { MailService } from '../../mail/mail.service';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { ChangePasswordDto } from '../dto/change-password.dto';
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
	user?: Partial<User>;
}

interface CreateVTResp {
	selector: string;
	rawToken: string;
}
const VERIFY_PATH = '/verify-email';

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
		await this.sessionRepo.save(
			this.sessionRepo.create({
				user: user,
				refreshToken: refreshToken,
				deviceName: sessionInfo.deviceName,
				ipAddress: sessionInfo.ipAddress,
				userAgent: sessionInfo.userAgent,
				expiresAt: new Date(
					// refreshExpiresIn is in seconds; Date math is in ms.
					Date.now() + +this.configService.get('jwt.refreshExpiresIn') * 1000,
				),
			}),
		);
		return {
			accessToken,
			refreshToken,
			user,
		};
	}

	async signup(dto: SignUpDto) {
		const exists = await this.usersService.findOne({
			email: dto.email,
		});

		if (exists) {
			throw new HttpException('Email already in use', 400);
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

	async oauthAccess(
		provider: string,
		providerId: string,
		email: string,
		profileData: any,
		sessionInfo: SessionInfo,
	): Promise<LoginResp> {
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

		const session = this.sessionRepo.create({
			user: user,
			refreshToken: refreshToken,
			deviceName: sessionInfo.deviceName,
			ipAddress: sessionInfo.ipAddress,
			userAgent: sessionInfo.userAgent,
			expiresAt: new Date(
				// refreshExpiresIn is in seconds; Date math is in ms.
				Date.now() + +this.configService.get('jwt.refreshExpiresIn') * 1000,
			),
		});
		await this.sessionRepo.save(session);

		return {
			user,
			accessToken,
			refreshToken,
		};
	}

	async refresh(refreshToken: string): Promise<string> {
		try {
			const payload = await this.tokensService.verifyRefreshToken(refreshToken);
			const session = await this.sessionRepo.findOne({
				where: {
					refreshToken,
					user: {
						id: payload.sub,
					},
				},
			});
			if (!session || !!session.revokedAt || session.expiresAt < new Date()) {
				throw new HttpException('Session expired or revoked', 401);
			}
			// Re-sign from a clean payload: the decoded token still carries `iat`/`exp`,
			// and jsonwebtoken rejects `expiresIn` when `exp` is already present.
			const newPayload: PayloadDto = {
				sub: payload.sub,
				email: payload.email,
			};
			const newAccessToken =
				await this.tokensService.generateAccessToken(newPayload);
			return newAccessToken;
		} catch (error) {
			// Detail stays server-side: the client is unauthenticated here, so the
			// response must not describe why verification failed.
			Logger.debug(`Refresh token verification failed: ${error}`);
			throw new HttpException('Invalid refresh token', 401);
		}
	}

	async logout(refreshToken: string): Promise<void> {
		const session = await this.sessionRepo.findOne({
			where: {
				refreshToken,
			},
		});
		if (session) {
			session.revokedAt = new Date();
			await this.sessionRepo.save(session);
		}
	}

	async changePassword({
		selector,
		token,
		password,
	}: Pick<
		ChangePasswordDto,
		'selector' | 'token' | 'password'
	>): Promise<void> {
		if (!selector || !token || !password) {
			throw new HttpException('Selector, token and password are required', 400);
		}
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
		const comparison = await this.tokensService.comparePassword(
			password,
			rec.password,
		);
		if (comparison) {
			throw new HttpException(
				'New password cannot be the same as the old password',
				400,
			);
		}
		await this.usersService.update(user.id, {
			password: password,
		});
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
	async resetPassword({
		password,
		email,
	}: Pick<ChangePasswordDto, 'password' | 'email'>): Promise<void> {
		const user = await this.usersService.findOne({ email });
		if (!user) {
			throw new HttpException('User not found', 404);
		}
		const comparison = await this.tokensService.comparePassword(
			password,
			user.password,
		);
		if (comparison) {
			throw new HttpException(
				'New password cannot be the same as the old password',
				400,
			);
		}
		await this.usersService.update(user.id, {
			password,
		});
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
		props?: Record<string, any>;
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
	setCookie(res: Response, token: string) {
		return res.cookie('refresh_token', token, {
			httpOnly: true,
			secure: this.configService.get<boolean>('cookie.secure') ?? true,
			sameSite:
				this.configService.get<'lax' | 'strict' | 'none'>('cookie.sameSite') ??
				'lax',
			maxAge: +this.configService.get('jwt.refreshExpiresIn') * 1000,
		});
	}
}
