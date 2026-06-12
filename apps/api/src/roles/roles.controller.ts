import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CheckPolicies } from '../common/decorator/check-policies.decorator';
import { RegisterResource } from '../common/decorator/resource.decorator';
import { JwtAuthGuard } from '../common/guard/jwt-auth.guard';
import { PoliciesGuard } from '../common/guard/policies.guard';
import { Permission } from '../casl/entities/permission.entity';

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
    return await this.rolesService.findAll();
  }

  @Get(':id')
  @CheckPolicies({ action: 'read', resource: 'Role' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.rolesService.findOne(id);
  }

  @Patch(':id/permissions')
  @CheckPolicies({ action: 'update', resource: 'Role' })
  async updatePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body('permissions') permissions: Partial<Permission>[],
  ) {
    return await this.rolesService.updatePermissions(id, permissions);
  }
}
