import { forwardRef, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from './entities/users.entity';
import { CaslModule } from '../casl/casl.module';
import { Role } from '../roles/entities/role.entity';
import { OAuthAccount } from './entities/oauth-account.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersService } from './services/users.service';
import { UsersCommandService } from './services/users-command.service';
import { UsersQueryService } from './services/users-query.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Users, Role, OAuthAccount]),
    CaslModule,

    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersCommandService, UsersQueryService],
  exports: [UsersService, UsersQueryService, UsersCommandService],
})
export class UsersModule {}
