import {
	Body,
	Controller,
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
import { requireUser } from '../common/request-user';
import {
	CancelSessionDto,
	CompleteSessionDto,
	CreateAdHocSessionDto,
	QuerySessionRangeDto,
	ReopenSessionDto,
	RescheduleSessionDto,
	SetPrioritySessionDto,
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

	@Patch(':id/reschedule')
	reschedule(
		@Req() req: Request,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: RescheduleSessionDto,
	) {
		return this.service.reschedule(requireUser(req).id, id, dto);
	}

	@Patch(':id/cancel')
	cancel(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelSessionDto) {
		return this.service.cancel(requireUser(req).id, id, dto);
	}

	@Patch(':id/complete')
	complete(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteSessionDto) {
		return this.service.complete(requireUser(req).id, id, dto);
	}

	@Patch(':id/reopen')
	reopen(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReopenSessionDto) {
		return this.service.reopen(requireUser(req).id, id, dto);
	}

	@Patch(':id/priority')
	setPriority(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetPrioritySessionDto) {
		return this.service.setPriority(requireUser(req).id, id, dto);
	}
}
