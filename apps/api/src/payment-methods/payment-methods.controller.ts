import {
	BadRequestException,
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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
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
	// The body is multipart, not JSON: without these two the generated Swagger
	// shows an application/json schema and "Try it out" cannot attach a file at
	// all. Written as a raw schema rather than a DTO because `file` is not a
	// property of CreatePaymentMethodDto — it arrives through the interceptor.
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			required: ['type', 'label'],
			properties: {
				type: { type: 'string', enum: ['image', 'phone'] },
				label: { type: 'string', maxLength: 120 },
				/** Required when type=phone. */
				phoneNumber: { type: 'string', pattern: '^\\d{9,11}$' },
				/** Required when type=image. PNG/JPEG/WEBP, 2 MB max. */
				file: { type: 'string', format: 'binary' },
			},
		},
	})
	@UseInterceptors(
		FileInterceptor('file', {
			storage: memoryStorage(),
			limits: { fileSize: 2 * 1024 * 1024 },
			fileFilter: (_req, file, cb) => {
				if (['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
					cb(null, true);
					return;
				}
				// An error, not `cb(null, false)`. Rejecting silently dropped the file
				// and let the request continue, so the caller got the service's generic
				// "file is required for type=image" — which reads as "you forgot to
				// attach anything" when they in fact attached a PDF.
				cb(
					new BadRequestException(
						'Invalid file type — only PNG, JPEG, or WEBP allowed',
					),
					false,
				);
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
