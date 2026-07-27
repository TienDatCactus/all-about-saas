import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Query,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '../common/decorator/check-policies.decorator';
import { RegisterResource } from '../common/decorator/resource.decorator';
import { JwtAuthGuard } from '../common/guard/jwt-auth.guard';
import { PoliciesGuard } from '../common/guard/policies.guard';
import { UsersService } from './users.service';
import { QueryUsersDto } from './users.dto';

@RegisterResource({
	name: 'User',
	actions: ['create', 'read', 'update', 'delete'],
})
@Controller('users')
@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class UsersController {
	constructor(private readonly usersService: UsersService) {} // no repo

	@Get()
	@CheckPolicies({ action: 'read', resource: 'User' })
	findAll(@Query() query: QueryUsersDto) {
		return this.usersService.paginate({
			...query,
			relations: { role: true },
		});
	}

	@Get(':id')
	@CheckPolicies({ action: 'read', resource: 'User' })
	findOne(@Param('id', ParseUUIDPipe) id: string) {
		return this.usersService.findById(id, { relations: { role: true } });
	}
}
