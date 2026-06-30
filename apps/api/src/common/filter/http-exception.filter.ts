import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { randomUUID } from 'crypto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
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

    let message = 'Internal server error';
    let errorDetail = exception?.message || null;
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

    const traceId = (request as any).traceId || request.headers['x-trace-id'] || randomUUID();

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
