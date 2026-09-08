import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Student } from './entities/student.entity';
import { WeeklyScheduleSlot } from './entities/weekly-schedule-slot.entity';
import { TeachingSession } from './entities/teaching-session.entity';
import { TeachingSessionHistory } from './entities/teaching-session-history.entity';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { WeeklySlotsService } from './weekly-slots.service';
import { WeeklySlotsController } from './weekly-slots.controller';
import { TeachingSessionsService } from './teaching-sessions.service';
import { TeachingSessionsController } from './teaching-sessions.controller';
import { MailModule } from '../mail/mail.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			Student,
			WeeklyScheduleSlot,
			TeachingSession,
			TeachingSessionHistory,
			User,
		]),
		MailModule,
	],
	providers: [StudentsService, WeeklySlotsService, TeachingSessionsService],
	controllers: [
		StudentsController,
		WeeklySlotsController,
		TeachingSessionsController,
	],
})
export class TeacherRoomModule {}
