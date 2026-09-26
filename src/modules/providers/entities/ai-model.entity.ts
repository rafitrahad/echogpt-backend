import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { AiProvider } from './ai-provider.entity';

/**
 * Models offered by each provider (e.g. gpt-4o-mini, a Claude model, a Gemini model).
 */
@Entity('ai_models')
// The same model can't be added twice to the same provider
@Index('uq_ai_models_provider_model_key', ['providerId', 'modelKey'], {
  unique: true,
})
// At most ONE default model per provider
@Index('uq_ai_models_one_default_per_provider', ['providerId'], {
  unique: true,
  where: `"is_default" = true`,
})
// A disabled model can never be a provider's default
@Check('chk_ai_models_default_is_enabled', `NOT ("is_default" = true AND "is_enabled" = false)`)
export class AiModel extends AbstractEntity {
  // ── Relation: many models belong to one provider ──
  @Column({ type: 'uuid' })
  providerId: string;

  @ManyToOne(() => AiProvider, (provider) => provider.models, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider: AiProvider;

  // Exact model id sent to the provider's API
  @Column({ type: 'varchar', length: 100 })
  modelKey: string;

  // Friendly name shown in the extension's dropdown
  @Column({ type: 'varchar', length: 100 })
  displayName: string;

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  // true = only PREMIUM subscribers can use this model
  @Column({ type: 'boolean', default: false })
  premiumOnly: boolean;

  // Max length of the AI's answer (controls cost). null = provider's default
  @Column({ type: 'int', nullable: true })
  maxTokens: number | null;
}