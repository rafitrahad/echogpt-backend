import { SearchResultItem } from '../entities/web-search.entity';

/** Every web search source implements this (same adapter idea as the AI providers) */
export interface SearchEngine {
  readonly name: string;
  search(query: string, maxResults: number): Promise<SearchResultItem[]>;
}

export class SearchEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SearchEngineError';
  }
}

export const SEARCH_TIMEOUT_MS = 10_000;

/** Removes HTML tags and entities from snippets, e.g. <span class="searchmatch"> */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}