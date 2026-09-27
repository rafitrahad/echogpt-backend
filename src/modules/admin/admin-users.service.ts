import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RoleName, SubscriptionStatus } from '../../common/enums';
import { AuthService } from '../auth/auth.service';
import { SubscriptionResponseDto } from '../subscriptions/dto/subscription-response.dto';
import { Plan } from '../subscriptions/entities/plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsageService } from '../usage/usage.service';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { AdminSubscriptionsQueryDto, AdminUsersQueryDto } from './dto/admin-query.dto';
import { UpdatePlanDto } from './dto/admin-actions.dto';
import {
  AdminPlanDto,
  AdminSubscriptionDto,
  AdminUserDetailDto,
  AdminUserDto,
} from './dto/admin-response.dto';

const FREE_PLAN_CODE = 'FREE';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly authService: AuthService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly usageService: UsageService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
    @InjectRepository(Plan) private readonly plansRepo: Repository<Plan>,
    @InjectRepository(Subscription) private readonly subscriptionsRepo: Repository<Subscription>,
  ) {}

  // ─────────────────────────── Users ───────────────────────────

  async listUsers(q: AdminUsersQueryDto): Promise<{ items: AdminUserDto[]; total: number }> {
    const qb = this.usersRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'role')
      .leftJoinAndSelect('u.subscriptions', 'sub', 'sub.status = :active', {
        active: SubscriptionStatus.ACTIVE,
      })
      .leftJoinAndSelect('sub.plan', 'plan')
      .orderBy('u.createdAt', 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);

    if (q.search) {
      const term = `%${q.search.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.andWhere(`(u.email ILIKE :term ESCAPE '\\' OR u.fullName ILIKE :term ESCAPE '\\')`, { term });
    }
    if (q.role) qb.andWhere('role.name = :role', { role: q.role });
    if (q.isActive !== undefined) qb.andWhere('u.isActive = :isActive', { isActive: q.isActive });

    const [users, total] = await qb.getManyAndCount();
    return { items: users.map((u) => this.toAdminUser(u)), total };
  }

  async getUser(userId: string): Promise<AdminUserDetailDto> {
    const user = await this.findUserOrFail(userId);
    const subscription = await this.subscriptionsService.getActiveSubscription(userId);
    const usageToday = await this.usageService.getSummary(userId);

    const [activity] = await this.dataSource.query(
      `SELECT
         (SELECT COUNT(*) FROM conversations WHERE user_id = $1) AS conversations,
         (SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id
            WHERE c.user_id = $1) AS messages,
         (SELECT COUNT(*) FROM web_searches WHERE user_id = $1) AS searches,
         (SELECT COUNT(*) FROM sessions
            WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()) AS "activeSessions"`,
      [userId],
    );

    return {
      ...this.toAdminUser(user, subscription.plan.code),
      subscription: SubscriptionResponseDto.fromEntity(subscription),
      usageToday,
      activity: {
        conversations: Number(activity.conversations),
        messages: Number(activity.messages),
        searches: Number(activity.searches),
        activeSessions: Number(activity.activeSessions),
      },
    };
  }

  /** Suspend or re-activate. Suspending also logs the user out everywhere. */
  async setStatus(adminId: string, userId: string, isActive: boolean): Promise<AdminUserDto> {
    if (adminId === userId) throw new BadRequestException('You cannot change your own status');
    const user = await this.findUserOrFail(userId);

    await this.usersRepo.update(userId, { isActive });
    if (!isActive) await this.authService.revokeAllSessions(userId);

    user.isActive = isActive;
    return this.toAdminUser(user);
  }

  async setRole(adminId: string, userId: string, roleName: RoleName): Promise<AdminUserDto> {
    if (adminId === userId) throw new BadRequestException('You cannot change your own role');
    const user = await this.findUserOrFail(userId);

    if (user.role.name === RoleName.ADMIN && roleName !== RoleName.ADMIN) {
      await this.assertNotLastAdmin();
    }
    const role = await this.rolesRepo.findOneBy({ name: roleName });
    if (!role) throw new NotFoundException(`Role ${roleName} does not exist`);

    await this.usersRepo.update(userId, { roleId: role.id });
    // New role must apply to fresh tokens: force a new login
    await this.authService.revokeAllSessions(userId);

    user.role = role;
    return this.toAdminUser(user);
  }

  async deleteUser(adminId: string, userId: string): Promise<void> {
    if (adminId === userId) {
      throw new BadRequestException('Use DELETE /users/me to delete your own account');
    }
    const user = await this.findUserOrFail(userId);
    if (user.role.name === RoleName.ADMIN) await this.assertNotLastAdmin();
    await this.usersRepo.delete(userId); // CASCADE / SET NULL do the rest
  }

  /** Admin gives a user a plan (e.g. a free Premium month) */
  async setPlan(userId: string, planCode: string): Promise<SubscriptionResponseDto> {
    await this.findUserOrFail(userId);
    return SubscriptionResponseDto.fromEntity(await this.subscriptionsService.changePlan(userId, planCode));
  }

  // ─────────────────────────── Subscriptions ───────────────────────────

  async listSubscriptions(q: AdminSubscriptionsQueryDto): Promise<{ items: AdminSubscriptionDto[]; total: number }> {
    const qb = this.subscriptionsRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.user', 'user')
      .innerJoinAndSelect('s.plan', 'plan')
      .orderBy('s.createdAt', 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);

    if (q.status) qb.andWhere('s.status = :status', { status: q.status });
    if (q.planCode) qb.andWhere('plan.code = :code', { code: q.planCode.toUpperCase() });

    const [rows, total] = await qb.getManyAndCount();
    return {
      items: rows.map((s) => ({
        id: s.id,
        userId: s.userId,
        userEmail: s.user.email,
        planCode: s.plan.code,
        status: s.status,
        startedAt: s.startedAt,
        endsAt: s.endsAt,
        cancelledAt: s.cancelledAt,
      })),
      total,
    };
  }

  // ─────────────────────────── Plans ───────────────────────────

  async listPlans(): Promise<AdminPlanDto[]> {
    const plans = await this.plansRepo.find({ order: { priceCents: 'ASC' } });
    const counts: { planId: number; n: string }[] = await this.dataSource.query(
      `SELECT plan_id AS "planId", COUNT(*) AS n FROM subscriptions WHERE status = 'ACTIVE' GROUP BY plan_id`,
    );
    return plans.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      priceCents: p.priceCents,
      currency: p.currency,
      dailyChatLimit: p.dailyChatLimit,
      dailySearchLimit: p.dailySearchLimit,
      isActive: p.isActive,
      activeSubscriptions: Number(counts.find((c) => c.planId === p.id)?.n ?? 0),
    }));
  }

  async updatePlan(code: string, dto: UpdatePlanDto): Promise<AdminPlanDto> {
    const plan = await this.plansRepo.findOneBy({ code: code.toUpperCase() });
    if (!plan) throw new NotFoundException('Plan not found');

    if (dto.isActive === false && plan.code === FREE_PLAN_CODE) {
      throw new ConflictException('The FREE plan is the fallback for everyone and cannot be retired');
    }

    if (dto.name !== undefined) plan.name = dto.name.trim();
    if (dto.description !== undefined) plan.description = dto.description;
    if (dto.priceCents !== undefined) plan.priceCents = dto.priceCents;
    if (dto.dailyChatLimit !== undefined) plan.dailyChatLimit = dto.dailyChatLimit;
    if (dto.dailySearchLimit !== undefined) plan.dailySearchLimit = dto.dailySearchLimit;
    if (dto.isActive !== undefined) plan.isActive = dto.isActive;

    await this.plansRepo.save(plan);
    return (await this.listPlans()).find((p) => p.id === plan.id)!;
  }

  // ─────────────────────────── Helpers ───────────────────────────

  private async findUserOrFail(userId: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id: userId }, relations: { role: true } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async assertNotLastAdmin(): Promise<void> {
    const admins = await this.usersRepo.count({ where: { role: { name: RoleName.ADMIN } } });
    if (admins <= 1) throw new ConflictException('The system must keep at least one admin');
  }

  private toAdminUser(user: User, planCode?: string): AdminUserDto {
    const activePlan = planCode ?? user.subscriptions?.[0]?.plan?.code ?? null;
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.name as RoleName,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      planCode: activePlan,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}