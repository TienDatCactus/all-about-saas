import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { FindOptionsWhere, Repository } from 'typeorm';

@Injectable()
export class UsersQueryService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findOneBy(q: FindOptionsWhere<User>) {
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
