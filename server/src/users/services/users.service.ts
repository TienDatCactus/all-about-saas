import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { OAuthAccount } from '../entities/oauth-account.entity';
import { Users } from '../entities/users.entity';
import { AuthService } from '../../auth/auth.service';
import { UsersQueryService } from './users-query.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    private readonly uqService: UsersQueryService,
  ) {}

  async findOrCreateOAuthUser(
    provider: string,
    providerUserId: string,
    email: string,
    profileData: any,
  ) {
    let oauthAccount = await this.dataSource
      .getRepository(OAuthAccount)
      .findOne({
        where: { provider, providerUserId },
        relations: ['user'],
      });

    if (oauthAccount) {
      return oauthAccount.user;
    } else {
      let user = await this.uqService.findOneBy({ email });
      if (!user) {
        user = await this.authService.signup(email);
      }
      oauthAccount = this.dataSource.getRepository(OAuthAccount).create({
        provider,
        providerUserId,
        profileData,
        user,
      });
      await this.dataSource.getRepository(OAuthAccount).save(oauthAccount);
      return user;
    }
  }
}
