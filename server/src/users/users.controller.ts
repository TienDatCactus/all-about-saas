import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { CheckPolicies } from '../common/decorator/check-policies.decorator';
import { RegisterResource } from '../common/decorator/resource.decorator';
import { JwtAuthGuard } from '../common/guard/jwt-auth.guard';
import { PoliciesGuard } from '../common/guard/policies.guard';
import { UsersService } from './users.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@RegisterResource({
  name: 'User',
  actions: ['create', 'read', 'update', 'delete'],
})
@Controller('users')
@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @CheckPolicies({ action: 'read', resource: 'User' })
  async findAll() {
    return await this.usersService.findAll();
  }

  @Get(':id')
  @CheckPolicies({ action: 'read', resource: 'User' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findOne(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Patch(':id/role')
  @CheckPolicies({ action: 'update', resource: 'User' })
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body('roleId', ParseIntPipe) roleId: number,
  ) {
    try {
      return await this.usersService.updateRole(id, roleId);
    } catch (error) {
      throw new NotFoundException('User or Role not found');
    }
  }
}
