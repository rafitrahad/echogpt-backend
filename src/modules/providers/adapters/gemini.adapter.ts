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

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

/** Google Gemini generateContent API */
export class GeminiAdapter implements AiAdapter {
  private static readonly DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

  private buildBody(req: AiChatRequest) {
    const systemText = req.messages
      .filter((m) => m.role === MessageRole.SYSTEM)
      .map((m) => m.content)
      .join('\n\n');
    // Gemini calls the assistant "model"
    const contents = req.messages
      .filter((m) => m.role !== MessageRole.SYSTEM)
      .map((m) => ({
        role: m.role === MessageRole.ASSISTANT ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
    return {
      contents,
      ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
      generationConfig: { maxOutputTokens: req.maxTokens ?? DEFAULT_MAX_TOKENS },
    };
  }

  private modelUrl(req: AiChatRequest, action: string): string {
    const baseUrl = (req.baseUrl ?? GeminiAdapter.DEFAULT_BASE_URL).replace(/\/+$/, '');
    return `${baseUrl}/models/${encodeURIComponent(req.model)}:${action}`;
  }

  async chat(req: AiChatRequest): Promise<AiChatResult> {
    const data = await postJson<GeminiResponse>(
      this.modelUrl(req, 'generateContent'),
      { 'x-goog-api-key': req.apiKey }, // key in a header, never in the URL
      this.buildBody(req),
      'Gemini',
    );

    const content = this.textOf(data);
    if (!content) throw new AiProviderError('Gemini returned an empty response');

    return {
      content,
      promptTokens: data.usageMetadata?.promptTokenCount ?? null,
      completionTokens: data.usageMetadata?.candidatesTokenCount ?? null,
    };
  }

  async *stream(req: AiChatRequest, signal?: AbortSignal): AsyncGenerator<AiStreamChunk> {
    const response = await postForStream(
      this.modelUrl(req, 'streamGenerateContent') + '?alt=sse', // alt=sse = Server-Sent Events format
      { 'x-goog-api-key': req.apiKey },
      this.buildBody(req),
      'Gemini',
      signal,
    );

    let usage: GeminiResponse['usageMetadata'];
    for await (const event of readSseJson<GeminiResponse>(response, 'Gemini')) {
      const text = this.textOf(event);
      if (text) yield { type: 'text', text };
      if (event.usageMetadata) usage = event.usageMetadata; // the last one has the totals
    }
    yield {
      type: 'usage',
      promptTokens: usage?.promptTokenCount ?? null,
      completionTokens: usage?.candidatesTokenCount ?? null,
    };
  }

  private textOf(data: GeminiResponse): string {
    return (data.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('');
  }
}