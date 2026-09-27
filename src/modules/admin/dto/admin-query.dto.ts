import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { RoleName, SubscriptionStatus } from '../../../common/enums';

/**
 * Turns ?isActive=false into the boolean false.
 * Reads the ORIGINAL value (obj[key]): implicit conversion would already have turned
 * the string "false" into true, because any non-empty string is truthy.
 */
const toBoolean = ({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
  const raw = obj[key];
  if (raw === 'true' || raw === true) return true;
  if (raw === 'false' || raw === false) return false;
  return raw;
};

export class AdminUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'rahim', description: 'Search in email and name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: RoleName })
  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}

export class AdminSubscriptionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ example: 'PREMIUM' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  planCode?: string;
}

export class AdminLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Only this user\'s requests' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ example: 404, description: 'Exact status code' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  statusCode?: number;

  @ApiPropertyOptional({ example: true, description: 'Only failed requests (status >= 400)' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  errorsOnly?: boolean;

  @ApiPropertyOptional({ enum: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] })
  @IsOptional()
  @IsIn(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
  method?: string;

  @ApiPropertyOptional({ example: '/api/v1/chat', description: 'Path starts with' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  path?: string;

  @ApiPropertyOptional({ example: '2026-09-27T00:00:00Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-28T00:00:00Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ default: 7, minimum: 1, maximum: 90, description: 'How many days back' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days: number = 7;
}