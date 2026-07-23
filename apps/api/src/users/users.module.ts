import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { CaslModule } from '../casl/casl.module';
import { Role } from '../roles/entities/role.entity';
import { OAuthAccount } from './entities/oauth-account.entity';
import { UserProfile } from './entities/user-profile.entity';
import { UsersService } from './users.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([User, Role, OAuthAccount, UserProfile]),
		CaslModule,
	],
	controllers: [UsersController],
	providers: [UsersService],
	exports: [UsersService],
})
export class UsersModule {}
