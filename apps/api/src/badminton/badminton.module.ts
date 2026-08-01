import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { BadmintonSession } from './entities/badminton-session.entity';
import { BadmintonParticipant } from './entities/badminton-participant.entity';
import { BadmintonService } from './badminton.service';
import { BadmintonController } from './badminton.controller';

/**
 * Badminton money-splitter module.
 *
 * Entities are registered so `autoLoadEntities` picks them up and dev-sync creates
 * their tables. `User` is needed both by the service (participant autocomplete) and
 * by RolesGuard (@InjectRepository(User)).
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([BadmintonSession, BadmintonParticipant, User]),
	],
	providers: [BadmintonService],
	controllers: [BadmintonController],
})
export class BadmintonModule {}
