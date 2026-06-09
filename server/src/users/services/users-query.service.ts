import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Users } from '../entities/users.entity';
import { FindOptionsWhere, Repository } from 'typeorm';

@Injectable()
export class UsersQueryService {
  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}

  async findOneBy(q: FindOptionsWhere<Users>) {
    return await this.usersRepository.findOneBy(q);
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
}
