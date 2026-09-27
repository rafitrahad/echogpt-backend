import { ApiProperty } from '@nestjs/swagger';
import { ProviderHealth, RoleName, SubscriptionStatus, UsageType } from '../../../common/enums';
import { SubscriptionResponseDto } from '../../subscriptions/dto/subscription-response.dto';
import { UsageSummaryDto } from '../../usage/dto/usage-summary.dto';

// ───────── Dashboard ─────────

export class PlanCountDto {
  @ApiProperty({ example: 'PREMIUM' }) planCode: string;
  @ApiProperty({ example: 320 }) activeSubscriptions: number;
}

export class ProviderStatusDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'OpenAI' }) name: string;
  @ApiProperty() isEnabled: boolean;
  @ApiProperty() isDefault: boolean;
  @ApiProperty({ enum: ProviderHealth }) healthStatus: ProviderHealth;
  @ApiProperty({ nullable: true, type: Date }) lastHealthCheckAt: Date | null;
}

export class DashboardStatsDto {
  @ApiProperty({ example: 5400 }) totalUsers: number;
  @ApiProperty({ example: 5390 }) activeUsers: number;
  @ApiProperty({ example: 123 }) newUsersToday: number;
  @ApiProperty({ example: 610 }) newUsersLast7Days: number;
  @ApiProperty({ example: 18000 }) requestsToday: number;
  @ApiProperty({ example: 12000 }) chatRequestsToday: number;
  @ApiProperty({ example: 3000 }) searchRequestsToday: number;
  @ApiProperty({ example: 4 }) serverErrorsToday: number;
  @ApiProperty({ example: 212 }) avgResponseMsToday: number;
  @ApiProperty({ example: 1840000 }) tokensToday: number;
  @ApiProperty({ example: 9000 }) totalConversations: number;
  @ApiProperty({ example: 64000 }) totalMessages: number;
  @ApiProperty({ example: 15000 }) totalSearches: number;
  @ApiProperty({ example: 4200 }) cacheHitsTotal: number;
  @ApiProperty({ type: [PlanCountDto] }) subscriptionsByPlan: PlanCountDto[];
  @ApiProperty({ type: [ProviderStatusDto] }) providers: ProviderStatusDto[];
  @ApiProperty({ example: 'Asia/Dhaka' }) timezone: string;
}

// ───────── Analytics ─────────

export class DailyUsageDto {
  @ApiProperty({ example: '2026-09-27' }) date: string;
  @ApiProperty({ example: 1200 }) requests: number;
  @ApiProperty({ example: 800 }) chat: number;
  @ApiProperty({ example: 150 }) search: number;
  @ApiProperty({ example: 30 }) errors: number;
  @ApiProperty({ example: 250000 }) tokens: number;
}

export class ProviderUsageDto {
  @ApiProperty({ nullable: true, type: String }) providerId: string | null;
  @ApiProperty({ example: 'OpenAI' }) name: string;
  @ApiProperty({ example: 900 }) requests: number;
  @ApiProperty({ example: 120000 }) promptTokens: number;
  @ApiProperty({ example: 340000 }) completionTokens: number;
  @ApiProperty({ example: 2900 }) avgDurationMs: number;
}

export class EndpointUsageDto {
  @ApiProperty({ example: 'POST' }) method: string;
  @ApiProperty({ example: '/api/v1/chat/messages' }) path: string;
  @ApiProperty({ example: 950 }) requests: number;
  @ApiProperty({ example: 12 }) errors: number;
  @ApiProperty({ example: 2950 }) avgDurationMs: number;
}

export class UsageAnalyticsDto {
  @ApiProperty({ example: 7 }) days: number;
  @ApiProperty({ type: [DailyUsageDto] }) daily: DailyUsageDto[];
  @ApiProperty({ type: [ProviderUsageDto] }) byProvider: ProviderUsageDto[];
  @ApiProperty({ type: [EndpointUsageDto] }) topEndpoints: EndpointUsageDto[];
}

// ───────── Request logs ─────────

