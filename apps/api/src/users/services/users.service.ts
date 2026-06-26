import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { OAuthAccount, OAuthProvider } from "../entities/oauth-account.entity";
import { User } from "../entities/user.entity";
import { UsersQueryService } from "./users-query.service";
import { UsersCommandService } from "./users-command.service";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly uqService: UsersQueryService,
    private readonly ucService: UsersCommandService,
    private readonly configService: ConfigService,
    @InjectRepository(OAuthAccount)
    private readonly oauthAccountRepo: Repository<OAuthAccount>,
  ) {}

  async findOrCreateOAuthUser(
    provider: string,
    providerUserId: string,
    email: string,
    profileData: any,
  ) {
    let oauthAccount = await this.oauthAccountRepo.findOne({
      where: { provider: provider as OAuthProvider, providerUserId },
      relations: ["user"],
    });

    if (oauthAccount) {
      return oauthAccount.user;
    } else {
      let user = await this.uqService.findOneBy({ email });
      if (!user) {
        const password = this.configService.get<string>("basePassword");
        const passwordHash = await bcrypt.hash(password ?? providerUserId, 10);
        user = await this.ucService.create({
          email,
          password: passwordHash,
          emailVerified: true,
          isActive: true,
        });
      }
      oauthAccount = this.oauthAccountRepo.create({
        provider: provider as OAuthProvider,
        providerUserId,
        profileData,
        user,
      });
      await this.oauthAccountRepo.save(oauthAccount);
      return user;
    }
  }
}
