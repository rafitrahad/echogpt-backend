import { MessageRole } from '../../../common/enums';
import {
  AiAdapter,
  AiChatRequest,
  AiChatResult,
  AiProviderError,
  DEFAULT_MAX_TOKENS,
  postJson,
} from './ai-adapter.interface';

interface OpenAiResponse {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** OpenAI Chat Completions API (also works for OpenAI-compatible endpoints via baseUrl) */
export class OpenAiAdapter implements AiAdapter {
  private static readonly DEFAULT_BASE_URL = 'https://api.openai.com/v1';

  async chat(req: AiChatRequest): Promise<AiChatResult> {
    const baseUrl = (req.baseUrl ?? OpenAiAdapter.DEFAULT_BASE_URL).replace(/\/+$/, '');

    const data = await postJson<OpenAiResponse>(
      `${baseUrl}/chat/completions`,
      { Authorization: `Bearer ${req.apiKey}` },
      {
        model: req.model,
        messages: req.messages.map((m) => ({ role: this.mapRole(m.role), content: m.content })),
        max_completion_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      },
      'OpenAI',
    );

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new AiProviderError('OpenAI returned an empty response');

    return {
      content,
      promptTokens: data.usage?.prompt_tokens ?? null,
      completionTokens: data.usage?.completion_tokens ?? null,
    };
  }

  private mapRole(role: MessageRole): 'system' | 'user' | 'assistant' {
    if (role === MessageRole.SYSTEM) return 'system';
    return role === MessageRole.ASSISTANT ? 'assistant' : 'user';
  }
}