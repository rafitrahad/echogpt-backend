import { MessageRole } from '../../../common/enums';
import {
  AiAdapter,
  AiChatRequest,
  AiChatResult,
  AiProviderError,
  AiStreamChunk,
  DEFAULT_MAX_TOKENS,
  postForStream,
  postJson,
  readSseJson,
} from './ai-adapter.interface';

interface AnthropicStreamEvent {
  type: string;
  delta?: { type?: string; text?: string };
  message?: { usage?: { input_tokens?: number } };
  usage?: { output_tokens?: number };
}

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** Anthropic Messages API (Claude) */
export class AnthropicAdapter implements AiAdapter {
  private static readonly DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
  private static readonly API_VERSION = '2023-06-01';

  /** Claude takes system instructions separately from the conversation */
  private buildBody(req: AiChatRequest, stream: boolean) {
    const system = req.messages
      .filter((m) => m.role === MessageRole.SYSTEM)
      .map((m) => m.content)
      .join('\n\n');
    const messages = req.messages
      .filter((m) => m.role !== MessageRole.SYSTEM)
      .map((m) => ({
        role: m.role === MessageRole.ASSISTANT ? 'assistant' : 'user',
        content: m.content,
      }));
    return {
      model: req.model,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(system ? { system } : {}),
      messages,
      ...(stream ? { stream: true } : {}),
    };
  }

  private url(req: AiChatRequest): string {
    return `${(req.baseUrl ?? AnthropicAdapter.DEFAULT_BASE_URL).replace(/\/+$/, '')}/messages`;
  }

  private headers(req: AiChatRequest): Record<string, string> {
    return { 'x-api-key': req.apiKey, 'anthropic-version': AnthropicAdapter.API_VERSION };
  }

  async chat(req: AiChatRequest): Promise<AiChatResult> {
    const data = await postJson<AnthropicResponse>(
      this.url(req),
      this.headers(req),
      this.buildBody(req, false),
      'Anthropic',
    );

    const content = (data.content ?? [])
      .filter((block) => block.type === 'text' && block.text)
      .map((block) => block.text)
      .join('');
    if (!content) throw new AiProviderError('Anthropic returned an empty response');

    return {
      content,
      promptTokens: data.usage?.input_tokens ?? null,
      completionTokens: data.usage?.output_tokens ?? null,
    };
  }

  async *stream(req: AiChatRequest, signal?: AbortSignal): AsyncGenerator<AiStreamChunk> {
    const response = await postForStream(
      this.url(req),
      this.headers(req),
      this.buildBody(req, true),
      'Anthropic',
      signal,
    );

    let promptTokens: number | null = null;
    let completionTokens: number | null = null;

    for await (const event of readSseJson<AnthropicStreamEvent>(response, 'Anthropic')) {
      if (event.type === 'message_start') promptTokens = event.message?.usage?.input_tokens ?? null;
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
        yield { type: 'text', text: event.delta.text };
      }
      if (event.type === 'message_delta') completionTokens = event.usage?.output_tokens ?? null;
      if (event.type === 'error') throw new AiProviderError('Anthropic reported an error during streaming');
    }
    yield { type: 'usage', promptTokens, completionTokens };
  }
}