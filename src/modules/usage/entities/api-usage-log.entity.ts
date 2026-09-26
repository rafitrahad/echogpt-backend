import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UsageType } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';
import { AiProvider } from '../../providers/entities/ai-provider.entity';

/**
 * One row per request, written by a global interceptor.
 * Append-only: rows are never updated. Powers request logs and usage analytics.
 * Never store request bodies, passwords, tokens or API keys here.
 */
@Entity('api_usage_logs')
@Index(['userId', 'createdAt'])
@Index(['providerId', 'createdAt'])
export class ApiUsageLog {
  // bigint: this table grows fastest. The pg driver returns bigint as a string.
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  // ── Who: optional (login/register have no user yet). Survives user deletion ──
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  // ── What was requested ──
  @Column({ type: 'varchar', length: 10 })
  method: string;

  // Path WITHOUT the query string (query strings can contain sensitive data)
  @Column({ type: 'varchar', length: 500 })
  path: string;

  // ── What happened ──
  @Column({ type: 'int' })
  statusCode: number;

  @Column({ type: 'int' })
  durationMs: number;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  // ── AI-specific details: filled only for chat/search requests ──
  @Column({ type: 'enum', enum: UsageType, enumName: 'usage_type_enum', nullable: true })
  usageType: UsageType | null;

  @Column({ type: 'uuid', nullable: true })
  providerId: string | null;

  @ManyToOne(() => AiProvider, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'provider_id' })
  provider: AiProvider | null;

  @Column({ type: 'int', nullable: true })
  promptTokens: number | null;

  @Column({ type: 'int', nullable: true })
  completionTokens: number | null;

  // Short, safe error message for failed requests (never a stack trace)
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}