import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class UpdateProviderDto {
  @ApiPropertyOptional({ example: 'OpenAI - Main' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'sk-new-rotated-key', description: 'Rotate the API key' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  apiKey?: string;

  @ApiPropertyOptional({ example: 'https://my-proxy.example.com/v1' })
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(500)
  baseUrl?: string;
}