import { ApiProperty } from '@nestjs/swagger';
import { Plan } from '../entities/plan.entity';

export class PlanResponseDto {
  @ApiProperty({ example: 'PREMIUM' })
  code: string;

  @ApiProperty({ example: 'Premium' })
  name: string;

  @ApiProperty({ example: 'Unlimited chat and search, premium models', nullable: true, type: String })
  description: string | null;

  @ApiProperty({ example: 999, description: 'Price in cents: 999 = $9.99' })
  priceCents: number;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiProperty({ example: null, nullable: true, type: Number, description: 'null = unlimited' })
  dailyChatLimit: number | null;

  @ApiProperty({ example: null, nullable: true, type: Number, description: 'null = unlimited' })
  dailySearchLimit: number | null;

  static fromEntity(plan: Plan): PlanResponseDto {
    const dto = new PlanResponseDto();
    dto.code = plan.code;
    dto.name = plan.name;
    dto.description = plan.description;
    dto.priceCents = plan.priceCents;
    dto.currency = plan.currency;
    dto.dailyChatLimit = plan.dailyChatLimit;
    dto.dailySearchLimit = plan.dailySearchLimit;
    return dto;
  }
}