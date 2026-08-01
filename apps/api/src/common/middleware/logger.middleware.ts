import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
	// `Request`/`Response` were unimported, so they resolved to the GLOBAL fetch
	// types from @types/node rather than express's. It happened to compile because
	// both have `method` and `url`, but the middleware was typed against an object
	// it never receives.
	use(req: Request, _res: Response, next: NextFunction) {
		Logger.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
		next();
	}
}
