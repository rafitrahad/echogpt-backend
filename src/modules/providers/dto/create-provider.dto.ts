import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProviderType } from '../../../common/enums';
import { CreateModelDto } from './create-model.dto';

export class CreateProviderDto {
  @ApiProperty({ example: 'OpenAI' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: ProviderType, example: ProviderType.OPENAI })
  @IsEnum(ProviderType)
  type: ProviderType;

  @ApiProperty({ example: 'sk-your-real-api-key', description: 'Stored encrypted, never returned' })
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  apiKey: string;

  @ApiPropertyOptional({ example: null, description: 'Custom endpoint. Leave empty for the official API' })
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(500)
  baseUrl?: string;

  @ApiProperty({ type: [CreateModelDto], description: 'At least one model' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateModelDto)
  models: CreateModelDto[];
}