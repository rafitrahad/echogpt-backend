import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { User } from '../../users/entities/user.entity';
import { AiProvider } from '../../providers/entities/ai-provider.entity';
import { AiModel } from '../../providers/entities/ai-model.entity';

/**
 * One chat thread. Messages inside it are stored in the messages table.
 */
@Entity('conversations')
// "My chats, newest first": the sidebar query
@Index(['userId', 'updatedAt'])
export class Conversation extends AbstractEntity {
  // ── Owner: required. Deleting the user deletes their conversations ──
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.conversations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 255, default: 'New chat' })
  title: string;

  // ── Provider: optional. Deleting the provider keeps the conversation ──
  @Column({ type: 'uuid', nullable: true })
  providerId: string | null;

  @ManyToOne(() => AiProvider, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'provider_id' })
  provider: AiProvider | null;

  // ── Model: optional. Deleting the model keeps the conversation ──
  @Column({ type: 'uuid', nullable: true })
  modelId: string | null;

  @ManyToOne(() => AiModel, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'model_id' })
  model: AiModel | null;
}