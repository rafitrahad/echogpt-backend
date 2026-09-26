import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { User } from '../../users/entities/user.entity';
import { AiProvider } from '../../providers/entities/ai-provider.entity';

/** Shape of one search result, stored inside the jsonb "results" column */
export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

/**
 * One search made by one user: powers history, recent searches and suggestions.
 */
@Entity('web_searches')
// "My searches, newest first": history, recent searches and suggestions
@Index(['userId', 'createdAt'])
export class WebSearch extends AbstractEntity {
  // ── Owner: required. Deleting the user deletes their search history ──
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.webSearches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 500 })
  query: string;

  // The list of results, stored as structured JSON
  @Column({ type: 'jsonb', nullable: true })
  results: SearchResultItem[] | null;

  // AI-written summary of the results
  @Column({ type: 'text', nullable: true })
  aiSummary: string | null;

  @Column({ type: 'int', default: 0 })
  resultCount: number;

  // ── AI used for the summary: optional, survives provider deletion ──
  @Column({ type: 'uuid', nullable: true })
  providerId: string | null;

  @ManyToOne(() => AiProvider, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'provider_id' })
  provider: AiProvider | null;

  // true = answered from the shared cache, no external API was called
  @Column({ type: 'boolean', default: false })
  fromCache: boolean;
}