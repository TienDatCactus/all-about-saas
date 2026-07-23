import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from '../../mail/mail.service';
import { UsersService } from '../../users/users.service';
import { Session } from '../entities/session.entity';
import { VerificationToken } from '../entities/verification-token.entity';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';

/**
 * Config values keyed by the exact strings auth.service passes to
 * configService.get. Mirror new keys here as the suite grows.
 */
const CONFIG_VALUES: Record<string, unknown> = {
	'jwt.refreshExpiresIn': 604800000, // 7 days in ms
	frontendUrl: 'https://app.test',
};

const mockUsersService = {
	validateUser: jest.fn(),
	findOne: jest.fn(),
	create: jest.fn(),
	update: jest.fn(),
	findOneWithPassword: jest.fn(),
	findOrCreateOAuthUser: jest.fn(),
};

const mockTokensService = {
	generateAccessToken: jest.fn(),
	generateRefreshToken: jest.fn(),
	verifyRefreshToken: jest.fn(),
	comparePassword: jest.fn(),
	createVerificationToken: jest.fn(),
	verifyToken: jest.fn(),
};

const mockMailService = { sendEmail: jest.fn() };

const mockConfigService = {
	get: jest.fn((key: string) => CONFIG_VALUES[key]),
};

// Repositories echo back what they create/save so callers see a "persisted" row.
const mockSessionRepo = {
	create: jest.fn((dto) => dto),
	save: jest.fn((entity) => Promise.resolve(entity)),
	findOne: jest.fn(),
};

const mockVerificationTokenRepo = {
	create: jest.fn((dto) => dto),
	save: jest.fn((entity) => Promise.resolve(entity)),
	findOne: jest.fn(),
};

describe('AuthService', () => {
	let service: AuthService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				{ provide: UsersService, useValue: mockUsersService },
				{ provide: TokensService, useValue: mockTokensService },
				{ provide: MailService, useValue: mockMailService },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: getRepositoryToken(Session), useValue: mockSessionRepo },
				{
					provide: getRepositoryToken(VerificationToken),
					useValue: mockVerificationTokenRepo,
				},
			],
		}).compile();

		service = module.get<AuthService>(AuthService);
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('login', () => {
		const sessionInfo = {
			ipAddress: '127.0.0.1',
			userAgent: 'jest',
			deviceName: 'Chrome on Linux',
		};
		const activeUser = {
			id: 'user-1',
			email: 'dat@test.com',
			isActive: true,
		};

		beforeEach(() => {
			jest.useFakeTimers().setSystemTime(new Date('2026-07-22T00:00:00.000Z'));
			mockTokensService.generateRefreshToken.mockResolvedValue('refresh-tok');
			mockTokensService.generateAccessToken.mockResolvedValue('access-tok');
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it('returns tokens + user and persists a session on valid credentials', async () => {
			mockUsersService.validateUser.mockResolvedValue(activeUser);

			const result = await service.login('dat@test.com', 'pw', sessionInfo);

			expect(result).toEqual({
				accessToken: 'access-tok',
				refreshToken: 'refresh-tok',
				user: activeUser,
			});
			expect(mockTokensService.generateRefreshToken).toHaveBeenCalledWith({
				email: activeUser.email,
				sub: activeUser.id,
			});
			expect(mockSessionRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					user: activeUser,
					refreshToken: 'refresh-tok',
					deviceName: sessionInfo.deviceName,
					ipAddress: sessionInfo.ipAddress,
					userAgent: sessionInfo.userAgent,
					expiresAt: new Date(Date.now() + 604800000),
				}),
			);
			expect(mockSessionRepo.save).toHaveBeenCalled();
		});

		it('throws 400 when credentials are invalid (validateUser returns null)', async () => {
			mockUsersService.validateUser.mockResolvedValue(null);

			await expect(
				service.login('dat@test.com', 'wrong', sessionInfo),
			).rejects.toThrow(new HttpException('Invalid email or password', 400));
			expect(mockSessionRepo.save).not.toHaveBeenCalled();
		});

		it('throws 400 when the validated user is missing id/email', async () => {
			mockUsersService.validateUser.mockResolvedValue({ isActive: true });

			await expect(
				service.login('dat@test.com', 'pw', sessionInfo),
			).rejects.toThrow(new HttpException('Invalid email or password', 400));
		});

		it('throws 400 when the user is inactive', async () => {
			mockUsersService.validateUser.mockResolvedValue({
				...activeUser,
				isActive: false,
			});

			await expect(
				service.login('dat@test.com', 'pw', sessionInfo),
			).rejects.toThrow(new HttpException('User is not active', 400));
			expect(mockSessionRepo.save).not.toHaveBeenCalled();
		});
	});
});
