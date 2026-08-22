import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { logStructured } from '../logging/structured-log';

/**
 * 12-LOGGING-MONITORING.md §4: "Every mutating API request: route, actor,
 * instituteId, duration, outcome." This covers the success path; AllExceptionsFilter
 * covers the failure path (own structured log call there) so nothing is double-logged.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        // GETs are high-volume and low-signal for this log — doc 12 §4 calls
        // out "every mutating API request" specifically, not reads.
        if (req.method === 'GET') return;

        logStructured('info', {
          service: 'api',
          requestId: req.requestId,
          instituteId: req.user?.instituteId,
          userId: req.user?.id,
          route: `${req.method} ${req.route?.path ?? req.url}`,
          durationMs: Date.now() - start,
        });
      }),
    );
  }
}
