import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateModelDto {
  @ApiProperty({ example: 'gpt-4o-mini', description: 'Exact model id sent to the provider API' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9._:\/-]+$/, { message: 'modelKey may only contain letters, numbers and . _ : / -' })
  modelKey: string;

  @ApiProperty({ example: 'GPT-4o mini' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName: string;

  @ApiPropertyOptional({ example: false, description: 'Only PREMIUM users may use this model' })
  @IsOptional()
  @IsBoolean()
  premiumOnly?: boolean;

  @ApiPropertyOptional({ example: 1024, description: 'Max answer length in tokens (cost control)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32000)
  maxTokens?: number;

  @ApiPropertyOptional({ example: true, description: "Make this the provider's default model" })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}