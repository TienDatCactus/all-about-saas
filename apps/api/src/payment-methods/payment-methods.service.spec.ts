import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentMethodType } from './entities/payment-method.entity';

function mockRepo() {
	return {
		create: jest.fn((x: unknown) => x),
		save: jest.fn(async (x: unknown) => x),
		find: jest.fn(async () => []),
		findOne: jest.fn(),
		delete: jest.fn(async () => ({ affected: 1 })),
	};
}

function mockStorage() {
	return {
		uploadImage: jest.fn(async () => 'https://minio.local/x/momo-qr/abc'),
	};
}

describe('PaymentMethodsService', () => {
	let repo: ReturnType<typeof mockRepo>;
	let storage: ReturnType<typeof mockStorage>;
	let service: PaymentMethodsService;

	beforeEach(() => {
		repo = mockRepo();
		storage = mockStorage();
		service = new PaymentMethodsService(repo as never, storage);
	});

	it('create: type=phone stores the phone number, no upload call', async () => {
		const result = await service.create(
			'user-1',
			{
				type: PaymentMethodType.PHONE,
				label: 'Cá nhân',
				phoneNumber: '0338722615',
			},
			undefined,
		);
		expect(storage.uploadImage).not.toHaveBeenCalled();
		expect((result as any).phoneNumber).toBe('0338722615');
		expect((result as any).userId).toBe('user-1');
	});

	it('create: type=phone with no phoneNumber throws', async () => {
		await expect(
			service.create(
				'user-1',
				{ type: PaymentMethodType.PHONE, label: 'x' },
				undefined,
			),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('create: type=image uploads the file and stores the returned URL', async () => {
		const file = {
			buffer: Buffer.from('fake'),
			mimetype: 'image/png',
		} as Express.Multer.File;
		const result = await service.create(
			'user-1',
			{ type: PaymentMethodType.IMAGE, label: 'QR nhóm' },
			file,
		);
		expect(storage.uploadImage).toHaveBeenCalledWith(
			file.buffer,
			file.mimetype,
		);
		expect((result as any).imageUrl).toBe('https://minio.local/x/momo-qr/abc');
	});

	it('create: type=image with no file throws', async () => {
		await expect(
			service.create(
				'user-1',
				{ type: PaymentMethodType.IMAGE, label: 'x' },
				undefined,
			),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('remove: deletes only when owned by the caller', async () => {
		await service.remove('user-1', 'method-1');
		expect(repo.delete).toHaveBeenCalledWith({
			id: 'method-1',
			userId: 'user-1',
		});
	});

	it('remove: throws NotFoundException when nothing was deleted', async () => {
		repo.delete = jest.fn(async () => ({ affected: 0 }));
		await expect(service.remove('user-1', 'missing')).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});
});
