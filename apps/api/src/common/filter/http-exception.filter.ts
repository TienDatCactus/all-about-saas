import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

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

    if (exceptionResponse) {
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        // Handle standard NestJS exception response or class-validator messages
        const resMessage = (exceptionResponse as any).message;
        message = Array.isArray(resMessage)
          ? resMessage[0]
          : resMessage || message;
        errorDetail = (exceptionResponse as any).error || errorDetail;
      }
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error: errorDetail,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
