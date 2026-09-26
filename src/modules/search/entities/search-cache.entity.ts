import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { SearchResultItem } from './web-search.entity';

/**
 * Bonus: shared search cache. One row per unique (normalized) query.
 * No user link: the cache stores WHAT was searched, never WHO searched it.
 */
@Entity('search_cache')
export class SearchCache extends AbstractEntity {
  // SHA-256 of the normalized query (lowercased, trimmed, single spaces)
  @Column({ type: 'varchar', length: 64, unique: true })
  queryHash: string;

  // The normalized query in readable form (for admins and debugging)
  @Column({ type: 'varchar', length: 500 })
  query: string;

  @Column({ type: 'jsonb' })
  results: SearchResultItem[];

  @Column({ type: 'text', nullable: true })
  aiSummary: string | null;

  // How many times this entry was served from cache
  @Column({ type: 'int', default: 0 })
  hitCount: number;

  // After this moment the entry is stale and must be refreshed
  @Index()
  @Column({ type: 'timestamptz' })
  expiresAt: Date;
}