export class RequestLogDto {
  @ApiProperty({ example: '1042' }) id: string;
  @ApiProperty({ nullable: true, type: String }) userId: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'rahim@gmail.com' }) userEmail: string | null;
  @ApiProperty({ example: 'POST' }) method: string;
  @ApiProperty({ example: '/api/v1/chat/messages' }) path: string;
  @ApiProperty({ example: 200 }) statusCode: number;
  @ApiProperty({ example: 3905 }) durationMs: number;
  @ApiProperty({ nullable: true, type: String }) ipAddress: string | null;
  @ApiProperty({ nullable: true, enum: UsageType }) usageType: UsageType | null;
  @ApiProperty({ nullable: true, type: String, example: 'Claude' }) providerName: string | null;
  @ApiProperty({ nullable: true, type: Number }) promptTokens: number | null;
  @ApiProperty({ nullable: true, type: Number }) completionTokens: number | null;
  @ApiProperty({ nullable: true, type: String }) errorMessage: string | null;
  @ApiProperty() createdAt: Date;
}

export class RequestLogListDto {
  @ApiProperty({ type: [RequestLogDto] }) items: RequestLogDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}

// ───────── Users & subscriptions ─────────

export class AdminUserDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'rahim@gmail.com' }) email: string;
  @ApiProperty({ nullable: true, type: String }) fullName: string | null;
  @ApiProperty({ enum: RoleName }) role: RoleName;
  @ApiProperty() isActive: boolean;
  @ApiProperty() isEmailVerified: boolean;
  @ApiProperty({ nullable: true, type: String, example: 'FREE' }) planCode: string | null;
  @ApiProperty({ nullable: true, type: Date }) lastLoginAt: Date | null;
  @ApiProperty() createdAt: Date;
}

export class AdminUserListDto {
  @ApiProperty({ type: [AdminUserDto] }) items: AdminUserDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}

export class UserActivityDto {
  @ApiProperty({ example: 14 }) conversations: number;
  @ApiProperty({ example: 120 }) messages: number;
  @ApiProperty({ example: 33 }) searches: number;
  @ApiProperty({ example: 2 }) activeSessions: number;
}

export class AdminUserDetailDto extends AdminUserDto {
  @ApiProperty({ type: SubscriptionResponseDto }) subscription: SubscriptionResponseDto;
  @ApiProperty({ type: UsageSummaryDto }) usageToday: UsageSummaryDto;
  @ApiProperty({ type: UserActivityDto }) activity: UserActivityDto;
}

export class AdminSubscriptionDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty({ example: 'rahim@gmail.com' }) userEmail: string;
  @ApiProperty({ example: 'PREMIUM' }) planCode: string;
  @ApiProperty({ enum: SubscriptionStatus }) status: SubscriptionStatus;
  @ApiProperty() startedAt: Date;
  @ApiProperty({ nullable: true, type: Date }) endsAt: Date | null;
  @ApiProperty({ nullable: true, type: Date }) cancelledAt: Date | null;
}

export class AdminSubscriptionListDto {
  @ApiProperty({ type: [AdminSubscriptionDto] }) items: AdminSubscriptionDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}

export class AdminPlanDto {
  @ApiProperty() id: number;
  @ApiProperty({ example: 'FREE' }) code: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true, type: String }) description: string | null;
  @ApiProperty() priceCents: number;
  @ApiProperty() currency: string;
  @ApiProperty({ nullable: true, type: Number }) dailyChatLimit: number | null;
  @ApiProperty({ nullable: true, type: Number }) dailySearchLimit: number | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ example: 5080 }) activeSubscriptions: number;
}

// ───────── System health ─────────

export class SystemHealthDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'degraded', 'down'] }) status: 'ok' | 'degraded' | 'down';
  @ApiProperty({ example: 'up', enum: ['up', 'down'] }) database: 'up' | 'down';
  @ApiProperty({ example: 3, nullable: true, type: Number }) databaseLatencyMs: number | null;
  @ApiProperty({ type: [ProviderStatusDto] }) providers: ProviderStatusDto[];
  @ApiProperty({ example: 5234 }) uptimeSeconds: number;
  @ApiProperty({ example: 180 }) memoryRssMb: number;
  @ApiProperty({ example: 95 }) heapUsedMb: number;
  @ApiProperty({ example: 'v24.20.0' }) nodeVersion: string;
  @ApiProperty({ example: 'development' }) environment: string;
  @ApiProperty({ example: true }) aiMockMode: boolean;
  @ApiProperty({ example: 'wikipedia' }) searchProvider: string;
  @ApiProperty({ example: 2, description: 'Server errors (5xx) in the last hour' }) serverErrorsLastHour: number;
  @ApiProperty() timestamp: Date;
}