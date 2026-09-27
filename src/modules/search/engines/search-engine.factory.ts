import { ConfigService } from '@nestjs/config';
import { MockSearchEngine } from './mock.engine';
import { SearchEngine } from './search-engine.interface';
import { TavilySearchEngine } from './tavily.engine';
import { WikipediaSearchEngine } from './wikipedia.engine';

export const SEARCH_ENGINE = Symbol('SEARCH_ENGINE');

/** Chooses the search engine from SEARCH_PROVIDER in .env */
export function createSearchEngine(config: ConfigService): SearchEngine {
  const provider = config.get<string>('SEARCH_PROVIDER') ?? 'wikipedia';

  if (provider === 'mock') return new MockSearchEngine();
  if (provider === 'tavily') {
    return new TavilySearchEngine(config.getOrThrow<string>('TAVILY_API_KEY'));
  }
  return new WikipediaSearchEngine();
}