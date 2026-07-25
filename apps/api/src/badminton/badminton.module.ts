import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaslModule } from '../casl/casl.module';
import { User } from '../users/entities/user.entity';
import { BadmintonSession } from './entities/badminton-session.entity';
import { BadmintonParticipant } from './entities/badminton-participant.entity';
import { BadmintonService } from './badminton.service';
import { BadmintonController } from './badminton.controller';
import { BadmintonPublicController } from './badminton-public.controller';

/**
 * Badminton money-splitter module.
 *
 * Entities are registered so `autoLoadEntities` picks them up and dev-sync creates
 * their tables. `User` is needed both by the service (participant autocomplete) and
 * by PoliciesGuard (@InjectRepository(User)); CaslModule provides CaslAbilityFactory.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([BadmintonSession, BadmintonParticipant, User]),
    CaslModule,
  ],
  providers: [BadmintonService],
  controllers: [BadmintonController, BadmintonPublicController],
})
export class BadmintonModule {}
