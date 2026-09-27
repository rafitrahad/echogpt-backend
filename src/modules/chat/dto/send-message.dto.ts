import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'Give me a thesis outline on Bangladesh GDP growth' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  prompt: string;

  @ApiPropertyOptional({ description: 'Continue an existing chat. Omit to start a new one.' })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({ description: 'Provider to use. Omit to use the chat\'s last choice or the default.' })
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional({ description: 'Model to use. Omit to use the provider\'s default model.' })
  @IsOptional()
  @IsUUID()
  modelId?: string;
}