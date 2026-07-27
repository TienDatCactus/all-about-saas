import {
	BadRequestException,
	Injectable,
	NestMiddleware,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

// currently hardcoded within this mdw instead of env

@Injectable()
export class VersionMiddleware implements NestMiddleware {
	use(req: Request, res: Response, next: NextFunction) {
		const appVersion = req.headers['x-app-version'];
		if (!appVersion || appVersion !== '2.0.0')
			throw new BadRequestException('Invalid App Version');
		next();
	}
}
