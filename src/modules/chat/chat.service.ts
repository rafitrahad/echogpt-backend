import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MessageRole, UsageType } from '../../common/enums';
import {
  AiChatMessage,
  AiChatRequest,
  AiChatResult,
  AiProviderError,
} from '../providers/adapters/ai-adapter.interface';
import { ChatTarget, ProvidersService } from '../providers/providers.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsageService } from '../usage/usage.service';
import { SendMessageDto } from './dto/send-message.dto';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';

const SYSTEM_PROMPT =
  'You are EchoGPT, a helpful AI assistant inside a browser extension. ' +
  "Answer clearly and concisely, in the same language as the user's message.";

/** How many previous messages are sent to the AI as context (cost control) */
const MAX_HISTORY_MESSAGES = 20;

export interface SendMessageResult {
  conversation: Conversation;
  userMessage: Message;
  assistantMessage: Message;
  target: ChatTarget;
}

/** Events sent to the client while streaming */
export type ChatStreamEvent =
  | { type: 'meta'; conversationId: string | null; providerName: string; modelName: string }
  | { type: 'token'; text: string }
  | { type: 'done'; result: SendMessageResult };

interface PreparedChat {
  conversation: Conversation | null;
  target: ChatTarget;
  aiMessages: AiChatMessage[];
  askedAt: Date;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly providersService: ProvidersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly usageService: UsageService,
    @InjectRepository(Conversation) private readonly conversationsRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly messagesRepo: Repository<Message>,
  ) {}

  // ─────────────────────────── Send a prompt ───────────────────────────

  async sendMessage(userId: string, dto: SendMessageDto): Promise<SendMessageResult> {
    const prepared = await this.prepare(userId, dto);
    const { target } = prepared;

    // Ask the AI. If it fails, give the request back.
    let answer: AiChatResult;
    try {
      answer = await target.adapter.chat(this.aiRequest(prepared));
    } catch (error) {
      return this.handleAiFailure(userId, target, error);
    }
    return this.persist(userId, dto, prepared, answer, new Date());
  }

  /**
   * Streaming version (bonus): yields the answer piece by piece.
   * Errors BEFORE the first event (not found, 403, 429...) are normal HTTP errors.
   * The chat is saved only when the whole answer has arrived.
   */
  async *streamMessage(
    userId: string,
    dto: SendMessageDto,
    signal: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent> {
    const prepared = await this.prepare(userId, dto);
    const { target } = prepared;

    yield {
      type: 'meta',
      conversationId: prepared.conversation?.id ?? null,
      providerName: target.provider.name,
      modelName: target.model.displayName,
    };

    let content = '';
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;
    try {
      for await (const chunk of target.adapter.stream(this.aiRequest(prepared), signal)) {
        if (chunk.type === 'text') {
          content += chunk.text;
          yield { type: 'token', text: chunk.text };
        } else {
          promptTokens = chunk.promptTokens;
          completionTokens = chunk.completionTokens;
        }
      }
      if (signal.aborted) throw new AiProviderError('Client disconnected');
      if (!content) throw new AiProviderError(`${target.provider.name} returned an empty response`);
    } catch (error) {
      await this.handleAiFailure(userId, target, error);
    }

    const result = await this.persist(
      userId,
      dto,
      prepared,
      { content, promptTokens, completionTokens },
      new Date(),
    );
    yield { type: 'done', result };
  }

  /** Steps shared by normal and streaming chat: ownership, AI choice, usage, context */
  private async prepare(userId: string, dto: SendMessageDto): Promise<PreparedChat> {
    // 1. Existing chat? It must belong to THIS user (IDOR protection)
    const conversation = dto.conversationId
      ? await this.findOwnedConversationOrFail(userId, dto.conversationId)
      : null;

    // 2. Which AI answers? (validated BEFORE using the daily allowance)
    const target = await this.resolveTarget(userId, dto, conversation);

    // 3. Use one request from today's limit (429 if none left)
    await this.usageService.consume(userId, UsageType.CHAT);

    // 4. Context: system prompt + recent history + the new question
    const history = conversation ? await this.loadHistory(conversation.id) : [];
    const aiMessages: AiChatMessage[] = [
      { role: MessageRole.SYSTEM, content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: MessageRole.USER, content: dto.prompt },
    ];

    return { conversation, target, aiMessages, askedAt: new Date() };
  }

  private aiRequest(prepared: PreparedChat): AiChatRequest {
    const { target } = prepared;
    return {
      apiKey: target.apiKey,
      baseUrl: target.provider.baseUrl,
      model: target.model.modelKey,
      messages: prepared.aiMessages,
      maxTokens: target.model.maxTokens,
    };
  }

  /** The AI failed: give the request back and turn the error into a clear 502 */
  private async handleAiFailure(userId: string, target: ChatTarget, error: unknown): Promise<never> {
    await this.usageService.refund(userId, UsageType.CHAT);
    if (error instanceof AiProviderError) {
      this.logger.warn(`AI call failed (${target.provider.name}): ${error.message}`);
      throw new BadGatewayException(
        `${target.provider.name} did not respond. Please try again or choose another provider.`,
      );
    }
    throw error;
  }

  /** Save everything together: the chat, the question and the answer */
  private persist(
    userId: string,
    dto: SendMessageDto,
    prepared: PreparedChat,
    answer: AiChatResult,
    answeredAt: Date,
  ): Promise<SendMessageResult> {
    const { conversation, target, askedAt } = prepared;

    return this.dataSource.transaction(async (manager) => {
      const chat =
        conversation ??
        manager.create(Conversation, { userId, title: this.titleFrom(dto.prompt) });
      // Set the relation objects, not just the ids: when a loaded relation object
      // is present, TypeORM saves IT and ignores the id column.
      chat.provider = target.provider;
      chat.model = target.model;
      chat.providerId = target.provider.id;
      chat.modelId = target.model.id;
      chat.updatedAt = answeredAt; // moves the chat to the top of the list
      const savedChat = await manager.save(chat);

      const userMessage = await manager.save(
        manager.create(Message, {
          conversationId: savedChat.id,
          role: MessageRole.USER,
          content: dto.prompt,
          createdAt: askedAt,
        }),
      );
      const assistantMessage = await manager.save(
        manager.create(Message, {
          conversationId: savedChat.id,
          role: MessageRole.ASSISTANT,
          content: answer.content,
          providerId: target.provider.id,
          modelKey: target.model.modelKey, // snapshot, survives model deletion
          promptTokens: answer.promptTokens,
          completionTokens: answer.completionTokens,
          latencyMs: answeredAt.getTime() - askedAt.getTime(),
          createdAt: answeredAt,
        }),
      );

      return { conversation: savedChat, userMessage, assistantMessage, target };
    });
  }

  // ─────────────────────────── Conversation history ───────────────────────────

  async listConversations(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ items: Conversation[]; total: number }> {
    const [items, total] = await this.conversationsRepo.findAndCount({
      where: { userId },
      relations: { provider: true, model: true },
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  async getConversation(userId: string, id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    const conversation = await this.findOwnedConversationOrFail(userId, id);
    const messages = await this.messagesRepo.find({
      where: { conversationId: id },
      order: { createdAt: 'ASC' },
    });
    return { conversation, messages };
  }

  async renameConversation(userId: string, id: string, title: string): Promise<Conversation> {
    const conversation = await this.findOwnedConversationOrFail(userId, id);
    conversation.title = title.trim();
    return this.conversationsRepo.save(conversation);
  }

  async deleteConversation(userId: string, id: string): Promise<void> {
    // userId in the WHERE: a user can only ever delete their own chats
    const result = await this.conversationsRepo.delete({ id, userId });
    if (!result.affected) throw new NotFoundException('Conversation not found');
  }

  // ─────────────────────────── Helpers ───────────────────────────

  /** 404 (not 403) for other people's chats: don't even reveal that they exist */
  private async findOwnedConversationOrFail(userId: string, id: string): Promise<Conversation> {
    const conversation = await this.conversationsRepo.findOne({
      where: { id, userId },
      relations: { provider: true, model: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  /**
   * Explicit choice in the request > the chat's last choice > the default.
   * If the chat's saved provider was disabled or deleted, quietly fall back to the default.
   */
  private async resolveTarget(
    userId: string,
    dto: SendMessageDto,
    conversation: Conversation | null,
  ): Promise<ChatTarget> {
    const { plan } = await this.subscriptionsService.getActiveSubscription(userId);
    const isPremium = plan.priceCents > 0;

    if (dto.providerId || dto.modelId) {
      return this.providersService.resolveChatTarget({
        providerId: dto.providerId,
        modelId: dto.modelId,
        isPremium,
      });
    }

    if (conversation?.providerId) {
      try {
        return await this.providersService.resolveChatTarget({
          providerId: conversation.providerId,
          modelId: conversation.modelId ?? undefined,
          isPremium,
        });
      } catch {
        // saved choice no longer available: use the default below
      }
    }
    return this.providersService.resolveChatTarget({ isPremium });
  }

  /** The most recent messages, oldest first */
  private async loadHistory(conversationId: string): Promise<Message[]> {
    const recent = await this.messagesRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: MAX_HISTORY_MESSAGES,
    });
    return recent.reverse();
  }

  /** "Give me a thesis outline on ..." -> first 60 characters as the chat title */
  private titleFrom(prompt: string): string {
    const clean = prompt.replace(/\s+/g, ' ').trim();
    return clean.length > 60 ? `${clean.slice(0, 57)}...` : clean || 'New chat';
  }
}