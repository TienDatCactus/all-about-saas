import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Req,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { requireUser } from '../common/request-user';
import { CreatePaymentMethodDto } from './payment-methods.dto';
import { PaymentMethodsService } from './payment-methods.service';

@Controller('payment-methods')
@ApiTags('Payment Methods')
@ApiBearerAuth()
export class PaymentMethodsController {
	constructor(private readonly service: PaymentMethodsService) {}

	@Get()
	list(@Req() req: Request) {
		return this.service.listMine(requireUser(req).id);
	}

	@Post()
	@UseInterceptors(
		FileInterceptor('file', {
			storage: memoryStorage(),
			limits: { fileSize: 2 * 1024 * 1024 },
			fileFilter: (_req, file, cb) => {
				cb(null, ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype));
			},
		}),
	)
	create(
		@Req() req: Request,
		@Body() dto: CreatePaymentMethodDto,
		@UploadedFile() file?: Express.Multer.File,
	) {
		return this.service.create(requireUser(req).id, dto, file);
	}

	@Delete(':id')
	remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
		return this.service.remove(requireUser(req).id, id);
	}
}
