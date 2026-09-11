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
	CreateWeeklyScheduleSlotDto,
	QueryWeeklyScheduleSlotDto,
	UpdateWeeklyScheduleSlotDto,
} from './weekly-slots.dto';
import { WeeklySlotsService } from './weekly-slots.service';

@Controller('teacher-room/slots')
@ApiTags('Teacher Room')
@ApiBearerAuth()
export class WeeklySlotsController {
	constructor(private readonly service: WeeklySlotsService) {}

	@Post()
	create(@Req() req: Request, @Body() dto: CreateWeeklyScheduleSlotDto) {
		return this.service.createSlot(requireUser(req).id, dto);
	}

	@Get()
	findAll(@Req() req: Request, @Query() query: QueryWeeklyScheduleSlotDto) {
		const { id: ownerId } = requireUser(req);
		return this.service.paginate({
			page: query.page,
			limit: query.limit,
			where: query.studentId
				? { ownerId, studentId: query.studentId }
				: { ownerId },
			// No separate student fetch on the frontend — the slot list is the
			// only place a slot's student name needs to render.
			relations: { student: true },
		});
	}

	@Get(':id')
	findOne(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
		return this.service.findOne({ id, ownerId: requireUser(req).id });
	}

	@Patch(':id')
	update(
		@Req() req: Request,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateWeeklyScheduleSlotDto,
	) {
		return this.service.updateSlot(requireUser(req).id, id, dto);
	}
}
