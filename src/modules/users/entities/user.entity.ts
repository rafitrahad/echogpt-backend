import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { Role } from './role.entity';
import { Session } from '../../auth/entities/session.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
@Entity('users')
export class User extends AbstractEntity {
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  // select: false -> never loaded unless we explicitly ask for it
  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  fullName: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  // Admin can suspend a user by setting this to false
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  // ── Relation: many users belong to one role ──
  @Index()
  @Column({ type: 'int' })
  roleId: number;

  @ManyToOne(() => Role, (role) => role.users, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

    @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];
    @OneToMany(() => Subscription, (sub) => sub.user)
  subscriptions: Subscription[];
}