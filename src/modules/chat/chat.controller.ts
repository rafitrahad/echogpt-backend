import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UsageType } from '../../common/enums';
import type {
  RequestUsageMeta,
  RequestWithUsageMeta,
} from '../../common/interfaces/request-usage-meta.interface';
import { ChatService, SendMessageResult } from './chat.service';
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
    req.usageMeta = this.usageMetaOf(result); // for the request logs / analytics
    return this.toResponse(result);
  }

  @Post('messages/stream')
  @ApiProduces('text/event-stream')
  @ApiOperation({
    summary: 'Send a prompt and receive the answer as a live stream (Server-Sent Events)',
    description:
      'Same body as POST /chat/messages. The response is text/event-stream with these events:\n' +
      '- `meta`: `{ conversationId, providerName, modelName }` (first)\n' +
      '- `token`: `{ text }` (many: append them to show the answer growing)\n' +
      '- `done`: the same JSON as POST /chat/messages (last; the chat is now saved)\n' +
      '- `error`: `{ message }` (if the AI fails mid-stream; the request is not counted)\n\n' +
      'Errors before streaming starts (401, 403, 404, 429) are normal JSON responses. ' +
      'Swagger UI cannot display a live stream: test with `curl -N`.',
  })
  @ApiOkResponse({ description: 'text/event-stream of meta, token, done (or error) events' })
  @ApiNotFoundResponse({ description: 'Conversation, provider or model not found' })
  @ApiForbiddenResponse({ description: 'Model requires a Premium subscription' })
  @ApiTooManyRequestsResponse({ description: 'Daily chat limit reached' })
  async streamMessage(
    @CurrentUser('id') userId: string,
    @Body() dto: SendMessageDto,
    @Req() req: RequestWithUsageMeta,
    @Res() res: Response,
  ): Promise<void> {
    // Stop generating (and paying for tokens) if the user closes the connection
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });

    const events = this.chatService.streamMessage(userId, dto, abort.signal);

    // The first step runs all the checks. If it throws, the global filter
    // sends a normal JSON error (401/403/404/429), because no headers were sent yet.
    const first = await events.next();

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // tell proxies (nginx) not to buffer
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      let step = first;
      while (!step.done) {
        const event = step.value;
        if (event.type === 'meta') {
          const { type, ...meta } = event;
          send(type, meta);
        } else if (event.type === 'token') {
          send('token', { text: event.text });
        } else {
          req.usageMeta = this.usageMetaOf(event.result);
          send('done', this.toResponse(event.result));
        }
        step = await events.next();
      }
    } catch (error) {
      // Headers are already sent: report the error as an SSE event instead
      const message =
        error instanceof HttpException ? error.message : 'Something went wrong while streaming';
      res.locals.errorMessage = message;
      if (!res.writableEnded) send('error', { message });
    } finally {
      res.end();
    }
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

  // ─────────── Helpers ───────────

  private toResponse(result: SendMessageResult): SendMessageResponseDto {
    return {
      conversation: ConversationResponseDto.fromEntity(result.conversation),
      userMessage: MessageResponseDto.fromEntity(result.userMessage),
      assistantMessage: MessageResponseDto.fromEntity(result.assistantMessage),
    };
  }

  private usageMetaOf(result: SendMessageResult): RequestUsageMeta {
    return {
      usageType: UsageType.CHAT,
      providerId: result.target.provider.id,
      promptTokens: result.assistantMessage.promptTokens,
      completionTokens: result.assistantMessage.completionTokens,
    };
  }
}