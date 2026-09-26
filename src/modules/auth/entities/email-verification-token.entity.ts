import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Bonus feature: email verification.
 * Stores a SHA-256 hash of the token sent by email. One-time use.
 */
@Entity('email_verification_tokens')
export class EmailVerificationToken extends AbstractEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  // One-directional: no matching @OneToMany on User
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // unique: lookup happens by this column when the link is clicked
  @Column({ type: 'varchar', length: 255, unique: true })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  // null = not used yet; a date = already used (one-time only)
  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;
}