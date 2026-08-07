import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ROLES_KEY } from '../decorator/roles.decorator';
import { User } from '../../users/entities/user.entity';

/**
 * Coarse role check — "is this user an admin", nothing finer.
 *
 * This replaces the CASL/permission layer. Ownership ("is this row yours") is
 * deliberately NOT here: a guard only sees the request, so it cannot answer a
 * question about a row it has not loaded. Ownership belongs in the service
 * query (`where: { id, ownerId }`), which is where badminton has always done it.
 */
@Injectable()
export class RolesGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		@InjectRepository(User) private readonly userRepository: Repository<User>,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const required = this.reflector.getAllAndOverride<Array<string>>(
			ROLES_KEY,
			[context.getHandler(), context.getClass()],
		);
		// No @Roles on the route → nothing for this guard to decide.
		if (!required || required.length === 0) return true;

		const request = context.switchToHttp().getRequest();
		if (!request.user?.id) return false;

		// The JWT payload carries only { id, email }, so the role has to be read.
		const user = await this.userRepository.findOne({
			where: { id: request.user.id },
			relations: { role: true },
		});
		const roleName = user?.role?.name;
		return roleName ? required.includes(roleName) : false;
	}
}
