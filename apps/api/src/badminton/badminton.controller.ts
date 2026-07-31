import {
	Body,
	Controller,
	Delete,
	Get,
	Logger,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
	Req,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorator/is-public.decorator';
import { RegisterResource } from '../common/decorator/resource.decorator';
import { JwtAuthGuard } from '../common/guard/jwt-auth.guard';
import { PoliciesGuard } from '../common/guard/policies.guard';
import { BadmintonService } from './badminton.service';
import {
	CreateBadmintonSessionDto,
	QueryBadmintonSessionDto,
	UpdateBadmintonSessionDto,
} from './badminton.dto';

@RegisterResource({
	name: 'BadmintonSession',
	actions: ['create', 'read', 'update', 'delete'],
})
@Controller('badminton')
@ApiTags('Badminton')
@ApiBearerAuth()
export class BadmintonController {
	constructor(private readonly service: BadmintonService) {}

	@Post('/sessions')
	@UseGuards(JwtAuthGuard)
	// @CheckPolicies({ action: 'create', resource: 'BadmintonSession' })
	create(@Req() req, @Body() dto: CreateBadmintonSessionDto) {
		return this.service.createSession(req.user.id, dto);
	}

	@Get('/sessions')
	@UseGuards(JwtAuthGuard)
	// @CheckPolicies({ action: 'read', resource: 'BadmintonSession' })
	findAll(@Req() req, @Query() query: QueryBadmintonSessionDto) {
		return this.service.paginate({
			page: query.page,
			limit: query.limit,
			where: { ownerId: req.user.id },
			order: { playedOn: 'DESC', createdAt: 'DESC' },
			relations: { participants: true },
			select: {
				id: true,
				title: true,
				playedOn: true,
				courtCost: true,
				shuttleUnitPrice: true,
				totalShuttleCount: true,
				createdAt: true,
				participants: { id: true },
				computed: {
					grandTotal: true,
				},
			},
		});
	}

	@Get('/participants/suggest')
	@UseGuards(JwtAuthGuard)
	// @CheckPolicies({ action: 'read', resource: 'BadmintonSession' })
	suggest(@Req() req, @Query('q') q = '') {
		return this.service.suggestParticipants(req.user.id, q);
	}

	@Get('/sessions/:id')
	@UseGuards(JwtAuthGuard, PoliciesGuard)
	findOne(@Req() req, @Param('id', ParseUUIDPipe) id: string) {
		return this.service.findOneOwned(req.user.id, id);
	}

	@Patch('/sessions/:id')
	@UseGuards(JwtAuthGuard, PoliciesGuard)
	update(
		@Req() req,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateBadmintonSessionDto,
	) {
		return this.service.updateSession(req.user.id, id, dto);
	}

	@Delete('/sessions/:id')
	@UseGuards(JwtAuthGuard, PoliciesGuard)
	remove(@Req() req, @Param('id', ParseUUIDPipe) id: string) {
		return this.service.removeSession(req.user.id, id);
	}
	@Public()
	@Get('/public/:shareToken')
	findByShareToken(@Param('shareToken') shareToken: string) {
		return this.service.findByShareToken(shareToken);
	}
}
