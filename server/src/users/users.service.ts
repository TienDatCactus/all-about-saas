import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

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
}
