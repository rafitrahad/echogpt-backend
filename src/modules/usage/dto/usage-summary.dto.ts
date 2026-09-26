import { ApiProperty } from '@nestjs/swagger';

export class UsageCounterDto {
  @ApiProperty({ example: 7 })
  used: number;

  @ApiProperty({ example: 20, nullable: true, type: Number, description: 'null = unlimited' })
  limit: number | null;

  @ApiProperty({ example: 13, nullable: true, type: Number, description: 'null = unlimited' })
  remaining: number | null;
}

export class UsageSummaryDto {
  @ApiProperty({ example: '2026-09-26', description: 'The day being counted' })
  date: string;

  @ApiProperty({ example: 'Asia/Dhaka', description: 'Limits reset at midnight in this time zone' })
  timezone: string;

  @ApiProperty({ example: 'FREE' })
  planCode: string;

  @ApiProperty({ type: UsageCounterDto })
  chat: UsageCounterDto;

  @ApiProperty({ type: UsageCounterDto })
  search: UsageCounterDto;
}