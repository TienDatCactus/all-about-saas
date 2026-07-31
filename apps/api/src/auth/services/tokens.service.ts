import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions, JwtVerifyOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PayloadDto } from '../dto/jwt-payload.dto';
import { ConfigService } from '@nestjs/config';

export interface GeneratedToken {
	rawToken: string;
	tokenHash: string;
}

@Injectable()
export class TokensService {
	constructor(
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
	) {}

	// ==========================================
	// JWT Support
	// ==========================================

	async signJwt(payload: any, options?: JwtSignOptions): Promise<string> {
		// Strip reserved claims so a re-signed (previously decoded) payload can't
		// clash with `expiresIn`/`notBefore` — jsonwebtoken throws if both are set.
		const { exp, iat, nbf, ...rest } = payload ?? {};
		void exp;
		void iat;
		void nbf;
		return this.jwtService.signAsync(rest, options);
	}

	async verifyJwt(token: string, options?: JwtVerifyOptions): Promise<any> {
		return this.jwtService.verifyAsync(token, options);
	}

	async generateAccessToken(payload: PayloadDto): Promise<string> {
		return this.signJwt(payload, {
			expiresIn: Number(this.configService.get<string>('jwt.expiresIn')!),
		});
	}

	/**
	 * @param expiresInSeconds overrides the configured TTL. Rotation passes the
	 * *remaining* lifetime of the session so the token cannot outlive its row.
	 */
	async generateRefreshToken(
		payload: PayloadDto,
		expiresInSeconds?: number,
	): Promise<string> {
		return this.signJwt(
			{
				...payload,
				// HS256 is deterministic, so two refresh tokens minted for the same
				// user in the same second were byte-identical — two logins a moment
				// apart produced one token and two rows claiming it. `jti` makes every
				// token unique, which is also what lets refreshTokenHash be a unique
				// index and lets a single session be identified for revocation.
				jti: crypto.randomUUID(),
			},
			{
				expiresIn:
					expiresInSeconds ??
					Number(this.configService.get<string>('jwt.refreshExpiresIn')!),
			},
		);
	}

	async verifyRefreshToken(token: string): Promise<PayloadDto> {
		return this.verifyJwt(token);
	}

	// ==========================================
	// Hashing Support
	// ==========================================

	async comparePassword(password: string, hash: string): Promise<boolean> {
		return bcrypt.compare(password, hash);
	}

	// fast hash for high-entropy tokens using sha256
	hashToken(token: string): string {
		return crypto.createHash('sha256').update(token).digest('hex');
	}

	compareToken(token: string, hash: string): boolean {
		const hashed = this.hashToken(token);
		const hashedBuf = Buffer.from(hashed, 'hex');
		const hashBuf = Buffer.from(hash, 'hex');
		if (hashedBuf.length !== hashBuf.length) {
			return false;
		}
		return crypto.timingSafeEqual(hashedBuf, hashBuf);
	}

	// Generic helpers as requested
	async hash(value: string): Promise<string> {
		return this.hashToken(value);
	}

	async compare(value: string, hash: string): Promise<boolean> {
		return this.compareToken(value, hash);
	}

	// ==========================================
	// Verification Token Factory
	// ==========================================

	async createVerificationToken(): Promise<GeneratedToken> {
		const rawToken = crypto.randomBytes(32).toString('base64url');
		const tokenHash = await this.hash(rawToken);
		return {
			rawToken,
			tokenHash,
		};
	}

	async verifyToken(rawToken: string, tokenHash: string): Promise<boolean> {
		return this.compare(rawToken, tokenHash);
	}
}
