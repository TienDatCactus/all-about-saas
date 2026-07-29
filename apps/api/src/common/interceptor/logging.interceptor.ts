import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const { statusCode } = context.switchToHttp().getResponse();
          this.logger.log(
            `${method} ${url} ${statusCode} +${Date.now() - startedAt}ms`,
          );
        },
        error: (err: { status?: number; message?: string }) => {
          const status = err?.status ?? 500;
          this.logger.error(
            `${method} ${url} ${status} +${Date.now() - startedAt}ms - ${
              err?.message ?? err
            }`,
          );
        },
      }),
    );
  }
}
