import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RESPONSE_MESSAGE_KEY } from '../decorator/response-message.decorator';

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
	constructor(private readonly reflector?: Reflector) {}

	intercept(
		context: ExecutionContext,
		next: CallHandler<T>,
	): Observable<ApiResponse<T> | T> {
		const response = context.switchToHttp().getResponse();
		const declaredMessage = this.reflector?.get<string | undefined>(
			RESPONSE_MESSAGE_KEY,
			context.getHandler(),
		);

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

				let message = declaredMessage ?? 'Request successful';
				let payload: unknown = data;

				// A `message` in the return value is promoted to the envelope only when
				// it is the *whole* return value — the codebase's idiom for "an
				// acknowledgement, no data".
				//
				// It used to be lifted out of any object, which meant a resource with a
				// legitimate `message` field (a note, a log line, a chat entry) had it
				// silently deleted from the payload and pasted over the envelope text.
				// Handlers that want a custom message alongside real data use
				// @ResponseMessage() instead.
				if (
					!declaredMessage &&
					data !== null &&
					typeof data === 'object' &&
					!Array.isArray(data)
				) {
					const keys = Object.keys(data);
					const msg = (data as Record<string, unknown>).message;
					if (keys.length === 1 && typeof msg === 'string') {
						message = msg;
						payload = null;
					}
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
