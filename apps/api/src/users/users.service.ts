import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { FindOptionsWhere, Repository } from 'typeorm';
import { BaseService } from '../common/services/base.service';
import { OAuthAccount, OAuthProvider } from './entities/oauth-account.entity';
import { BCRYPT_COST, User } from './entities/user.entity';

@Injectable()
export class UsersService extends BaseService<User> {
	constructor(
		@InjectRepository(User)
		usersRepository: Repository<User>,
		@InjectRepository(OAuthAccount)
		private readonly oauthAccountRepo: Repository<OAuthAccount>,
		private readonly configService: ConfigService,
	) {
		super(usersRepository);
	}

	/** Loads a user including the select:false password column, for auth flows. */
	findOneWithPassword(where: FindOptionsWhere<User>): Promise<User | null> {
		return this.findOne(where, {
			select: {
				id: true,
				email: true,
				password: true,
				isActive: true,
				emailVerified: true,
			},
		});
	}

	/**
	 * Throwaway hash, compared against when the account does not exist.
	 *
	 * Without it this method returned in well under a millisecond for an unknown
	 * address and in a few hundred (bcrypt cost 12) for a known one — a membership
	 * oracle that identical response messages do nothing to close. Built lazily and
	 * cached: it is one hash for the process lifetime, and async so the first
	 * unknown-address login doesn't stall the event loop.
	 */
	private absentUserHash?: Promise<string>;

	private getAbsentUserHash(): Promise<string> {
		this.absentUserHash ??= bcrypt.hash(
			crypto.randomBytes(32).toString('hex'),
			BCRYPT_COST,
		);
		return this.absentUserHash;
	}

	async validateUser(
		email: string,
		pass: string,
	): Promise<Partial<User> | null> {
		if (!pass) {
			return null;
		}
		const user = await this.findOneWithPassword({ email });
		if (!user?.password) {
			// Spend the same time as a real verification would before failing.
			await bcrypt.compare(pass, await this.getAbsentUserHash());
			return null;
		}
		const isMatch = await bcrypt.compare(pass, user.password);
		if (isMatch) {
			const { password: _password, ...result } = user;
			return result;
		}
		return null;
	}

	async findOrCreateOAuthUser(
		provider: string,
		providerUserId: string,
		email: string,
		profileData: any,
	): Promise<User> {
		const oauthAccount = await this.oauthAccountRepo.findOne({
			where: { provider: provider as OAuthProvider, providerUserId },
			relations: ['user'],
		});

		if (oauthAccount) {
			return oauthAccount.user;
		}

		let user = await this.findOne({ email });
		if (!user) {
			const password = this.configService.get<string>('basePassword');
			user = await this.create({
				email,
				password: password ?? providerUserId,
				emailVerified: true,
				isActive: true,
			});
		}

		const account = this.oauthAccountRepo.create({
			provider: provider as OAuthProvider,
			providerUserId,
			profileData,
			user,
		});
		await this.oauthAccountRepo.save(account);
		return user;
	}
}
