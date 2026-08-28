import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentMethodType } from './entities/payment-method.entity';

export class CreatePaymentMethodDto {
	@IsEnum(PaymentMethodType)
	type!: PaymentMethodType;

	@IsString()
	@MaxLength(120)
	label!: string;

	/** Required when type = PHONE, ignored when type = IMAGE. Validated in the service, not here, because the field it depends on (`type`) is a sibling, not a nested shape multipart form data can express cleanly. */
	@IsOptional()
	@IsString()
	@MaxLength(20)
	phoneNumber?: string;
}
