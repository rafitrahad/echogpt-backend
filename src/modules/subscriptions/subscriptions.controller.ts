import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ChangePlanDto } from './dto/change-plan.dto';
import { PlanResponseDto } from './dto/plan-response.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'List available plans (public)' })
  @ApiOkResponse({ type: [PlanResponseDto] })
  async listPlans(): Promise<PlanResponseDto[]> {
    const plans = await this.subscriptionsService.listActivePlans();
    return plans.map((plan) => PlanResponseDto.fromEntity(plan));
  }

  @ApiBearerAuth('access-token')
  @Get('me')
  @ApiOperation({ summary: 'My current subscription status' })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async getMySubscription(@CurrentUser('id') userId: string): Promise<SubscriptionResponseDto> {
    return SubscriptionResponseDto.fromEntity(
      await this.subscriptionsService.getActiveSubscription(userId),
    );
  }

  @ApiBearerAuth('access-token')
  @Post('me/change')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upgrade or downgrade my plan',
    description: 'Payment is simulated in this project. Paid plans run for 30 days, then fall back to FREE.',
  })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  @ApiNotFoundResponse({ description: 'Plan does not exist or is retired' })
  @ApiConflictResponse({ description: 'Already on this plan' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async changePlan(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePlanDto,
  ): Promise<SubscriptionResponseDto> {
    return SubscriptionResponseDto.fromEntity(
      await this.subscriptionsService.changePlan(userId, dto.planCode),
    );
  }
}