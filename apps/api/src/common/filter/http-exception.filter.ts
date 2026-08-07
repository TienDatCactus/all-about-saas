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

/** Narrow an unknown value to something indexable, without asserting a shape. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/** `value` when it is a string, else undefined — for reading untyped payloads. */
function asString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

/** Populated by a correlation-id middleware, if one is added upstream. */
interface TracedRequest extends Request {
	traceId?: string;
}

/**
 * The fields this filter reads off a thrown value.
 *
 * `catch(exception: any)` let every access below through unchecked, and `throw`
 * accepts anything: a rejected promise carrying a string, a plain object from a
 * third-party library, `undefined`. Everything Nest, TypeORM and Node throw is an
 * `Error`, so that is the case worth typing — but the others still have to yield
 * a response instead of a second exception raised inside the error handler.
 */
interface ThrownDetails {
	name?: string;
	message?: string;
	stack?: string;
	constructorName?: string;
}

function describeThrown(exception: unknown): ThrownDetails {
	if (exception instanceof Error) {
		return {
			name: exception.name,
			message: exception.message,
			stack: exception.stack,
			constructorName: exception.constructor.name,
		};
	}
	if (!isRecord(exception)) {
		return {};
	}
	return {
		name: asString(exception.name),
		message: asString(exception.message),
		stack: asString(exception.stack),
	};
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
	private readonly logger = new Logger(HttpExceptionFilter.name);

	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<TracedRequest>();

		const thrown = describeThrown(exception);

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
		let errorDetail: unknown = isProd ? null : (thrown.message ?? null);
		let code = 'INTERNAL_SERVER_ERROR';
		// Copied verbatim into the response, so it stays `unknown` rather than
		// claiming a shape this filter never verifies.
		let validation: unknown = undefined;

		if (exceptionResponse) {
			if (typeof exceptionResponse === 'string') {
				message = exceptionResponse;
				// `new HttpException('msg', 400)` returns its message as a plain
				// string, so this branch left `code` on its INTERNAL_SERVER_ERROR
				// default — every such 400 went out labelled as a server error, which
				// is actively misleading to a client that branches on `code`.
				code = thrown.name || 'HTTP_EXCEPTION';
			} else if (isRecord(exceptionResponse)) {
				// `message` is only taken when it really is a string. Nest's built-in
				// validation errors put a Array<string> there, which used to be written
				// straight into a field the response contract declares as `string`.
				message = asString(exceptionResponse.message) ?? message;
				code = asString(exceptionResponse.code) ?? thrown.name ?? 'BAD_REQUEST';
				validation = exceptionResponse.validation;
				errorDetail = exceptionResponse.error ?? errorDetail;
			}
		} else {
			code = thrown.constructorName || 'INTERNAL_SERVER_ERROR';
		}

		const traceId =
			request.traceId ??
			asString(request.headers['x-trace-id']) ??
			randomUUID();

		// The detail withheld above still has to land somewhere, or production
		// 500s become unreadable. traceId is what ties this line to the response
		// the user saw.
		if (status >= 500) {
			this.logger.error(
				`${request.method} ${request.url} → ${status} [${traceId}] ${thrown.message ?? 'unknown error'}`,
				thrown.stack,
			);
		}

		// A handler that already responded and then threw — an @Res() route whose
		// return value blows up downstream, an error after a stream started.
		// Writing again raises ERR_HTTP_HEADERS_SENT, and that second throw inside
		// Node's HTTP error path aborts the whole process with
		// ERR_INTERNAL_ASSERTION. So one misbehaving route took down every request
		// in flight and restart-looped the container. /health/ready did exactly
		// that; this guard is what stops the next one from being fatal too.
		if (response.headersSent) {
			this.logger.error(
				`${request.method} ${request.url} → threw AFTER responding [${traceId}]: ${
					thrown.message ?? 'unknown error'
				}`,
				thrown.stack,
			);
			return;
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
