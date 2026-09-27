import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ example: 'Bangladesh GDP growth' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  query: string;

  @ApiPropertyOptional({ example: true, default: true, description: 'Ask the AI to summarize the results' })
  @IsOptional()
  @IsBoolean()
  summarize?: boolean;
}