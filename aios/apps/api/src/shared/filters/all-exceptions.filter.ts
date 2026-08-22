import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { logStructured } from '../logging/structured-log';

/**
 * Standard error envelope per 08-ERROR-HANDLING.md:
 *   { success: false, error: { code, message, requestId, details? } }
 *
 * `message` is always safe/human-readable — no stack traces, SQL, or file paths ever
 * reach the client, in every environment including staging (08 §"Unexpected errors").
 */
interface ErrorBody {
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
}

const DEFAULT_CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
  502: 'UPSTREAM_SERVICE_ERROR',
  504: 'UPSTREAM_TIMEOUT',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request.requestId ?? 'unknown';

    const { status, body } = this.resolve(exception, requestId);
    const user = (request as Request & { user?: { id?: string; instituteId?: string } }).user;

    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      // 07-SECURITY-SPECIFICATION.md §12 / 12-LOGGING-MONITORING.md §3: ids
      // only, never PII or request-body content, in what's sent to Sentry.
      Sentry.captureException(exception, {
        tags: { requestId, route: `${request.method} ${request.url}`, errorCode: body.code },
        user: user?.id ? { id: user.id } : undefined,
        extra: { instituteId: user?.instituteId },
      });
    } else {
      this.logger.warn(`[${requestId}] ${request.method} ${request.url} -> ${status} ${body.code}`);
    }

    // 12-LOGGING-MONITORING.md §2 — machine-parseable line alongside the
    // human-readable one above, for a log aggregator to correlate by requestId.
    logStructured(status >= 500 ? 'error' : 'warn', {
      service: 'api',
      requestId,
      instituteId: user?.instituteId,
      userId: user?.id,
      route: `${request.method} ${request.url}`,
      errorCode: body.code,
    });

    response.status(status).json({ success: false, error: body });
  }

  private resolve(exception: unknown, requestId: string): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      // Domain exceptions may throw HttpException(new SomeError({ code, message, details }), status)
      // with a structured payload; fall back to a status-derived default code otherwise.
      if (typeof payload === 'object' && payload !== null) {
        const p = payload as Record<string, unknown>;
        const code =
          (p.code as string | undefined) ??
          DEFAULT_CODE_BY_STATUS[status] ??
          'ERROR';
        const message =
          (p.message as string | string[] | undefined) ?? exception.message;
        const details = p.fields ?? p.rows ?? p.details;
        return {
          status,
          body: {
            code,
            message: Array.isArray(message) ? message.join('; ') : message,
            requestId,
            ...(details !== undefined ? { details } : {}),
          },
        };
      }

      return {
        status,
        body: {
          code: DEFAULT_CODE_BY_STATUS[status] ?? 'ERROR',
          message: exception.message,
          requestId,
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          body: {
            code: 'DUPLICATE_RECORD',
            message: 'A record with this value already exists.',
            requestId,
            details: { target: exception.meta?.target },
          },
        };
      }
      if (exception.code === 'P2003') {
        return {
          status: HttpStatus.BAD_REQUEST,
          body: {
            code: 'INVALID_REFERENCE',
            message: 'This request references a record that does not exist.',
            requestId,
          },
        };
      }
      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          body: { code: 'NOT_FOUND', message: 'Record not found.', requestId },
        };
      }
    }

    // Unknown/unexpected — never leak internals, even in staging.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', requestId },
    };
  }
}
