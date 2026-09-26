import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { UsageType } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';

/**
 * Fast counter for daily limits: one row per user, per day, per type.
 * remaining = plan.dailyChatLimit - count
 * Incremented atomically with an UPSERT (INSERT ... ON CONFLICT DO UPDATE).
 */
@Entity('daily_usage')
@Index('uq_daily_usage_user_date_type', ['userId', 'date', 'type'], {
  unique: true,
})
export class DailyUsage extends AbstractEntity {
  @Column({ type: 'uuid' })
  userId: string;

  // One-directional: we never load "a user with all their daily counters"
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Date only, no time. TypeORM returns it as a 'YYYY-MM-DD' string.
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'enum', enum: UsageType, enumName: 'usage_type_enum' })
  type: UsageType;

  @Column({ type: 'int', default: 0 })
  count: number;
}