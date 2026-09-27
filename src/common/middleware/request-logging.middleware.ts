import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { NextFunction, Request, Response } from 'express';
import { Repository } from 'typeorm';
import { ApiUsageLog } from '../../modules/usage/entities/api-usage-log.entity';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { RequestWithUsageMeta } from '../interfaces/request-usage-meta.interface';

type LoggedRequest = RequestWithUsageMeta & { user?: AuthenticatedUser };

/**
 * Writes one row to api_usage_logs for EVERY request, after the response is sent.
 * A middleware (not an interceptor) so that requests rejected by guards (401/403/429) are logged too.
 * Never stores bodies, headers, tokens or query strings.
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('RequestLog');

  constructor(@InjectRepository(ApiUsageLog) private readonly logsRepo: Repository<ApiUsageLog>) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startedAt = Date.now();
    let logged = false;

    // 'finish' = response fully sent. 'close' also covers clients that disconnect early
    // (e.g. closing a streaming chat). Log exactly once either way.
    const writeLog = () => {
      if (logged) return;
      logged = true;
      const r = req as LoggedRequest;
      const meta = r.usageMeta;

      // Route pattern (/chat/conversations/:id) when matched: groups well in analytics and hides ids
      const routePattern = (r.route as { path?: string } | undefined)?.path;
      const path = routePattern ? `${r.baseUrl ?? ''}${routePattern}` : r.originalUrl.split('?')[0];

      const errorMessage = !res.writableFinished
        ? 'Client disconnected before the response finished'
        : res.statusCode >= 400
          ? ((res.locals.errorMessage as string | undefined) ?? null)
          : null;

      // Fire-and-forget: logging must never slow down or break a response
      this.logsRepo
        .insert({
          userId: r.user?.id ?? null,
          method: r.method.slice(0, 10),
          path: path.slice(0, 500),
          statusCode: res.statusCode,
          durationMs: Date.now() - startedAt,
          ipAddress: r.ip ? r.ip.slice(0, 45) : null,
          userAgent: r.headers['user-agent']?.slice(0, 500) ?? null,
          usageType: meta?.usageType ?? null,
          providerId: meta?.providerId ?? null,
          promptTokens: meta?.promptTokens ?? null,
          completionTokens: meta?.completionTokens ?? null,
          errorMessage: errorMessage ? errorMessage.slice(0, 1000) : null,
        })
        .catch((error: unknown) => {
          this.logger.warn(`Could not write request log: ${error instanceof Error ? error.message : error}`);
        });
    };

    res.on('finish', writeLog);
    res.on('close', writeLog);

    next();
  }
}