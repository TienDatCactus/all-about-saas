import { Controller, Get, NotFoundException, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { requireUser } from '../common/request-user';
import { UsersService } from './users.service';

/**
 * Self-service only. There is no admin user-management surface yet and the web
 * app never listed users, so exposing a list (and a by-id lookup that had to be
 * ownership-filtered) was surface with no consumer.
 *
 * When an admin screen does appear, add it back behind
 * `@UseGuards(RolesGuard) @Roles('admin')` rather than a per-object rule engine.
 */
@Controller('users')
@ApiTags('Users')
@ApiBearerAuth()
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	/** The caller's own record. The id comes from the verified JWT. */
	@Get('me')
	async me(@Req() req: Request) {
		const user = await this.usersService.findById(requireUser(req).id, {
			relations: { role: true },
		});
		if (!user) throw new NotFoundException('User not found');
		return user;
	}
}
