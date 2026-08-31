import {
	IsEnum,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
} from 'class-validator';
import { PaymentMethodType } from './entities/payment-method.entity';

export class CreatePaymentMethodDto {
	@IsEnum(PaymentMethodType)
	type!: PaymentMethodType;

	@IsString()
	@MaxLength(120)
	label!: string;

	/**
	 * Required when type = PHONE, ignored when type = IMAGE. *Whether* it is
	 * required is checked in the service, not here, because the field it depends
	 * on (`type`) is a sibling, not a nested shape multipart form data can express
	 * cleanly. Its *shape* is checked here: the value is interpolated straight
	 * into a `nhantien.momo.vn/{phone}` link on the share page, so anything but
	 * digits either produces a dead link or smuggles extra path/query segments
	 * into the URL. Digits only, no country code — the format nhantien.momo.vn
	 * itself uses.
	 */
	@IsOptional()
	@IsString()
	@Matches(/^\d{9,11}$/, {
		message: 'phoneNumber must be 9-11 digits, with no spaces or country code',
	})
	@MaxLength(20)
	phoneNumber?: string;
}
