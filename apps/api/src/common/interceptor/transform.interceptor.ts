import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
	success: boolean;
	statusCode: number;
	message: string;
	data: T | null;
	timestamp: string;
}

@Injectable()
export class TransformInterceptor<T = unknown> implements NestInterceptor<
	T,
	ApiResponse<T> | T
> {
	intercept(
		context: ExecutionContext,
		next: CallHandler<T>,
	): Observable<ApiResponse<T> | T> {
		const response = context.switchToHttp().getResponse();

		return next.handle().pipe(
			map((data) => {
				// The handler already wrote the response itself (@Res(), redirect, stream) —
				// don't wrap it or we'd corrupt the payload / double-send.
				if (response.headersSent) {
					return data;
				}

				// Read the status AFTER the handler ran, so @HttpCode(), 201 Created on POST,
				// 204, etc. are reflected instead of Express's default 200.
				const statusCode: number = response.statusCode;

				let message = 'Request successful';
				let payload: unknown = data;

				// Unwrap a `message` field only from plain objects — never arrays, or the
				// rest-spread would turn a list into an index-keyed object.
				if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
					const { message: msg, ...rest } = data as Record<string, unknown>;
					if (typeof msg === 'string') message = msg;
					// If the body was only { message }, there's no data left to return.
					payload = Object.keys(rest).length > 0 ? rest : null;
				}

				return {
					success: true,
					statusCode,
					message,
					data: (payload ?? null) as T | null,
					timestamp: new Date().toISOString(),
				};
			}),
		);
	}
}
