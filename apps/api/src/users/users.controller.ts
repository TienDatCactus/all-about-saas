import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '../common/decorator/check-policies.decorator';
import { RegisterResource } from '../common/decorator/resource.decorator';
import { JwtAuthGuard } from '../common/guard/jwt-auth.guard';
import { PoliciesGuard } from '../common/guard/policies.guard';
import { UsersCommandService } from './services/users-command.service';
import { UsersQueryService } from './services/users-query.service';

@RegisterResource({
  name: 'User',
  actions: ['create', 'read', 'update', 'delete'],
})
@Controller('users')
@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class UsersController {
  constructor(
    private readonly ucService: UsersCommandService,
    private readonly uqService: UsersQueryService,
  ) {}

  @Get()
  @CheckPolicies({ action: 'read', resource: 'User' })
  async findAll() {
    return await this.uqService.findAll();
  }
}
