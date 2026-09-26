import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionStatus } from '../../../common/enums';
import { Subscription } from '../entities/subscription.entity';
import { PlanResponseDto } from './plan-response.dto';

export class SubscriptionResponseDto {
  @ApiProperty({ example: 'b1f0c9a2-6f7e-4a51-9d0e-2b8f3c4d5e6f' })
  id: string;

  @ApiProperty({ enum: SubscriptionStatus, example: SubscriptionStatus.ACTIVE })
  status: SubscriptionStatus;

  @ApiProperty({ example: '2026-09-26T14:30:00.000Z' })
  startedAt: Date;

  @ApiProperty({ example: '2026-10-26T14:30:00.000Z', nullable: true, type: Date, description: 'null = never ends' })
  endsAt: Date | null;

  @ApiProperty({ type: PlanResponseDto })
  plan: PlanResponseDto;

  static fromEntity(sub: Subscription): SubscriptionResponseDto {
    const dto = new SubscriptionResponseDto();
    dto.id = sub.id;
    dto.status = sub.status;
    dto.startedAt = sub.startedAt;
    dto.endsAt = sub.endsAt;
    dto.plan = PlanResponseDto.fromEntity(sub.plan);
    return dto;
  }
}