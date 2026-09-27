import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { RoleName } from '../../../common/enums';

export class SetUserStatusDto {
  @ApiProperty({ example: false, description: 'false = suspend (also logs the user out everywhere)' })
  @IsBoolean()
  isActive: boolean;
}

export class SetUserRoleDto {
  @ApiProperty({ enum: RoleName, example: RoleName.ADMIN })
  @IsEnum(RoleName)
  role: RoleName;
}

export class SetUserPlanDto {
  @ApiProperty({ example: 'PREMIUM' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  planCode: string;
}

/** Plans are data: limits and prices change here, with no code change or redeploy */
export class UpdatePlanDto {
  @ApiPropertyOptional({ example: 'Premium' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Unlimited chat and search' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 999 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @ApiPropertyOptional({ example: 30, nullable: true, type: Number, description: 'null = unlimited' })
  @IsOptional()
  @IsInt()
  @Min(0)
  dailyChatLimit?: number | null;

  @ApiPropertyOptional({ example: 15, nullable: true, type: Number, description: 'null = unlimited' })
  @IsOptional()
  @IsInt()
  @Min(0)
  dailySearchLimit?: number | null;

  @ApiPropertyOptional({ example: true, description: 'false = retired: no new subscriptions' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}