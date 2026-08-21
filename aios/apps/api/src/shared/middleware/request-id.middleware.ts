import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

declare module 'express' {
  interface Request {
    requestId: string;
  }
}

/**
 * Stamps every request with a requestId so structured logs and the client-facing
 * error envelope can be correlated (12-LOGGING-MONITORING.md, 08-ERROR-HANDLING.md).
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.headers['x-request-id'];
    req.requestId = typeof incoming === 'string' && incoming ? incoming : randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  }
}
