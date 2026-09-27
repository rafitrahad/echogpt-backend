import { SearchResultItem } from '../entities/web-search.entity';
import { SEARCH_TIMEOUT_MS, SearchEngine, SearchEngineError } from './search-engine.interface';

interface TavilyResponse {
  results?: { title: string; url: string; content: string }[];
}

/** Tavily: a search API built for AI apps (needs TAVILY_API_KEY) */
export class TavilySearchEngine implements SearchEngine {
  readonly name = 'tavily';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://api.tavily.com',
  ) {}

  async search(query: string, maxResults: number): Promise<SearchResultItem[]> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ query, max_results: maxResults }),
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      });
    } catch {
      throw new SearchEngineError('Tavily search is unreachable');
    }
    if (!response.ok) throw new SearchEngineError(`Tavily search returned HTTP ${response.status}`);

    const data = (await response.json()) as TavilyResponse;
    return (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content.slice(0, 500),
    }));
  }
}