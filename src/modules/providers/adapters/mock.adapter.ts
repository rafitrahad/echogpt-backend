import { MessageRole } from '../../../common/enums';
import { AiAdapter, AiChatRequest, AiChatResult, AiStreamChunk } from './ai-adapter.interface';

/**
 * Fake provider for development and review: no network, no API key, no cost.
 * Enabled with AI_MOCK_MODE=true.
 */
export class MockAdapter implements AiAdapter {
  async chat(req: AiChatRequest): Promise<AiChatResult> {
    const lastUserMessage =
      [...req.messages].reverse().find((m) => m.role === MessageRole.USER)?.content ?? '';

    await new Promise((resolve) => setTimeout(resolve, 150)); // feel like a real API

    const content =
      `[Mock response from ${req.model}] You said: "${lastUserMessage.slice(0, 200)}". ` +
      'Set AI_MOCK_MODE=false and add a real API key to get real answers.';

    return {
      content,
      promptTokens: Math.ceil(req.messages.reduce((n, m) => n + m.content.length, 0) / 4),
      completionTokens: Math.ceil(content.length / 4),
    };
  }
    /** Streams the mock answer word by word, like a real model */
  async *stream(req: AiChatRequest, signal?: AbortSignal): AsyncGenerator<AiStreamChunk> {
    const { content, promptTokens, completionTokens } = await this.chat(req);
    for (const word of content.split(/(?<= )/)) {
      if (signal?.aborted) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
      yield { type: 'text', text: word };
    }
    yield { type: 'usage', promptTokens, completionTokens };
  }
}