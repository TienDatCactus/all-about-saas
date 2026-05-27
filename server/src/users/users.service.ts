import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { OAuthAccount } from './entities/oauth-account.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async createMany(users: User[]) {
    await this.dataSource.transaction(async (manager) => {
      for (const user of users) {
        await manager.save(User, user);
      }
    });
  }

  async findOneBy(q: FindOptionsWhere<User>) {
    return await this.usersRepository.findOneBy(q);
  }

  async create(data: Partial<User>) {
    const user = this.usersRepository.create(data);
    return await this.usersRepository.save(user);
  }

  async findAll() {
    return await this.usersRepository.find({
      relations: ['role'],
      select: {
        id: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: number) {
    return await this.usersRepository.findOne({
      where: { id },
      relations: ['role', 'role.permissions'],
      select: {
        id: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async findOrCreateOAuthUser(
    provider: string,
    providerUserId: string,
    email: string,
    profileData: any,
  ) {
    let oauthAccount = await this.dataSource.getRepository(OAuthAccount).findOne({
      where: { provider, providerUserId },
      relations: ['user'],
    });

    if (oauthAccount) {
      return oauthAccount.user;
    }

    let user = await this.findOneBy({ email });
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-16);
      const saltOrRounds = 10;
      const hashedPassword = await bcrypt.hash(randomPassword, saltOrRounds);
      user = await this.create({
        email,
        password: hashedPassword,
        isActive: true,
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

  async updateRole(userId: number, roleId: number) {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new Error('User not found');
    }
    // Gán role mới
    user.role = { id: roleId } as any;
    return await this.usersRepository.save(user);
  }
}
