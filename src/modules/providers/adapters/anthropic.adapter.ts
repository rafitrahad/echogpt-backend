import { MessageRole } from '../../../common/enums';
import {
  AiAdapter,
  AiChatRequest,
  AiChatResult,
  AiProviderError,
  DEFAULT_MAX_TOKENS,
  postJson,
} from './ai-adapter.interface';

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** Anthropic Messages API (Claude) */
export class AnthropicAdapter implements AiAdapter {
  private static readonly DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
  private static readonly API_VERSION = '2023-06-01';

  async chat(req: AiChatRequest): Promise<AiChatResult> {
    const baseUrl = (req.baseUrl ?? AnthropicAdapter.DEFAULT_BASE_URL).replace(/\/+$/, '');

    // Claude takes system instructions separately from the conversation
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

    const data = await postJson<AnthropicResponse>(
      `${baseUrl}/messages`,
      { 'x-api-key': req.apiKey, 'anthropic-version': AnthropicAdapter.API_VERSION },
      {
        model: req.model,
        max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(system ? { system } : {}),
        messages,
      },
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
}