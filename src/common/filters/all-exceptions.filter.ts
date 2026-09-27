import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

/** The one shape every error response has */
interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Catches EVERY error thrown anywhere in the app and returns a consistent,
 * safe JSON response. Internal details are logged, never sent to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message } = this.resolve(exception);

    // Path WITHOUT the query string: it may contain tokens
    const path = request.originalUrl.split('?')[0];

    // Server errors are our bugs: log full details for developers
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${path} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      error: this.statusText(status),
      message,
      path,
      timestamp: new Date().toISOString(),
    };
        // For the request-logging middleware (safe message only)
    response.locals.errorMessage = Array.isArray(message) ? message.join('; ') : message;
    response.status(status).json(body);
  }

  /** Decide the HTTP status and a SAFE message for any kind of error */
  private resolve(exception: unknown): { status: number; message: string | string[] } {
    // 1. Errors we threw on purpose (NotFoundException, ForbiddenException, ...)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        return { status, message: res };
      }
      const msg = (res as { message?: string | string[] }).message;
      return { status, message: msg ?? exception.message };
    }

    // 2. Database rule violations: map to meaningful HTTP errors
    if (exception instanceof QueryFailedError) {
      const code = (exception as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code;

      if (code === '23505') {
        return { status: HttpStatus.CONFLICT, message: 'Resource already exists' };
      }
      if (code === '23503') {
        return { status: HttpStatus.CONFLICT, message: 'Resource is referenced by other data' };
      }
      if (code === '23514') {
        return { status: HttpStatus.CONFLICT, message: 'Request violates a data rule' };
      }
    }

    // 3. Anything else is an unexpected bug: reveal nothing
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  /** 404 -> "Not Found", 409 -> "Conflict" */
  private statusText(status: number): string {
    const name = HttpStatus[status]; // e.g. 'NOT_FOUND'
    if (!name) return 'Error';
    return name
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }
}