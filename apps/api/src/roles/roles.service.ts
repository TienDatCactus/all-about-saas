import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../common/services/base.service';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesService extends BaseService<Role> {
	constructor(
		@InjectRepository(Role)
		roleRepository: Repository<Role>,
	) {
		super(roleRepository);
	}
}
