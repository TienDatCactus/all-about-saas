import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '../common/decorator/check-policies.decorator';
import { RegisterResource } from '../common/decorator/resource.decorator';
import { JwtAuthGuard } from '../common/guard/jwt-auth.guard';
import { PoliciesGuard } from '../common/guard/policies.guard';
import { BadmintonService } from './badminton.service';
import { CreateBadmintonSessionDto } from './dto/create-badminton-session.dto';
import { UpdateBadmintonSessionDto } from './dto/update-badminton-session.dto';

type AuthedRequest = { user: { id: string; email: string } };

@RegisterResource({
  name: 'BadmintonSession',
  actions: ['create', 'read', 'update', 'delete'],
})
@Controller('badminton/sessions')
@ApiTags('Badminton')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class BadmintonController {
  constructor(private readonly service: BadmintonService) {}

  @Post()
  @CheckPolicies({ action: 'create', resource: 'BadmintonSession' })
  create(@Req() req: AuthedRequest, @Body() dto: CreateBadmintonSessionDto) {
    return this.service.create(req.user.id, dto);
  }

  @Get()
  @CheckPolicies({ action: 'read', resource: 'BadmintonSession' })
  findAll(@Req() req: AuthedRequest) {
    return this.service.findAllByOwner(req.user.id);
  }

  // Declared before ':id' so the static path wins the route match.
  @Get('suggest')
  @CheckPolicies({ action: 'read', resource: 'BadmintonSession' })
  suggest(@Req() req: AuthedRequest, @Query('q') q = '') {
    return this.service.suggestParticipants(req.user.id, q);
  }

  @Get(':id')
  @CheckPolicies({ action: 'read', resource: 'BadmintonSession' })
  findOne(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOneOwned(req.user.id, id);
  }

  @Patch(':id')
  @CheckPolicies({ action: 'update', resource: 'BadmintonSession' })
  update(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBadmintonSessionDto,
  ) {
    return this.service.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @CheckPolicies({ action: 'delete', resource: 'BadmintonSession' })
  remove(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(req.user.id, id);
  }
}
