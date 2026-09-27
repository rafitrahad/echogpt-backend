import { ApiProperty } from '@nestjs/swagger';
import { WebSearch } from '../entities/web-search.entity';

export class SearchResultItemDto {
  @ApiProperty({ example: 'Economy of Bangladesh' }) title: string;
  @ApiProperty({ example: 'https://en.wikipedia.org/?curid=12345' }) url: string;
  @ApiProperty({ example: 'Bangladesh is a developing market economy...' }) snippet: string;
}

export class SearchResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'Bangladesh GDP growth' }) query: string;
  @ApiProperty({ type: [SearchResultItemDto] }) results: SearchResultItemDto[];
  @ApiProperty({ nullable: true, type: String, example: 'Bangladesh has grown at around 6% a year [1]...' })
  aiSummary: string | null;
  @ApiProperty({ example: 8 }) resultCount: number;
  @ApiProperty({ example: false, description: 'true = served from the shared cache' }) fromCache: boolean;
  @ApiProperty() createdAt: Date;

  static fromEntity(s: WebSearch): SearchResponseDto {
    return Object.assign(new SearchResponseDto(), {
      id: s.id,
      query: s.query,
      results: s.results ?? [],
      aiSummary: s.aiSummary,
      resultCount: s.resultCount,
      fromCache: s.fromCache,
      createdAt: s.createdAt,
    });
  }
}

export class SearchHistoryItemDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'Bangladesh GDP growth' }) query: string;
  @ApiProperty({ example: 8 }) resultCount: number;
  @ApiProperty() fromCache: boolean;
  @ApiProperty() createdAt: Date;

  static fromEntity(s: WebSearch): SearchHistoryItemDto {
    return Object.assign(new SearchHistoryItemDto(), {
      id: s.id,
      query: s.query,
      resultCount: s.resultCount,
      fromCache: s.fromCache,
      createdAt: s.createdAt,
    });
  }
}

export class SearchHistoryListDto {
  @ApiProperty({ type: [SearchHistoryItemDto] }) items: SearchHistoryItemDto[];
  @ApiProperty({ example: 42 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) limit: number;
}

export class RecentSearchDto {
  @ApiProperty({ example: 'Bangladesh GDP growth' }) query: string;
  @ApiProperty() lastSearchedAt: Date;
}

export class SuggestionsResponseDto {
  @ApiProperty({ example: ['bangladesh gdp growth', 'bangla font download'] }) suggestions: string[];
}