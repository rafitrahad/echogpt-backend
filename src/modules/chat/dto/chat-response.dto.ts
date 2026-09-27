import { ApiProperty } from '@nestjs/swagger';
import { MessageRole } from '../../../common/enums';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';

export class MessageResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: MessageRole }) role: MessageRole;
  @ApiProperty({ example: 'Here is a structured outline...' }) content: string;
  @ApiProperty({ nullable: true, type: String, example: 'gpt-4o-mini' }) modelKey: string | null;
  @ApiProperty({ nullable: true, type: Number, example: 48 }) promptTokens: number | null;
  @ApiProperty({ nullable: true, type: Number, example: 612 }) completionTokens: number | null;
  @ApiProperty({ nullable: true, type: Number, example: 3840 }) latencyMs: number | null;
  @ApiProperty() createdAt: Date;

  static fromEntity(m: Message): MessageResponseDto {
    return Object.assign(new MessageResponseDto(), {
      id: m.id,
      role: m.role,
      content: m.content,
      modelKey: m.modelKey,
      promptTokens: m.promptTokens,
      completionTokens: m.completionTokens,
      latencyMs: m.latencyMs,
      createdAt: m.createdAt,
    });
  }
}

export class ConversationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'Thesis outline on GDP' }) title: string;
  @ApiProperty({ nullable: true, type: String }) providerId: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'OpenAI' }) providerName: string | null;
  @ApiProperty({ nullable: true, type: String }) modelId: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'GPT-4o mini' }) modelName: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(c: Conversation): ConversationResponseDto {
    return Object.assign(new ConversationResponseDto(), {
      id: c.id,
      title: c.title,
      providerId: c.providerId,
      providerName: c.provider?.name ?? null,
      modelId: c.modelId,
      modelName: c.model?.displayName ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    });
  }
}

export class ConversationDetailDto extends ConversationResponseDto {
  @ApiProperty({ type: [MessageResponseDto] }) messages: MessageResponseDto[];
}

export class ConversationListDto {
  @ApiProperty({ type: [ConversationResponseDto] }) items: ConversationResponseDto[];
  @ApiProperty({ example: 42 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) limit: number;
}

export class SendMessageResponseDto {
  @ApiProperty({ type: ConversationResponseDto }) conversation: ConversationResponseDto;
  @ApiProperty({ type: MessageResponseDto }) userMessage: MessageResponseDto;
  @ApiProperty({ type: MessageResponseDto }) assistantMessage: MessageResponseDto;
}