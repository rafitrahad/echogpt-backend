import { MessageRole } from '../../../common/enums';

export interface AiChatMessage {
  role: MessageRole;
  content: string;
}

export interface AiChatRequest {
  apiKey: string;
  baseUrl: string | null;
  model: string;
  messages: AiChatMessage[];
  maxTokens: number | null;
}

export interface AiChatResult {
  content: string;
  promptTokens: number | null;
  completionTokens: number | null;
}

/** Every AI provider speaks through this one interface (the "multi-plug adapter") */
export interface AiAdapter {
  chat(request: AiChatRequest): Promise<AiChatResult>;
}

/** Thrown by adapters when the provider fails. Never contains the API key. */
export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number | null = null,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export const AI_REQUEST_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_TOKENS = 1024;

/** Shared HTTP helper: POST JSON with a timeout, turn failures into AiProviderError */
export async function postJson<T>(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  providerLabel: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'timed out' : 'is unreachable';
    throw new AiProviderError(`${providerLabel} ${reason}`);
  }

  if (!response.ok) {
    throw new AiProviderError(`${providerLabel} returned HTTP ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}