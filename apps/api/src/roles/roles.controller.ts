import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	UseGuards,
} from '@nestjs/common';
import { Roles } from '../common/decorator/roles.decorator';
import { RolesGuard } from '../common/guard/roles.guard';
import { RolesService } from './roles.service';

/**
 * Role lookup, admin-only. Authentication comes from the global JwtAuthGuard, so
 * this controller only adds the coarse role requirement.
 */
@Controller('roles')
@UseGuards(RolesGuard)
@Roles('admin')
export class RolesController {
	constructor(private readonly rolesService: RolesService) {}

	@Get()
	async findAll() {
		return await this.rolesService.find();
	}

	@Get(':id')
	async findOne(@Param('id', ParseUUIDPipe) id: string) {
		return await this.rolesService.findById(id);
	}
}
