import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const statusCode = response.statusCode;
    return next.handle().pipe(
      map((data) => {
        if (response.headersSent) {
          return data;
        }
        let message = 'Request successful';
        let actualData = data;
        if (data && typeof data === 'object') {
          const { message: msg, ...rest } = data;
          if (msg) message = msg;
          actualData = Object.keys(rest).length > 0 ? rest : (data ?? null);
        }
        return {
          success: true,
          statusCode,
          message,
          data: actualData ?? null,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
