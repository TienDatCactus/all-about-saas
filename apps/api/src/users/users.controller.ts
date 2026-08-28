import { memoryStorage } from 'multer';
import {
	Controller,
	Get,
	NotFoundException,
	Post,
	Req,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { requireUser } from '../common/request-user';
import { UsersService } from './users.service';
import { StorageService } from '../common/storage/storage.service';
import { FileInterceptor, MulterModule } from '@nestjs/platform-express';

/**
 * Self-service only. There is no admin user-management surface yet and the web
 * app never listed users, so exposing a list (and a by-id lookup that had to be
 * ownership-filtered) was surface with no consumer.
 *
 * When an admin screen does appear, add it back behind
 * `@UseGuards(RolesGuard) @Roles('admin')` rather than a per-object rule engine.
 */
@Controller('users')
@ApiTags('Users')
@ApiBearerAuth()
export class UsersController {
	constructor(
		private readonly usersService: UsersService,
		private readonly storageService: StorageService,
	) {}

	/** The caller's own record. The id comes from the verified JWT. */
	@Get('me')
	async me(@Req() req: Request) {
		const user = await this.usersService.findById(requireUser(req).id, {
			relations: { role: true },
		});
		if (!user) throw new NotFoundException('User not found');
		return user;
	}
	@Post('gallery')
	@UseInterceptors(FileInterceptor('file'))
	async uploadGalleryImage(
		@Req() req: Request,
		@UploadedFile() file: Express.Multer.File,
	) {
		const user = requireUser(req);

		const url = await this.storageService.uploadImage(
			file.buffer,
			file.mimetype,
		);

		// const image = await this.userGalleryService.create({
		// 	userId: user.id,
		// 	url,
		// });

		// return {
		// 	id: image.id,
		// 	url: image.url,
		// };
	}
}
