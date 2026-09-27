import { MessageRole } from '../../../common/enums';
import {
  AiAdapter,
  AiChatRequest,
  AiChatResult,
  AiProviderError,
  DEFAULT_MAX_TOKENS,
  postJson,
} from './ai-adapter.interface';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

/** Google Gemini generateContent API */
export class GeminiAdapter implements AiAdapter {
  private static readonly DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

  async chat(req: AiChatRequest): Promise<AiChatResult> {
    const baseUrl = (req.baseUrl ?? GeminiAdapter.DEFAULT_BASE_URL).replace(/\/+$/, '');

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

    const data = await postJson<GeminiResponse>(
      `${baseUrl}/models/${encodeURIComponent(req.model)}:generateContent`,
      { 'x-goog-api-key': req.apiKey }, // key in a header, never in the URL
      {
        contents,
        ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
        generationConfig: { maxOutputTokens: req.maxTokens ?? DEFAULT_MAX_TOKENS },
      },
      'Gemini',
    );

    const content = (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('');
    if (!content) throw new AiProviderError('Gemini returned an empty response');

    return {
      content,
      promptTokens: data.usageMetadata?.promptTokenCount ?? null,
      completionTokens: data.usageMetadata?.candidatesTokenCount ?? null,
    };
  }
}