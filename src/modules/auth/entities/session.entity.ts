import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { User } from '../../users/entities/user.entity';

/**
 * One row per logged-in device.
 * Logout = set revokedAt. Only a HASH of the refresh token is stored.
 */
@Entity('sessions')
export class Session extends AbstractEntity {
  // ── Relation: many sessions belong to one user ──
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // SHA-256 hash of the refresh token, never the raw token
  @Column({ type: 'varchar', length: 255 })
  refreshTokenHash: string;

  // Device info, shown in "active sessions" and useful for security logs
  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  // After this moment, the refresh token no longer works
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  // null = session is active; a date = logged out / revoked at that time
  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}