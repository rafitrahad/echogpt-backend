import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { SubscriptionStatus } from '../../common/enums';
import { Plan } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';

const FREE_PLAN_CODE = 'FREE';
const PAID_PERIOD_DAYS = 30;

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Plan) private readonly plansRepo: Repository<Plan>,
  ) {}

  /** Plans a user can choose from */
  listActivePlans(): Promise<Plan[]> {
    return this.plansRepo.find({ where: { isActive: true }, order: { priceCents: 'ASC' } });
  }

  /**
   * The user's current subscription (with its plan).
   * Lazy expiry: if a paid period has ended, it is marked EXPIRED and the user
   * falls back to FREE right here, so no background job is needed.
   */
  async getActiveSubscription(userId: string): Promise<Subscription> {
    return this.dataSource.transaction(async (manager) => {
      const current = await manager.findOne(Subscription, {
        where: { userId, status: SubscriptionStatus.ACTIVE },
        relations: { plan: true },
      });

      if (current && (!current.endsAt || current.endsAt > new Date())) {
        return current;
      }

      if (current) {
        current.status = SubscriptionStatus.EXPIRED;
        await manager.save(current);
      }
      return this.createSubscription(manager, userId, await this.findPlanOrFail(manager, FREE_PLAN_CODE));
    });
  }

  /** Upgrade or downgrade: cancel the current plan and start the new one, in ONE transaction */
  async changePlan(userId: string, planCode: string): Promise<Subscription> {
    const current = await this.getActiveSubscription(userId);

    return this.dataSource.transaction(async (manager) => {
      const newPlan = await this.findPlanOrFail(manager, planCode);

      if (current.planId === newPlan.id) {
        throw new ConflictException(`You are already on the ${newPlan.name} plan`);
      }

      // Order matters: the old row must stop being ACTIVE before the new one is inserted,
      // because the database allows only one ACTIVE subscription per user.
      await manager.update(
        Subscription,
        { id: current.id, status: SubscriptionStatus.ACTIVE },
        { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
      );

      // Payment is simulated for this project: a real system would charge here first.
      return this.createSubscription(manager, userId, newPlan);
    });
  }

  // ─────────────────────────── Helpers ───────────────────────────

  private async createSubscription(
    manager: EntityManager,
    userId: string,
    plan: Plan,
  ): Promise<Subscription> {
    const now = new Date();
    const endsAt =
      plan.priceCents > 0 ? new Date(now.getTime() + PAID_PERIOD_DAYS * 24 * 60 * 60 * 1000) : null;

    const saved = await manager.save(
      manager.create(Subscription, {
        userId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        startedAt: now,
        endsAt,
      }),
    );
    saved.plan = plan;
    return saved;
  }

  private async findPlanOrFail(manager: EntityManager, code: string): Promise<Plan> {
    const plan = await manager.findOneBy(Plan, { code, isActive: true });
    if (!plan) {
      throw new NotFoundException(`Plan "${code}" does not exist or is no longer available`);
    }
    return plan;
  }
}