import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentMethod } from './entities/payment-method.entity';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';
import { StorageService } from '../common/storage/storage.service';

@Module({
	imports: [TypeOrmModule.forFeature([PaymentMethod])],
	controllers: [PaymentMethodsController],
	providers: [PaymentMethodsService, StorageService],
	exports: [PaymentMethodsService],
})
export class PaymentMethodsModule {}
