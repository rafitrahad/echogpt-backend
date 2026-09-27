import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AiProvider } from '../providers/entities/ai-provider.entity';
import { Plan } from '../subscriptions/entities/plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ApiUsageLog } from '../usage/entities/api-usage-log.entity';
import { UsageModule } from '../usage/usage.module';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { AdminStatsService } from './admin-stats.service';
import { AdminUsersService } from './admin-users.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, Plan, Subscription, AiProvider, ApiUsageLog]),
    AuthModule,
    SubscriptionsModule,
    UsageModule,
  ],
  controllers: [AdminController],
  providers: [AdminStatsService, AdminUsersService],
})
export class AdminModule {}