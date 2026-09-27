import { SearchResultItem } from '../entities/web-search.entity';
import { SearchEngine } from './search-engine.interface';

/** Fake results: no network needed (SEARCH_PROVIDER=mock) */
export class MockSearchEngine implements SearchEngine {
  readonly name = 'mock';

  async search(query: string, maxResults: number): Promise<SearchResultItem[]> {
    return Array.from({ length: Math.min(3, maxResults) }, (_, i) => ({
      title: `Mock result ${i + 1} for "${query}"`,
      url: `https://example.com/mock/${i + 1}?q=${encodeURIComponent(query)}`,
      snippet: `This is a fake search result number ${i + 1}. Set SEARCH_PROVIDER=wikipedia for real results.`,
    }));
  }
}