import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleName } from '../../common/enums';
import { SubscriptionResponseDto } from '../subscriptions/dto/subscription-response.dto';
import { AdminStatsService } from './admin-stats.service';
import { AdminUsersService } from './admin-users.service';
import { SetUserPlanDto, SetUserRoleDto, SetUserStatusDto, UpdatePlanDto } from './dto/admin-actions.dto';
import {
  AdminLogsQueryDto,
  AdminSubscriptionsQueryDto,
  AdminUsersQueryDto,
  AnalyticsQueryDto,
} from './dto/admin-query.dto';
import {
  AdminPlanDto,
  AdminSubscriptionListDto,
  AdminUserDetailDto,
  AdminUserDto,
  AdminUserListDto,
  DashboardStatsDto,
  RequestLogListDto,
  SystemHealthDto,
  UsageAnalyticsDto,
} from './dto/admin-response.dto';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiForbiddenResponse({ description: 'Admins only' })
@Roles(RoleName.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly statsService: AdminStatsService,
    private readonly usersService: AdminUsersService,
  ) {}

  // ─────────── Dashboard, analytics, logs, health ───────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard statistics (users, usage today, subscriptions, providers)' })
  @ApiOkResponse({ type: DashboardStatsDto })
  dashboard(): Promise<DashboardStatsDto> {
    return this.statsService.dashboard();
  }

  @Get('analytics/usage')
  @ApiOperation({ summary: 'API usage analytics: per day, per provider, top endpoints' })
  @ApiOkResponse({ type: UsageAnalyticsDto })
  analytics(@Query() query: AnalyticsQueryDto): Promise<UsageAnalyticsDto> {
    return this.statsService.analytics(query.days);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Request logs, newest first, with filters' })
  @ApiOkResponse({ type: RequestLogListDto })
  async logs(@Query() query: AdminLogsQueryDto): Promise<RequestLogListDto> {
    const { items, total } = await this.statsService.logs(query);
    return { items, total, page: query.page, limit: query.limit };
  }

  @Get('system/health')
  @ApiOperation({ summary: 'Detailed system health: database, providers, memory, recent errors' })
  @ApiOkResponse({ type: SystemHealthDto })
  systemHealth(): Promise<SystemHealthDto> {
    return this.statsService.systemHealth();
  }

  // ─────────── User management ───────────

  @Get('users')
  @ApiOperation({ summary: 'List users (search by email/name, filter by role or status)' })
  @ApiOkResponse({ type: AdminUserListDto })
  async listUsers(@Query() query: AdminUsersQueryDto): Promise<AdminUserListDto> {
    const { items, total } = await this.usersService.listUsers(query);
    return { items, total, page: query.page, limit: query.limit };
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'One user with subscription, usage today and activity' })
  @ApiOkResponse({ type: AdminUserDetailDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  getUser(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserDetailDto> {
    return this.usersService.getUser(id);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Suspend or re-activate a user (suspending logs them out everywhere)' })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiBadRequestResponse({ description: 'Cannot change your own status' })
  setStatus(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserStatusDto,
  ): Promise<AdminUserDto> {
    return this.usersService.setStatus(adminId, id, dto.isActive);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Change a user\'s role' })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiConflictResponse({ description: 'Cannot remove the last admin' })
  setRole(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserRoleDto,
  ): Promise<AdminUserDto> {
    return this.usersService.setRole(adminId, id, dto.role);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user and all their data' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiConflictResponse({ description: 'Cannot delete the last admin' })
  async deleteUser(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.usersService.deleteUser(adminId, id);
  }

  // ─────────── Subscription management ───────────

  @Get('subscriptions')
  @ApiOperation({ summary: 'All subscriptions (filter by status or plan)' })
  @ApiOkResponse({ type: AdminSubscriptionListDto })
  async listSubscriptions(@Query() query: AdminSubscriptionsQueryDto): Promise<AdminSubscriptionListDto> {
    const { items, total } = await this.usersService.listSubscriptions(query);
    return { items, total, page: query.page, limit: query.limit };
  }

  @Post('users/:id/subscription')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Put a user on a plan (e.g. give Premium)' })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  @ApiConflictResponse({ description: 'User is already on this plan' })
  setPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserPlanDto,
  ): Promise<SubscriptionResponseDto> {
    return this.usersService.setPlan(id, dto.planCode);
  }

  @Get('plans')
  @ApiOperation({ summary: 'All plans, including retired ones, with subscriber counts' })
  @ApiOkResponse({ type: [AdminPlanDto] })
  listPlans(): Promise<AdminPlanDto[]> {
    return this.usersService.listPlans();
  }

  @Patch('plans/:code')
  @ApiOperation({ summary: 'Change a plan\'s price, limits or availability (no redeploy needed)' })
  @ApiOkResponse({ type: AdminPlanDto })
  @ApiConflictResponse({ description: 'The FREE plan cannot be retired' })
  updatePlan(@Param('code') code: string, @Body() dto: UpdatePlanDto): Promise<AdminPlanDto> {
    return this.usersService.updatePlan(code, dto);
  }
}