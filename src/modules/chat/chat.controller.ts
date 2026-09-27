import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UsageType } from '../../common/enums';
import type { RequestWithUsageMeta } from '../../common/interfaces/request-usage-meta.interface';
import { ChatService } from './chat.service';
import {
  ConversationDetailDto,
  ConversationListDto,
  ConversationResponseDto,
  MessageResponseDto,
  SendMessageResponseDto,
} from './dto/chat-response.dto';
import { RenameConversationDto } from './dto/rename-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a prompt and get the AI response',
    description:
      'Omit conversationId to start a new chat. Omit providerId/modelId to use the chat\'s last choice or the default provider.',
  })
  @ApiOkResponse({ type: SendMessageResponseDto })
  @ApiNotFoundResponse({ description: 'Conversation, provider or model not found' })
  @ApiForbiddenResponse({ description: 'Model requires a Premium subscription' })
  @ApiTooManyRequestsResponse({ description: 'Daily chat limit reached' })
  @ApiBadGatewayResponse({ description: 'The AI provider failed (the request is not counted)' })
  @ApiServiceUnavailableResponse({ description: 'No AI provider configured' })
  async sendMessage(
    @CurrentUser('id') userId: string,
    @Body() dto: SendMessageDto,
    @Req() req: RequestWithUsageMeta,
  ): Promise<SendMessageResponseDto> {
    const result = await this.chatService.sendMessage(userId, dto);

    // For the request logs / analytics (read by the logging interceptor)
    req.usageMeta = {
      usageType: UsageType.CHAT,
      providerId: result.target.provider.id,
      promptTokens: result.assistantMessage.promptTokens,
      completionTokens: result.assistantMessage.completionTokens,
    };

    return {
      conversation: ConversationResponseDto.fromEntity(result.conversation),
      userMessage: MessageResponseDto.fromEntity(result.userMessage),
      assistantMessage: MessageResponseDto.fromEntity(result.assistantMessage),
    };
  }

  @Get('conversations')
  @ApiOperation({ summary: 'My chats, most recently active first' })
  @ApiOkResponse({ type: ConversationListDto })
  async listConversations(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<ConversationListDto> {
    const { items, total } = await this.chatService.listConversations(userId, query.page, query.limit);
    return {
      items: items.map((c) => ConversationResponseDto.fromEntity(c)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'One chat with all its messages' })
  @ApiOkResponse({ type: ConversationDetailDto })
  @ApiNotFoundResponse({ description: 'Conversation not found' })
  async getConversation(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConversationDetailDto> {
    const { conversation, messages } = await this.chatService.getConversation(userId, id);
    return Object.assign(ConversationResponseDto.fromEntity(conversation), {
      messages: messages.map((m) => MessageResponseDto.fromEntity(m)),
    });
  }

  @Patch('conversations/:id')
  @ApiOperation({ summary: 'Rename a chat' })
  @ApiOkResponse({ type: ConversationResponseDto })
  @ApiNotFoundResponse({ description: 'Conversation not found' })
  async renameConversation(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameConversationDto,
  ): Promise<ConversationResponseDto> {
    return ConversationResponseDto.fromEntity(
      await this.chatService.renameConversation(userId, id, dto.title),
    );
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a chat and its messages' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: 'Conversation not found' })
  async deleteConversation(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.chatService.deleteConversation(userId, id);
  }
}