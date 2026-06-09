// CREAT-UPDATE_DELETE

import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Users } from '../entities/users.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuthAccount } from '../entities/oauth-account.entity';
import { UsersQueryService } from './users-query.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersCommandService {
  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    private readonly uqService: UsersQueryService,
    private readonly dataSource: DataSource,
  ) {}
  async createMany(dto: Users[]) {
    await this.dataSource.transaction(async (manager) => {
      for (const user of dto) {
        await manager.save(Users, user);
      }
    });
  }
  async create(dto: Partial<Users>) {
    const user = this.usersRepository.create(dto);
    return await this.usersRepository.save(user);
  }
  async createOAuthUser(dto: Partial<OAuthAccount>) {
    const user = this.dataSource.getRepository(OAuthAccount).create({
      ...dto,
    });

    return this.dataSource.getRepository(OAuthAccount).save(user);
  }
  async validateUser(email: string, pass: string): Promise<any> {
    if (!pass) {
      return null;
    }
    const user = await this.uqService.findOneBy({ email });
    if (user?.password) {
      const isMatch = await bcrypt.compare(pass, user.password);
      if (isMatch) {
        const { password, ...result } = user;
        return result;
      }
    }
    return null;
  }
}
