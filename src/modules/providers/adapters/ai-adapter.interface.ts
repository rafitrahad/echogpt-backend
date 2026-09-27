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
/** One piece of a streamed answer: a bit of text, or the final token counts */
export type AiStreamChunk =
  | { type: 'text'; text: string }
  | { type: 'usage'; promptTokens: number | null; completionTokens: number | null };

/** Every AI provider speaks through this one interface (the "multi-plug adapter") */
export interface AiAdapter {
  chat(request: AiChatRequest): Promise<AiChatResult>;
  /** Same as chat(), but yields the answer piece by piece as it is generated */
  stream(request: AiChatRequest, signal?: AbortSignal): AsyncGenerator<AiStreamChunk>;
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
export const AI_STREAM_TIMEOUT_MS = 120_000; // streams take longer: they send the whole answer
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

/** POST JSON and return the raw response, for streaming (the body is read piece by piece) */
export async function postForStream(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  providerLabel: string,
  signal?: AbortSignal,
): Promise<Response> {
  const timeout = AbortSignal.timeout(AI_STREAM_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...headers },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'timed out' : 'is unreachable';
    throw new AiProviderError(`${providerLabel} ${reason}`);
  }
  if (!response.ok || !response.body) {
    throw new AiProviderError(`${providerLabel} returned HTTP ${response.status}`, response.status);
  }
  return response;
}

/**
 * Reads a Server-Sent Events body and yields each "data:" line as parsed JSON.
 * SSE format:  data: {...}\n\n   (the stream may end with  data: [DONE])
 */
export async function* readSseJson<T>(response: Response, providerLabel: string): AsyncGenerator<T> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Network chunks can cut a line in half: only handle complete lines
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);

        if (!line.startsWith('data:')) continue; // ignore "event:" lines, comments, blank lines
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        yield JSON.parse(data) as T;
      }
    }
  } catch (error) {
    if (error instanceof SyntaxError) throw new AiProviderError(`${providerLabel} sent an invalid stream`);
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      throw new AiProviderError(`${providerLabel} stream was interrupted`);
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}