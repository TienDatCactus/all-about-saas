import {
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { requireUser } from '../common/request-user';
import {
	CreateAdHocSessionDto,
	QuerySessionRangeDto,
} from './teaching-sessions.dto';
import { TeachingSessionsService } from './teaching-sessions.service';

@Controller('teacher-room/sessions')
@ApiTags('Teacher Room')
@ApiBearerAuth()
export class TeachingSessionsController {
	constructor(private readonly service: TeachingSessionsService) {}

	@Get()
	findInRange(@Req() req: Request, @Query() query: QuerySessionRangeDto) {
		return this.service.findInRange(requireUser(req).id, query.from, query.to);
	}

	@Get('pending-today')
	pendingToday(@Req() req: Request) {
		return this.service.pendingToday(requireUser(req).id);
	}

	@Get(':id/history')
	history(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
		return this.service.history(requireUser(req).id, id);
	}

	@Post()
	createAdHoc(@Req() req: Request, @Body() dto: CreateAdHocSessionDto) {
		return this.service.createAdHoc(requireUser(req).id, dto);
	}
}
