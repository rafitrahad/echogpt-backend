import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProvidersModule } from '../providers/providers.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UsageModule } from '../usage/usage.module';
import { createSearchEngine, SEARCH_ENGINE } from './engines/search-engine.factory';
import { SearchCache } from './entities/search-cache.entity';
import { WebSearch } from './entities/web-search.entity';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebSearch, SearchCache]),
    ProvidersModule,
    SubscriptionsModule,
    UsageModule,
  ],
  controllers: [SearchController],
  providers: [
    SearchService,
    // Which engine is used is decided once, from .env
    { provide: SEARCH_ENGINE, inject: [ConfigService], useFactory: createSearchEngine },
  ],
})
export class SearchModule {}