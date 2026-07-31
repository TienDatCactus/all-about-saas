import {
	ExceptionFilter,
	Catch,
	ArgumentsHost,
	HttpException,
	HttpStatus,
	Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { randomUUID } from 'crypto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
	private readonly logger = new Logger(HttpExceptionFilter.name);

	catch(exception: any, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();

		const status =
			exception instanceof HttpException
				? exception.getStatus()
				: HttpStatus.INTERNAL_SERVER_ERROR;

		const exceptionResponse =
			exception instanceof HttpException ? exception.getResponse() : null;

		const isProd = process.env.NODE_ENV === 'production';

		let message = 'Internal server error';
		// Unhandled errors carry driver internals — TypeORM query text, pg
		// constraint names, file paths. Useful in a log, never in a response, so
		// production keeps the detail server-side and clients get the traceId.
		let errorDetail = isProd ? null : (exception?.message ?? null);
		let code = 'INTERNAL_SERVER_ERROR';
		let validation = undefined;

		if (exceptionResponse) {
			if (typeof exceptionResponse === 'string') {
				message = exceptionResponse;
			} else if (typeof exceptionResponse === 'object') {
				const obj = exceptionResponse as any;
				message = obj.message || message;
				code = obj.code || exception.name || 'BAD_REQUEST';
				validation = obj.validation;
				errorDetail = obj.error || errorDetail;
			}
		} else {
			code = exception?.constructor?.name || 'INTERNAL_SERVER_ERROR';
		}

		const traceId =
			(request as any).traceId || request.headers['x-trace-id'] || randomUUID();

		// The detail withheld above still has to land somewhere, or production
		// 500s become unreadable. traceId is what ties this line to the response
		// the user saw.
		if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
			this.logger.error(
				`${request.method} ${request.url} → ${status} [${traceId}] ${exception?.message ?? 'unknown error'}`,
				exception?.stack,
			);
		}

		response.status(status).json({
			success: false,
			statusCode: status,
			code,
			message,
			error: errorDetail,
			validation,
			timestamp: new Date().toISOString(),
			path: request.url,
			traceId,
		});
	}
}
