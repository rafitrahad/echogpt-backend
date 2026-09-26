import { Check, Column, Entity, Index, OneToMany } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { ProviderHealth, ProviderType } from '../../../common/enums';
import { AiModel } from './ai-model.entity';
@Entity('ai_providers')
// Database guarantee: at most ONE default provider
@Index('uq_ai_providers_single_default', ['isDefault'], {
  unique: true,
  where: `"is_default" = true`,
})
// Database guarantee: a disabled provider can never be the default
@Check('chk_ai_providers_default_is_enabled', `NOT ("is_default" = true AND "is_enabled" = false)`)
export class AiProvider extends AbstractEntity {
  // Display name chosen by the admin: 'OpenAI', 'Claude', 'Gemini'
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  // Decides which adapter (code) talks to this provider
  @Column({ type: 'enum', enum: ProviderType, enumName: 'provider_type_enum' })
  type: ProviderType;

  // Optional custom endpoint (proxy, Azure OpenAI, etc.). null = official URL
  @Column({ type: 'varchar', length: 500, nullable: true })
  baseUrl: string | null;

  // AES-256-GCM encrypted key, stored as "iv:authTag:ciphertext".
  // select: false -> never loaded (or returned) unless explicitly requested
  @Column({ type: 'text', select: false })
  apiKeyEncrypted: string;

  // Only the last 4 characters, for display: "sk-...x9Qa"
  @Column({ type: 'varchar', length: 4, nullable: true })
  apiKeyLast4: string | null;

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({
    type: 'enum',
    enum: ProviderHealth,
    enumName: 'provider_health_enum',
    default: ProviderHealth.UNKNOWN,
  })
  healthStatus: ProviderHealth;

  @Column({ type: 'timestamptz', nullable: true })
  lastHealthCheckAt: Date | null;

    @OneToMany(() => AiModel, (model) => model.provider)
  models: AiModel[];
}