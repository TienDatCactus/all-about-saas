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
import { BadmintonService } from './badminton.service';
import {
	CreateBadmintonSessionDto,
	QueryBadmintonSessionDto,
	UpdateBadmintonSessionDto,
} from './badminton.dto';

@Controller('badminton')
@ApiTags('Badminton')
@ApiBearerAuth()
export class BadmintonController {
	constructor(private readonly service: BadmintonService) {}

	@Post('/sessions')
	create(@Req() req, @Body() dto: CreateBadmintonSessionDto) {
		return this.service.createSession(req.user.id, dto);
	}

	@Get('/sessions')
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
	suggest(@Query('q') q = '') {
		return this.service.suggestParticipants(q);
	}

	@Get('/sessions/:id')
	findOne(@Req() req, @Param('id', ParseUUIDPipe) id: string) {
		return this.service.findOneOwned(req.user.id, id);
	}

	@Patch('/sessions/:id')
	update(
		@Req() req,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateBadmintonSessionDto,
	) {
		return this.service.updateSession(req.user.id, id, dto);
	}

	@Delete('/sessions/:id')
	remove(@Req() req, @Param('id', ParseUUIDPipe) id: string) {
		return this.service.removeSession(req.user.id, id);
	}
	@Public()
	@Get('/public/:shareToken')
	findByShareToken(@Param('shareToken') shareToken: string) {
		return this.service.findByShareToken(shareToken);
	}
}
