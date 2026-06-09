import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { OAuthAccount } from '../entities/oauth-account.entity';
import { Users } from '../entities/users.entity';
import { UsersQueryService } from './users-query.service';
import { UsersCommandService } from './users-command.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    private readonly dataSource: DataSource,
    private readonly uqService: UsersQueryService,
    private readonly ucService: UsersCommandService,
    private readonly configService: ConfigService,
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
        const password = this.configService.get<string>('basePassword');
        const passwordHash = await bcrypt.hash(password ?? providerUserId, 10);
        user = await this.ucService.create({
          email,
          password: passwordHash,
        });
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
