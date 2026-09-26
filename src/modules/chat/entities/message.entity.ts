import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { MessageRole } from '../../../common/enums';
import { AiProvider } from '../../providers/entities/ai-provider.entity';
import { Conversation } from './conversation.entity';

/**
 * One message in a conversation: the user's prompt or the AI's reply.
 */
@Entity('messages')
// Load a conversation's messages in order
@Index(['conversationId', 'createdAt'])
export class Message extends AbstractEntity {
  // ── Parent conversation: required. Deleting the chat deletes its messages ──
  @Column({ type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => Conversation, (conv) => conv.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  // Who wrote it: USER, ASSISTANT, or SYSTEM
  @Column({ type: 'enum', enum: MessageRole, enumName: 'message_role_enum' })
  role: MessageRole;

  // The message text. No length limit: AI answers can be very long
  @Column({ type: 'text' })
  content: string;

  // ── Which provider answered: optional. Survives provider deletion ──
  @Column({ type: 'uuid', nullable: true })
  providerId: string | null;

  @ManyToOne(() => AiProvider, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'provider_id' })
  provider: AiProvider | null;

  // Snapshot of the exact model that answered (kept even if the model is deleted)
  @Column({ type: 'varchar', length: 100, nullable: true })
  modelKey: string | null;

  // Cost and performance data, filled only for ASSISTANT messages
  @Column({ type: 'int', nullable: true })
  promptTokens: number | null;

  @Column({ type: 'int', nullable: true })
  completionTokens: number | null;

  @Column({ type: 'int', nullable: true })
  latencyMs: number | null;
}