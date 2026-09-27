import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UsageType } from '../../common/enums';
import type { RequestWithUsageMeta } from '../../common/interfaces/request-usage-meta.interface';
import { SearchQueryDto } from './dto/search-query.dto';
import {
  RecentSearchDto,
  SearchHistoryItemDto,
  SearchHistoryListDto,
  SearchResponseDto,
  SuggestionsResponseDto,
} from './dto/search-response.dto';
import { RecentQueryDto, SuggestionsQueryDto } from './dto/suggestions-query.dto';
import { SearchService } from './search.service';

@ApiTags('Web Search')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI-assisted web search',
    description: 'Returns web results plus an AI summary. Repeated queries are served from a shared cache.',
  })
  @ApiOkResponse({ type: SearchResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Daily search limit reached' })
  @ApiBadGatewayResponse({ description: 'The search service failed (the request is not counted)' })
  async search(
    @CurrentUser('id') userId: string,
    @Body() dto: SearchQueryDto,
    @Req() req: RequestWithUsageMeta,
  ): Promise<SearchResponseDto> {
    const outcome = await this.searchService.search(userId, dto.query, dto.summarize ?? true);

    req.usageMeta = {
      usageType: UsageType.SEARCH,
      providerId: outcome.summaryTarget?.provider.id ?? null,
      promptTokens: outcome.promptTokens,
      completionTokens: outcome.completionTokens,
    };
    return SearchResponseDto.fromEntity(outcome.search);
  }

  @Get('history')
  @ApiOperation({ summary: 'My search history, newest first' })
  @ApiOkResponse({ type: SearchHistoryListDto })
  async history(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<SearchHistoryListDto> {
    const { items, total } = await this.searchService.history(userId, query.page, query.limit);
    return {
      items: items.map((s) => SearchHistoryItemDto.fromEntity(s)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  @Get('history/:id')
  @ApiOperation({ summary: 'One past search with its results and summary' })
  @ApiOkResponse({ type: SearchResponseDto })
  @ApiNotFoundResponse({ description: 'Search not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SearchResponseDto> {
    return SearchResponseDto.fromEntity(await this.searchService.findOne(userId, id));
  }

  @Delete('history/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one search from my history' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: 'Search not found' })
  async deleteOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.searchService.deleteOne(userId, id);
  }

  @Delete('history')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear my whole search history' })
  @ApiNoContentResponse({ description: 'History cleared' })
  async clearHistory(@CurrentUser('id') userId: string): Promise<void> {
    await this.searchService.clearHistory(userId);
  }

  @Get('recent')
  @ApiOperation({ summary: 'My recent distinct searches' })
  @ApiOkResponse({ type: [RecentSearchDto] })
  recent(
    @CurrentUser('id') userId: string,
    @Query() query: RecentQueryDto,
  ): Promise<RecentSearchDto[]> {
    return this.searchService.recent(userId, query.limit);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Suggestions from my own past searches, as I type' })
  @ApiOkResponse({ type: SuggestionsResponseDto })
  async suggestions(
    @CurrentUser('id') userId: string,
    @Query() query: SuggestionsQueryDto,
  ): Promise<SuggestionsResponseDto> {
    return { suggestions: await this.searchService.suggestions(userId, query.q, query.limit) };
  }
}