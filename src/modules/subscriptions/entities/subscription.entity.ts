import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { SubscriptionStatus } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';
import { Plan } from './plan.entity';

/**
 * Full subscription history per user.
 * Upgrade/downgrade = cancel the ACTIVE row + insert a new ACTIVE row (one transaction).
 */
@Entity('subscriptions')
@Index(['userId', 'status'])
// Database guarantee: at most ONE active subscription per user
@Index('uq_subscriptions_one_active_per_user', ['userId'], {
  unique: true,
  where: `"status" = 'ACTIVE'`,
})
export class Subscription extends AbstractEntity {
  // ── Relation: many subscriptions belong to one user ──
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.subscriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // ── Relation: many subscriptions use one plan ──
  @Index()
  @Column({ type: 'int' })
  planId: number;

  @ManyToOne(() => Plan, (plan) => plan.subscriptions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    enumName: 'subscription_status_enum',
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date;

  // null = never ends (e.g. FREE plan)
  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  // Set when the user upgrades, downgrades, or cancels
  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;
}