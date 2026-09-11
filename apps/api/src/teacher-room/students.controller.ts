import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { requireUser } from '../common/request-user';
import { StudentsService } from './students.service';

@Controller('teacher-room/students')
@ApiTags('Teacher Room')
@ApiBearerAuth()
export class StudentsController {
	constructor(private readonly service: StudentsService) {}

	@Get('suggest')
	suggest(@Req() req: Request, @Query('q') q = '') {
		return this.service.suggest(requireUser(req).id, q);
	}
}
