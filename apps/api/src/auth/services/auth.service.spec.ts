import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
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
	// SECONDS, matching configuration.ts. The mock previously supplied ms, which
	// the service's `* 1000` then turned into a session expiring in 2045.
	'jwt.refreshExpiresIn': 604800, // 7 days in seconds
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
	// Not a real sha256 — the tests only need it to be deterministic and to make
	// "was the hash stored instead of the token?" visible in assertions.
	hashToken: jest.fn((token: string) => `sha256(${token})`),
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
	update: jest.fn(),
	delete: jest.fn(),
};

const mockVerificationTokenRepo = {
	create: jest.fn((dto) => dto),
	save: jest.fn((entity) => Promise.resolve(entity)),
	findOne: jest.fn(),
};

/**
 * Only `refresh` (rotation) opens a transaction; `login` never touches this. The
 * callback runs against the same session-repo double, so a rotation test would
 * see the same create/save mocks.
 */
const mockDataSource = {
	transaction: jest.fn((cb: (manager: unknown) => unknown) =>
		Promise.resolve(cb({ getRepository: jest.fn(() => mockSessionRepo) })),
	),
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
				{ provide: getDataSourceToken(), useValue: mockDataSource },
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
				refreshTokenExpiresAt: new Date(Date.now() + 604800000),
				user: activeUser,
			});
			expect(mockTokensService.generateRefreshToken).toHaveBeenCalledWith({
				email: activeUser.email,
				sub: activeUser.id,
			});
			expect(mockSessionRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: activeUser.id,
					// The raw token must never reach the row.
					refreshTokenHash: 'sha256(refresh-tok)',
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

	/**
	 * Rotation and reuse detection. Verified here because the interesting cases —
	 * a token presented after it was already spent, and the concurrent-refresh race
	 * that looks identical to it — are the ones that would otherwise only show up in
	 * production as either "users randomly logged out" or "replay went undetected".
	 */
	describe('refresh', () => {
		const NOW = new Date('2026-07-22T00:00:00.000Z');
		const expiresAt = new Date('2026-07-29T00:00:00.000Z');
		const payload = { sub: 'user-1', email: 'dat@test.com' };

		const liveSession = () => ({
			id: 'sess-1',
			userId: 'user-1',
			deviceName: 'Chrome on Linux',
			userAgent: 'jest',
			ipAddress: '127.0.0.1',
			expiresAt,
			revokedAt: undefined as Date | undefined,
			rotatedAt: undefined as Date | undefined,
		});

		beforeEach(() => {
			jest.useFakeTimers().setSystemTime(NOW);
			mockTokensService.verifyRefreshToken.mockResolvedValue(payload);
			mockTokensService.generateAccessToken.mockResolvedValue('new-access-tok');
			mockTokensService.generateRefreshToken.mockResolvedValue('next-refresh');
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it('rotates: retires the presented token and issues a new one', async () => {
			const session = liveSession();
			mockSessionRepo.findOne.mockResolvedValue(session);

			const result = await service.refresh('refresh-tok');

			expect(result).toEqual({
				accessToken: 'new-access-tok',
				refreshToken: 'next-refresh',
				refreshTokenExpiresAt: expiresAt,
			});
			// Both stamps: revokedAt ends the row, rotatedAt records *why*, which is
			// what the grace window below reads.
			expect(session.revokedAt).toEqual(NOW);
			expect(session.rotatedAt).toEqual(NOW);
			expect(mockSessionRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: 'user-1',
					refreshTokenHash: 'sha256(next-refresh)',
					// Inherited, not extended: a sliding window would let a stolen token
					// be refreshed forever.
					expiresAt,
				}),
			);
		});

		it('prunes the user rows whose expiry has passed', async () => {
			mockSessionRepo.findOne.mockResolvedValue(liveSession());

			await service.refresh('refresh-tok');

			// Rotation appends a row per refresh; without this the table only grows.
			expect(mockSessionRepo.delete).toHaveBeenCalledWith(
				expect.objectContaining({ userId: 'user-1' }),
			);
		});

		it('signs the new token with only the time left on the session', async () => {
			mockSessionRepo.findOne.mockResolvedValue(liveSession());

			await service.refresh('refresh-tok');

			// 7 days from NOW to expiresAt. A full-TTL token here would outlive the
			// row that authorises it.
			expect(mockTokensService.generateRefreshToken).toHaveBeenCalledWith(
				payload,
				604800,
			);
		});

		it('serves an access token without rotating inside the grace window', async () => {
			mockSessionRepo.findOne.mockResolvedValue({
				...liveSession(),
				revokedAt: new Date(NOW.getTime() - 2000),
				rotatedAt: new Date(NOW.getTime() - 2000),
			});

			const result = await service.refresh('refresh-tok');

			// A second tab lost the race. Not theft: no new cookie, and crucially no
			// revoke-all.
			expect(result).toEqual({ accessToken: 'new-access-tok' });
			expect(mockSessionRepo.update).not.toHaveBeenCalled();
			expect(mockSessionRepo.create).not.toHaveBeenCalled();
		});

		it('revokes every session when a spent token is replayed later', async () => {
			mockSessionRepo.findOne.mockResolvedValue({
				...liveSession(),
				revokedAt: new Date(NOW.getTime() - 60_000),
				rotatedAt: new Date(NOW.getTime() - 60_000),
			});

			await expect(service.refresh('refresh-tok')).rejects.toThrow(
				'Invalid refresh token',
			);
			// Two parties hold the same token and we cannot tell which is the owner,
			// so neither keeps access.
			expect(mockSessionRepo.update).toHaveBeenCalledWith(
				expect.objectContaining({ userId: 'user-1' }),
				expect.objectContaining({ revokedAt: NOW }),
			);
		});

		it('rejects a token with no matching session', async () => {
			mockSessionRepo.findOne.mockResolvedValue(null);

			await expect(service.refresh('refresh-tok')).rejects.toThrow(
				'Invalid refresh token',
			);
			expect(mockSessionRepo.create).not.toHaveBeenCalled();
		});

		it('rejects an expired session', async () => {
			mockSessionRepo.findOne.mockResolvedValue({
				...liveSession(),
				expiresAt: new Date(NOW.getTime() - 1000),
			});

			await expect(service.refresh('refresh-tok')).rejects.toThrow(
				'Session expired',
			);
		});

		it('rejects an unverifiable token without touching the database', async () => {
			mockTokensService.verifyRefreshToken.mockRejectedValue(
				new Error('jwt malformed'),
			);

			await expect(service.refresh('nonsense')).rejects.toThrow(
				'Invalid refresh token',
			);
			expect(mockSessionRepo.findOne).not.toHaveBeenCalled();
		});
	});
});
