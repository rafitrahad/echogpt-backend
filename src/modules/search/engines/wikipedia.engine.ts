import { SearchResultItem } from '../entities/web-search.entity';
import { SEARCH_TIMEOUT_MS, SearchEngine, SearchEngineError, stripHtml } from './search-engine.interface';

interface WikipediaResponse {
  query?: { search?: { title: string; pageid: number; snippet: string }[] };
}

/** Free, no API key needed: good default for development and review */
export class WikipediaSearchEngine implements SearchEngine {
  readonly name = 'wikipedia';

  constructor(private readonly baseUrl = 'https://en.wikipedia.org') {}

  async search(query: string, maxResults: number): Promise<SearchResultItem[]> {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: String(maxResults),
      format: 'json',
      utf8: '1',
    });

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/w/api.php?${params.toString()}`, {
        // Wikipedia asks API clients to identify themselves
        headers: { 'User-Agent': 'EchoGPT-Backend/1.0 (technical assignment)' },
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      });
    } catch {
      throw new SearchEngineError('Wikipedia search is unreachable');
    }
    if (!response.ok) throw new SearchEngineError(`Wikipedia search returned HTTP ${response.status}`);

    const data = (await response.json()) as WikipediaResponse;
    return (data.query?.search ?? []).map((item) => ({
      title: item.title,
      url: `${this.baseUrl}/?curid=${item.pageid}`,
      snippet: stripHtml(item.snippet),
    }));
  }
}