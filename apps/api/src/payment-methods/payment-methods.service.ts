import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageService } from '../common/storage/storage.service';
import { CreatePaymentMethodDto } from './payment-methods.dto';
import {
	PaymentMethod,
	PaymentMethodType,
} from './entities/payment-method.entity';

@Injectable()
export class PaymentMethodsService {
	constructor(
		@InjectRepository(PaymentMethod)
		private readonly repo: Repository<PaymentMethod>,
		private readonly storageService: StorageService,
	) {}

	listMine(userId: string): Promise<PaymentMethod[]> {
		return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
	}

	async create(
		userId: string,
		dto: CreatePaymentMethodDto,
		file: Express.Multer.File | undefined,
	): Promise<PaymentMethod> {
		if (dto.type === PaymentMethodType.PHONE) {
			if (!dto.phoneNumber) {
				throw new BadRequestException('phoneNumber is required for type=phone');
			}
			const entity = this.repo.create({
				userId,
				type: PaymentMethodType.PHONE,
				label: dto.label,
				phoneNumber: dto.phoneNumber,
			});
			return this.repo.save(entity);
		}

		if (!file) {
			throw new BadRequestException('file is required for type=image');
		}
		const imageUrl = await this.storageService.uploadImage(
			file.buffer,
			file.mimetype,
		);
		const entity = this.repo.create({
			userId,
			type: PaymentMethodType.IMAGE,
			label: dto.label,
			imageUrl,
		});
		return this.repo.save(entity);
	}

	async remove(userId: string, id: string): Promise<{ id: string }> {
		const result = await this.repo.delete({ id, userId });
		if (!result.affected) {
			throw new NotFoundException('Payment method not found');
		}
		return { id };
	}
}
