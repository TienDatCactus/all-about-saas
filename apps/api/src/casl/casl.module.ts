import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from './entities/permission.entity';
import { ResourceRegistry } from './entities/resource-registry.entity';
import { CaslAbilityFactory } from './ability.factory';

@Module({
	imports: [TypeOrmModule.forFeature([Permission, ResourceRegistry])],
	exports: [TypeOrmModule, CaslAbilityFactory],
	providers: [CaslAbilityFactory],
})
export class CaslModule {}
