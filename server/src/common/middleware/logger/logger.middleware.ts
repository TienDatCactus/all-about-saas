import { Injectable, Logger, NestMiddleware } from '@nestjs/common';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: () => void) {
    Logger.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  }
}
