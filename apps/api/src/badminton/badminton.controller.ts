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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorator/is-public.decorator';
import { requireUser } from '../common/request-user';
import { StorageService } from '../common/storage/storage.service';
import {
	CreateBadmintonSessionDto,
	QueryBadmintonSessionDto,
	UpdateBadmintonSessionDto,
} from './badminton.dto';
import { BadmintonService } from './badminton.service';

@Controller('badminton')
@ApiTags('Badminton')
@ApiBearerAuth()
export class BadmintonController {
	constructor(private readonly service: BadmintonService) {}

	@Post('/sessions')
	create(@Req() req: Request, @Body() dto: CreateBadmintonSessionDto) {
		return this.service.createSession(requireUser(req).id, dto);
	}

	@Get('/sessions')
	findAll(@Req() req: Request, @Query() query: QueryBadmintonSessionDto) {
		const { id: ownerId } = requireUser(req);
		return this.service.paginate({
			page: query.page,
			limit: query.limit,
			where: { ownerId },
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
				// The whole jsonb column, not `{ grandTotal: true }`. That projection
				// asked TypeORM to reach inside a JSON value as if it were an embedded
				// entity — behaviour that is not part of its select contract — and it
				// left the list page dereferencing `computed.rows.length` on an object
				// that may or may not have had `rows`. A few hundred bytes per row is
				// a fair price for a shape that is the same on every endpoint.
				computed: true,
			},
		});
	}

	@Get('/participants/suggest')
	suggest(@Query('q') q = '') {
		return this.service.suggestParticipants(q);
	}

	@Get('/sessions/:id')
	findOne(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
		return this.service.findOneOwned(requireUser(req).id, id);
	}

	@Patch('/sessions/:id')
	update(
		@Req() req: Request,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateBadmintonSessionDto,
	) {
		return this.service.updateSession(requireUser(req).id, id, dto);
	}

	@Delete('/sessions/:id')
	remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
		return this.service.removeSession(requireUser(req).id, id);
	}
	@Public()
	@Get('/public/:shareToken')
	findByShareToken(@Param('shareToken') shareToken: string) {
		return this.service.findByShareToken(shareToken);
	}
}
