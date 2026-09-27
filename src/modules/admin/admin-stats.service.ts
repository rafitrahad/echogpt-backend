import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { ProviderHealth } from '../../common/enums';
import { AiProvider } from '../providers/entities/ai-provider.entity';
import { ApiUsageLog } from '../usage/entities/api-usage-log.entity';
import { AdminLogsQueryDto } from './dto/admin-query.dto';
import {
  DailyUsageDto,
  DashboardStatsDto,
  EndpointUsageDto,
  ProviderStatusDto,
  ProviderUsageDto,
  RequestLogDto,
  SystemHealthDto,
  UsageAnalyticsDto,
} from './dto/admin-response.dto';

/** Postgres returns COUNT/SUM as strings (bigint): convert every value to a number */
function toNumbers<T>(row: Record<string, unknown>, keep: string[] = []): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = keep.includes(key) || value === null ? value : Number(value);
  }
  return out as T;
}

@Injectable()
export class AdminStatsService {
  private readonly timezone: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @InjectRepository(AiProvider) private readonly providersRepo: Repository<AiProvider>,
    @InjectRepository(ApiUsageLog) private readonly logsRepo: Repository<ApiUsageLog>,
  ) {
    this.timezone = this.config.getOrThrow<string>('APP_TIMEZONE');
  }

  // ─────────────────────────── Dashboard ───────────────────────────

  async dashboard(): Promise<DashboardStatsDto> {
    const [counts] = await this.dataSource.query(
      `WITH today AS (SELECT date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1 AS start)
       SELECT
         (SELECT COUNT(*) FROM users)                                                    AS "totalUsers",
         (SELECT COUNT(*) FROM users WHERE is_active)                                    AS "activeUsers",
         (SELECT COUNT(*) FROM users, today WHERE created_at >= today.start)             AS "newUsersToday",
         (SELECT COUNT(*) FROM users WHERE created_at >= now() - interval '7 days')      AS "newUsersLast7Days",
         (SELECT COUNT(*) FROM api_usage_logs, today WHERE created_at >= today.start)    AS "requestsToday",
         (SELECT COUNT(*) FROM api_usage_logs, today
            WHERE created_at >= today.start AND usage_type = 'CHAT' AND status_code < 400)   AS "chatRequestsToday",
         (SELECT COUNT(*) FROM api_usage_logs, today
            WHERE created_at >= today.start AND usage_type = 'SEARCH' AND status_code < 400) AS "searchRequestsToday",
         (SELECT COUNT(*) FROM api_usage_logs, today
            WHERE created_at >= today.start AND status_code >= 500)                      AS "serverErrorsToday",
         (SELECT COALESCE(ROUND(AVG(duration_ms)), 0) FROM api_usage_logs, today
            WHERE created_at >= today.start)                                             AS "avgResponseMsToday",
         (SELECT COALESCE(SUM(COALESCE(prompt_tokens, 0) + COALESCE(completion_tokens, 0)), 0)
            FROM api_usage_logs, today WHERE created_at >= today.start)                  AS "tokensToday",
         (SELECT COUNT(*) FROM conversations)                                            AS "totalConversations",
         (SELECT COUNT(*) FROM messages)                                                 AS "totalMessages",
         (SELECT COUNT(*) FROM web_searches)                                             AS "totalSearches",
         (SELECT COALESCE(SUM(hit_count), 0) FROM search_cache)                          AS "cacheHitsTotal"`,
      [this.timezone],
    );

    const plans: { planCode: string; activeSubscriptions: string }[] = await this.dataSource.query(
      `SELECT p.code AS "planCode", COUNT(s.id) AS "activeSubscriptions"
       FROM plans p
       LEFT JOIN subscriptions s ON s.plan_id = p.id AND s.status = 'ACTIVE'
       GROUP BY p.code, p.price_cents
       ORDER BY p.price_cents`,
    );

    return {
      ...toNumbers<Omit<DashboardStatsDto, 'subscriptionsByPlan' | 'providers' | 'timezone'>>(counts),
      subscriptionsByPlan: plans.map((p) => ({
        planCode: p.planCode,
        activeSubscriptions: Number(p.activeSubscriptions),
      })),
      providers: await this.providerStatuses(),
      timezone: this.timezone,
    };
  }

  // ─────────────────────────── Usage analytics ───────────────────────────

  async analytics(days: number): Promise<UsageAnalyticsDto> {
    const daily: Record<string, unknown>[] = await this.dataSource.query(
      `WITH days AS (
         SELECT generate_series(
           date_trunc('day', now() AT TIME ZONE $1) - ($2::int - 1) * interval '1 day',
           date_trunc('day', now() AT TIME ZONE $1),
           interval '1 day'
         ) AS day
       )
       SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
              COUNT(l.id) AS requests,
              COUNT(l.id) FILTER (WHERE l.usage_type = 'CHAT' AND l.status_code < 400)   AS chat,
              COUNT(l.id) FILTER (WHERE l.usage_type = 'SEARCH' AND l.status_code < 400) AS search,
              COUNT(l.id) FILTER (WHERE l.status_code >= 400) AS errors,
              COALESCE(SUM(COALESCE(l.prompt_tokens, 0) + COALESCE(l.completion_tokens, 0)), 0) AS tokens
       FROM days d
       LEFT JOIN api_usage_logs l
         ON l.created_at >= d.day AT TIME ZONE $1
        AND l.created_at <  (d.day + interval '1 day') AT TIME ZONE $1
       GROUP BY d.day
       ORDER BY d.day`,
      [this.timezone, days],
    );

    const since = `now() - ($1::int * interval '1 day')`;

    const byProvider: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT l.provider_id AS "providerId",
              COALESCE(p.name, '(deleted provider)') AS name,
              COUNT(*) AS requests,
              COALESCE(SUM(l.prompt_tokens), 0) AS "promptTokens",
              COALESCE(SUM(l.completion_tokens), 0) AS "completionTokens",
              COALESCE(ROUND(AVG(l.duration_ms)), 0) AS "avgDurationMs"
       FROM api_usage_logs l
       LEFT JOIN ai_providers p ON p.id = l.provider_id
       WHERE l.provider_id IS NOT NULL AND l.created_at >= ${since}
       GROUP BY l.provider_id, p.name
       ORDER BY requests DESC`,
      [days],
    );

    const topEndpoints: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT method, path,
              COUNT(*) AS requests,
              COUNT(*) FILTER (WHERE status_code >= 400) AS errors,
              ROUND(AVG(duration_ms)) AS "avgDurationMs"
       FROM api_usage_logs
       WHERE created_at >= ${since}
       GROUP BY method, path
       ORDER BY requests DESC
       LIMIT 10`,
      [days],
    );

    return {
      days,
      daily: daily.map((r) => toNumbers<DailyUsageDto>(r, ['date'])),
      byProvider: byProvider.map((r) => toNumbers<ProviderUsageDto>(r, ['providerId', 'name'])),
      topEndpoints: topEndpoints.map((r) => toNumbers<EndpointUsageDto>(r, ['method', 'path'])),
    };
  }

  // ─────────────────────────── Request logs ───────────────────────────

  async logs(q: AdminLogsQueryDto): Promise<{ items: RequestLogDto[]; total: number }> {
    const qb = this.logsRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.user', 'user')
      .leftJoinAndSelect('l.provider', 'provider')
      .orderBy('l.createdAt', 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);

    if (q.userId) qb.andWhere('l.userId = :userId', { userId: q.userId });
    if (q.statusCode) qb.andWhere('l.statusCode = :statusCode', { statusCode: q.statusCode });
    if (q.errorsOnly) qb.andWhere('l.statusCode >= 400');
    if (q.method) qb.andWhere('l.method = :method', { method: q.method });
    if (q.path) {
      const prefix = q.path.replace(/[\\%_]/g, (c) => `\\${c}`);
      qb.andWhere(`l.path LIKE :path ESCAPE '\\'`, { path: `${prefix}%` });
    }
    if (q.from || q.to) {
      qb.andWhere(
        new Brackets((w) => {
          if (q.from) w.andWhere('l.createdAt >= :from', { from: q.from });
          if (q.to) w.andWhere('l.createdAt < :to', { to: q.to });
        }),
      );
    }

    const [rows, total] = await qb.getManyAndCount();
    const items: RequestLogDto[] = rows.map((l) => ({
      id: l.id,
      userId: l.userId,
      userEmail: l.user?.email ?? null,
      method: l.method,
      path: l.path,
      statusCode: l.statusCode,
      durationMs: l.durationMs,
      ipAddress: l.ipAddress,
      usageType: l.usageType,
      providerName: l.provider?.name ?? null,
      promptTokens: l.promptTokens,
      completionTokens: l.completionTokens,
      errorMessage: l.errorMessage,
      createdAt: l.createdAt,
    }));
    return { items, total };
  }

  // ─────────────────────────── System health ───────────────────────────

  async systemHealth(): Promise<SystemHealthDto> {
    let database: 'up' | 'down' = 'up';
    let databaseLatencyMs: number | null = null;
    let serverErrorsLastHour = 0;
    let providers: ProviderStatusDto[] = [];

    const started = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      databaseLatencyMs = Date.now() - started;
      const [row] = await this.dataSource.query(
        `SELECT COUNT(*) AS n FROM api_usage_logs WHERE status_code >= 500 AND created_at >= now() - interval '1 hour'`,
      );
      serverErrorsLastHour = Number(row.n);
      providers = await this.providerStatuses();
    } catch {
      database = 'down';
    }

    const defaultProvider = providers.find((p) => p.isDefault);
    const status: SystemHealthDto['status'] =
      database === 'down'
        ? 'down'
        : !defaultProvider || defaultProvider.healthStatus === ProviderHealth.DOWN || serverErrorsLastHour > 0
          ? 'degraded'
          : 'ok';

    const memory = process.memoryUsage();
    return {
      status,
      database,
      databaseLatencyMs,
      providers,
      uptimeSeconds: Math.round(process.uptime()),
      memoryRssMb: Math.round(memory.rss / 1024 / 1024),
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      nodeVersion: process.version,
      environment: this.config.getOrThrow<string>('NODE_ENV'),
      aiMockMode: this.config.get<string>('AI_MOCK_MODE') === 'true',
      searchProvider: this.config.get<string>('SEARCH_PROVIDER') ?? 'wikipedia',
      serverErrorsLastHour,
      timestamp: new Date(),
    };
  }

  private async providerStatuses(): Promise<ProviderStatusDto[]> {
    const providers = await this.providersRepo.find({ order: { createdAt: 'ASC' } });
    return providers.map((p) => ({
      id: p.id,
      name: p.name,
      isEnabled: p.isEnabled,
      isDefault: p.isDefault,
      healthStatus: p.healthStatus,
      lastHealthCheckAt: p.lastHealthCheckAt,
    }));
  }
}