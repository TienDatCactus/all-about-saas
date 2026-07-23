import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	UseGuards,
} from '@nestjs/common';
import { CheckPolicies } from '../common/decorator/check-policies.decorator';
import { RegisterResource } from '../common/decorator/resource.decorator';
import { JwtAuthGuard } from '../common/guard/jwt-auth.guard';
import { PoliciesGuard } from '../common/guard/policies.guard';
import { RolesService } from './roles.service';

@RegisterResource({
	name: 'Role',
	actions: ['read', 'update'],
})
@Controller('roles')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class RolesController {
	constructor(private readonly rolesService: RolesService) {}

	@Get()
	@CheckPolicies({ action: 'read', resource: 'Role' })
	async findAll() {
		return await this.rolesService.find();
	}

	@Get(':id')
	@CheckPolicies({ action: 'read', resource: 'Role' })
	async findOne(@Param('id', ParseUUIDPipe) id: string) {
		return await this.rolesService.findById(id);
	}
}
