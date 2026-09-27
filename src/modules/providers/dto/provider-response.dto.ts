import { ApiProperty } from '@nestjs/swagger';
import { ProviderHealth, ProviderType } from '../../../common/enums';
import { AiModel } from '../entities/ai-model.entity';
import { AiProvider } from '../entities/ai-provider.entity';

export class AiModelResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'gpt-4o-mini' }) modelKey: string;
  @ApiProperty({ example: 'GPT-4o mini' }) displayName: string;
  @ApiProperty() isEnabled: boolean;
  @ApiProperty() isDefault: boolean;
  @ApiProperty() premiumOnly: boolean;
  @ApiProperty({ nullable: true, type: Number, example: 1024 }) maxTokens: number | null;

  static fromEntity(m: AiModel): AiModelResponseDto {
    return Object.assign(new AiModelResponseDto(), {
      id: m.id,
      modelKey: m.modelKey,
      displayName: m.displayName,
      isEnabled: m.isEnabled,
      isDefault: m.isDefault,
      premiumOnly: m.premiumOnly,
      maxTokens: m.maxTokens,
    });
  }
}

/** Admin view. The API key is NEVER included, only a masked hint. */
export class AiProviderResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'OpenAI' }) name: string;
  @ApiProperty({ enum: ProviderType }) type: ProviderType;
  @ApiProperty({ nullable: true, type: String }) baseUrl: string | null;
  @ApiProperty({ example: '••••x9Qa' }) apiKeyMasked: string;
  @ApiProperty() isEnabled: boolean;
  @ApiProperty() isDefault: boolean;
  @ApiProperty({ enum: ProviderHealth }) healthStatus: ProviderHealth;
  @ApiProperty({ nullable: true, type: Date }) lastHealthCheckAt: Date | null;
  @ApiProperty({ type: [AiModelResponseDto] }) models: AiModelResponseDto[];
  @ApiProperty() createdAt: Date;

  static fromEntity(p: AiProvider): AiProviderResponseDto {
    return Object.assign(new AiProviderResponseDto(), {
      id: p.id,
      name: p.name,
      type: p.type,
      baseUrl: p.baseUrl,
      apiKeyMasked: `••••${p.apiKeyLast4 ?? ''}`,
      isEnabled: p.isEnabled,
      isDefault: p.isDefault,
      healthStatus: p.healthStatus,
      lastHealthCheckAt: p.lastHealthCheckAt,
      models: (p.models ?? []).map((m) => AiModelResponseDto.fromEntity(m)),
      createdAt: p.createdAt,
    });
  }
}

export class PublicModelDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'GPT-4o mini' }) displayName: string;
  @ApiProperty() isDefault: boolean;
  @ApiProperty() premiumOnly: boolean;
}

/** What the extension sees: enabled providers and models only, nothing sensitive */
export class PublicProviderDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'OpenAI' }) name: string;
  @ApiProperty({ enum: ProviderType }) type: ProviderType;
  @ApiProperty() isDefault: boolean;
  @ApiProperty({ type: [PublicModelDto] }) models: PublicModelDto[];

  static fromEntity(p: AiProvider): PublicProviderDto {
    return Object.assign(new PublicProviderDto(), {
      id: p.id,
      name: p.name,
      type: p.type,
      isDefault: p.isDefault,
      models: (p.models ?? [])
        .filter((m) => m.isEnabled)
        .map((m) => ({ id: m.id, displayName: m.displayName, isDefault: m.isDefault, premiumOnly: m.premiumOnly })),
    });
  }
}

export class HealthCheckResultDto {
  @ApiProperty({ enum: ProviderHealth, example: ProviderHealth.HEALTHY }) status: ProviderHealth;
  @ApiProperty({ example: 842, nullable: true, type: Number }) latencyMs: number | null;
  @ApiProperty({ example: 'gpt-4o-mini', nullable: true, type: String }) testedModel: string | null;
  @ApiProperty() checkedAt: Date;
  @ApiProperty({ nullable: true, type: String, example: null }) error: string | null;
}