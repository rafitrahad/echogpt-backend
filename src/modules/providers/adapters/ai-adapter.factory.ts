import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderType } from '../../../common/enums';
import { AiAdapter } from './ai-adapter.interface';
import { AnthropicAdapter } from './anthropic.adapter';
import { GeminiAdapter } from './gemini.adapter';
import { MockAdapter } from './mock.adapter';
import { OpenAiAdapter } from './openai.adapter';

/** Picks the right adapter for a provider type. Adding a provider = one new adapter + one line here. */
@Injectable()
export class AiAdapterFactory {
  private readonly adapters: Record<ProviderType, AiAdapter> = {
    [ProviderType.OPENAI]: new OpenAiAdapter(),
    [ProviderType.ANTHROPIC]: new AnthropicAdapter(),
    [ProviderType.GEMINI]: new GeminiAdapter(),
  };
  private readonly mock = new MockAdapter();
  private readonly mockMode: boolean;

  constructor(config: ConfigService) {
    this.mockMode = config.get<string>('AI_MOCK_MODE') === 'true';
  }

  get(type: ProviderType): AiAdapter {
    return this.mockMode ? this.mock : this.adapters[type];
  }

  get isMockMode(): boolean {
    return this.mockMode;
  }
}