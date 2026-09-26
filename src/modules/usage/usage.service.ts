import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UsageType } from '../../common/enums';
import { Plan } from '../subscriptions/entities/plan.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsageCounterDto, UsageSummaryDto } from './dto/usage-summary.dto';
import { DailyUsage } from './entities/daily-usage.entity';

@Injectable()
export class UsageService {
  private readonly timezone: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly subscriptionsService: SubscriptionsService,
    @InjectRepository(DailyUsage) private readonly usageRepo: Repository<DailyUsage>,
  ) {
    this.timezone = this.config.getOrThrow<string>('APP_TIMEZONE');
  }

  /**
   * Uses ONE request from today's allowance, or throws 429 if the limit is reached.
   * Check and increment happen in ONE SQL statement, so simultaneous requests
   * can never sneak past the limit.
   */
  async consume(userId: string, type: UsageType): Promise<void> {
    const { plan } = await this.subscriptionsService.getActiveSubscription(userId);
    const limit = this.limitFor(plan, type);

    if (limit === 0) {
      throw this.limitReached(type);
    }

    const rows: unknown[] = await this.dataSource.query(
      `INSERT INTO daily_usage (user_id, date, type, count)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (user_id, date, type)
       DO UPDATE SET count = daily_usage.count + 1, updated_at = now()
       WHERE $4::int IS NULL OR daily_usage.count < $4::int
       RETURNING count`,
      [userId, this.today(), type, limit],
    );

    // No row returned = the WHERE blocked the update = limit already reached
    if (rows.length === 0) {
      throw this.limitReached(type);
    }
  }

  /** Gives one request back, e.g. when the AI provider failed and the user got nothing */
  async refund(userId: string, type: UsageType): Promise<void> {
    await this.dataSource.query(
      `UPDATE daily_usage SET count = GREATEST(count - 1, 0), updated_at = now()
       WHERE user_id = $1 AND date = $2 AND type = $3`,
      [userId, this.today(), type],
    );
  }

  /** Remaining Requests API */
  async getSummary(userId: string): Promise<UsageSummaryDto> {
    const { plan } = await this.subscriptionsService.getActiveSubscription(userId);
    const date = this.today();
    const rows = await this.usageRepo.find({ where: { userId, date } });

    const counter = (type: UsageType): UsageCounterDto => {
      const used = rows.find((row) => row.type === type)?.count ?? 0;
      const limit = this.limitFor(plan, type);
      return { used, limit, remaining: limit === null ? null : Math.max(limit - used, 0) };
    };

    return {
      date,
      timezone: this.timezone,
      planCode: plan.code,
      chat: counter(UsageType.CHAT),
      search: counter(UsageType.SEARCH),
    };
  }

  // ─────────────────────────── Helpers ───────────────────────────

  /** Today's date as 'YYYY-MM-DD' in the app's time zone (not the server's) */
  private today(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private limitFor(plan: Plan, type: UsageType): number | null {
    return type === UsageType.CHAT ? plan.dailyChatLimit : plan.dailySearchLimit;
  }

  private limitReached(type: UsageType): HttpException {
    const what = type === UsageType.CHAT ? 'chat' : 'search';
    return new HttpException(
      `Daily ${what} limit reached. Upgrade to Premium for unlimited access.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}