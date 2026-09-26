import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Subscription } from './subscription.entity';

/**
 * Available plans (FREE, PREMIUM).
 * Limits live here, so changing "20 chats/day" is a data change, not a code change.
 */
@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn()
  id: number;

  // Stable identifier used in code: 'FREE' | 'PREMIUM'
  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  // Display name shown to users, can be changed freely
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Money stored as whole cents: 999 = $9.99
  @Column({ type: 'int', default: 0 })
  priceCents: number;

  // ISO currency code: 'USD', 'BDT'
  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  // null = unlimited
  @Column({ type: 'int', nullable: true })
  dailyChatLimit: number | null;

  // null = unlimited
  @Column({ type: 'int', nullable: true })
  dailySearchLimit: number | null;

  // false = plan retired, no new subscriptions allowed
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

    @OneToMany(() => Subscription, (sub) => sub.plan)
  subscriptions: Subscription[];
}