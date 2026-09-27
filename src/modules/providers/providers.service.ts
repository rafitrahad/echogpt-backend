import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { MessageRole, ProviderHealth } from '../../common/enums';
import { decrypt, encrypt } from '../../common/utils/encryption.util';
import { AiAdapterFactory } from './adapters/ai-adapter.factory';
import { AiAdapter, AiProviderError } from './adapters/ai-adapter.interface';
import { CreateModelDto } from './dto/create-model.dto';
import { CreateProviderDto } from './dto/create-provider.dto';
import { HealthCheckResultDto } from './dto/provider-response.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { AiModel } from './entities/ai-model.entity';
import { AiProvider } from './entities/ai-provider.entity';

/** Everything the chat/search services need to call an AI */
export interface ChatTarget {
  provider: AiProvider;
  model: AiModel;
  apiKey: string; // decrypted, in memory only
  adapter: AiAdapter;
}

const DEGRADED_LATENCY_MS = 5_000;

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);
  private readonly encryptionKey: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly adapterFactory: AiAdapterFactory,
    config: ConfigService,
    @InjectRepository(AiProvider) private readonly providersRepo: Repository<AiProvider>,
    @InjectRepository(AiModel) private readonly modelsRepo: Repository<AiModel>,
  ) {
    this.encryptionKey = config.getOrThrow<string>('ENCRYPTION_KEY');
  }

  // ─────────────────────────── Providers (admin) ───────────────────────────

  findAll(): Promise<AiProvider[]> {
    return this.providersRepo.find({
      relations: { models: true },
      order: { createdAt: 'ASC', models: { createdAt: 'ASC' } },
    });
  }

  async findOne(id: string): Promise<AiProvider> {
    const provider = await this.providersRepo.findOne({
      where: { id },
      relations: { models: true },
      order: { models: { createdAt: 'ASC' } },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    return provider;
  }

  async create(dto: CreateProviderDto): Promise<AiProvider> {
    await this.assertNameAvailable(dto.name);

    const defaults = dto.models.filter((m) => m.isDefault).length;
    if (defaults > 1) throw new BadRequestException('Only one model can be the default');
    const keys = dto.models.map((m) => m.modelKey);
    if (new Set(keys).size !== keys.length) throw new BadRequestException('Duplicate modelKey in models');

    const id = await this.dataSource.transaction(async (manager) => {
      // The very first provider automatically becomes the default
      const hasDefault = await manager.existsBy(AiProvider, { isDefault: true });

      const provider = await manager.save(
        manager.create(AiProvider, {
          name: dto.name.trim(),
          type: dto.type,
          baseUrl: dto.baseUrl ?? null,
          apiKeyEncrypted: encrypt(dto.apiKey, this.encryptionKey),
          apiKeyLast4: dto.apiKey.slice(-4),
          isEnabled: true,
          isDefault: !hasDefault,
        }),
      );

      await manager.save(
        dto.models.map((m, index) =>
          manager.create(AiModel, {
            providerId: provider.id,
            modelKey: m.modelKey,
            displayName: m.displayName.trim(),
            premiumOnly: m.premiumOnly ?? false,
            maxTokens: m.maxTokens ?? null,
            // If none is marked default, the first one is
            isDefault: defaults === 1 ? (m.isDefault ?? false) : index === 0,
          }),
        ),
      );
      return provider.id;
    });

    return this.findOne(id);
  }

  async update(id: string, dto: UpdateProviderDto): Promise<AiProvider> {
    const provider = await this.findOne(id);
    const changes: Partial<AiProvider> = {};

    if (dto.name !== undefined && dto.name.trim() !== provider.name) {
      await this.assertNameAvailable(dto.name);
      changes.name = dto.name.trim();
    }
    if (dto.baseUrl !== undefined) changes.baseUrl = dto.baseUrl;
    if (dto.apiKey !== undefined) {
      changes.apiKeyEncrypted = encrypt(dto.apiKey, this.encryptionKey);
      changes.apiKeyLast4 = dto.apiKey.slice(-4);
      changes.healthStatus = ProviderHealth.UNKNOWN; // new key = unknown until checked
      changes.lastHealthCheckAt = null;
    }

    if (Object.keys(changes).length > 0) {
      await this.providersRepo.update(id, changes);
    }
    return this.findOne(id);
  }

  async setEnabled(id: string, isEnabled: boolean): Promise<AiProvider> {
    const provider = await this.findOne(id);
    if (!isEnabled && provider.isDefault) {
      throw new ConflictException('This is the default provider. Choose another default before disabling it.');
    }
    await this.providersRepo.update(id, { isEnabled });
    return this.findOne(id);
  }

  async setDefault(id: string): Promise<AiProvider> {
    const provider = await this.findOne(id);
    if (!provider.isEnabled) throw new ConflictException('A disabled provider cannot be the default');
    if (!provider.models.some((m) => m.isEnabled)) {
      throw new ConflictException('This provider has no enabled models');
    }

    await this.dataSource.transaction(async (manager) => {
      // Unset the old default first: the database allows only one
      await manager.update(AiProvider, { isDefault: true }, { isDefault: false });
      await manager.update(AiProvider, { id }, { isDefault: true });
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const provider = await this.findOne(id);
    if (provider.isDefault) {
      throw new ConflictException('The default provider cannot be deleted. Choose another default first.');
    }
    // Models are deleted (CASCADE); conversations and messages keep their history (SET NULL)
    await this.providersRepo.delete(id);
  }

  // ─────────────────────────── Health check ───────────────────────────

  async healthCheck(id: string): Promise<HealthCheckResultDto> {
    const provider = await this.findOne(id);
    const model = provider.models.find((m) => m.isDefault && m.isEnabled) ?? provider.models.find((m) => m.isEnabled);
    const checkedAt = new Date();

    let status: ProviderHealth;
    let latencyMs: number | null = null;
    let error: string | null = null;

    if (!model) {
      status = ProviderHealth.DOWN;
      error = 'No enabled model to test';
    } else {
      const started = Date.now();
      try {
        await this.adapterFactory.get(provider.type).chat({
          apiKey: await this.getDecryptedKey(provider.id),
          baseUrl: provider.baseUrl,
          model: model.modelKey,
          messages: [{ role: MessageRole.USER, content: 'Reply with the single word: pong' }],
          maxTokens: 10,
        });
        latencyMs = Date.now() - started;
        status = latencyMs > DEGRADED_LATENCY_MS ? ProviderHealth.DEGRADED : ProviderHealth.HEALTHY;
      } catch (e) {
        status = ProviderHealth.DOWN;
        error = e instanceof AiProviderError ? e.message : 'Unexpected error';
      }
    }

    await this.providersRepo.update(id, { healthStatus: status, lastHealthCheckAt: checkedAt });
    return { status, latencyMs, testedModel: model?.modelKey ?? null, checkedAt, error };
  }

  // ─────────────────────────── Models (admin) ───────────────────────────

  async addModel(providerId: string, dto: CreateModelDto): Promise<AiModel> {
    const provider = await this.findOne(providerId);
    if (provider.models.some((m) => m.modelKey === dto.modelKey)) {
      throw new ConflictException('This provider already has that model');
    }
    const makeDefault = dto.isDefault === true || !provider.models.some((m) => m.isDefault);

    return this.dataSource.transaction(async (manager) => {
      if (makeDefault) await this.unsetDefaultModel(manager, providerId);
      return manager.save(
        manager.create(AiModel, {
          providerId,
          modelKey: dto.modelKey,
          displayName: dto.displayName.trim(),
          premiumOnly: dto.premiumOnly ?? false,
          maxTokens: dto.maxTokens ?? null,
          isDefault: makeDefault,
        }),
      );
    });
  }

  async updateModel(providerId: string, modelId: string, dto: UpdateModelDto): Promise<AiModel> {
    const model = await this.findModelOrFail(providerId, modelId);

    const willBeEnabled = dto.isEnabled ?? model.isEnabled;
    const willBeDefault = dto.isDefault === true || (model.isDefault && dto.isDefault !== false);

    if (dto.isDefault === false && model.isDefault) {
      throw new ConflictException('Make another model the default instead of unsetting this one');
    }
    if (willBeDefault && !willBeEnabled) {
      throw new ConflictException('The default model cannot be disabled. Choose another default first.');
    }

    return this.dataSource.transaction(async (manager) => {
      if (dto.isDefault === true && !model.isDefault) {
        await this.unsetDefaultModel(manager, providerId);
      }
      if (dto.displayName !== undefined) model.displayName = dto.displayName.trim();
      if (dto.premiumOnly !== undefined) model.premiumOnly = dto.premiumOnly;
      if (dto.maxTokens !== undefined) model.maxTokens = dto.maxTokens;
      model.isEnabled = willBeEnabled;
      model.isDefault = willBeDefault;
      return manager.save(model);
    });
  }

  async removeModel(providerId: string, modelId: string): Promise<void> {
    const model = await this.findModelOrFail(providerId, modelId);
    if (model.isDefault) {
      throw new ConflictException('The default model cannot be deleted. Choose another default first.');
    }
    await this.modelsRepo.delete(modelId);
  }

  // ─────────────────────────── For users and the chat service ───────────────────────────

  /** Enabled providers with their enabled models, for the extension's dropdowns */
  findAllPublic(): Promise<AiProvider[]> {
    return this.providersRepo.find({
      where: { isEnabled: true },
      relations: { models: true },
      order: { createdAt: 'ASC', models: { createdAt: 'ASC' } },
    });
  }

  /**
   * Decides which provider + model answers a chat, applying all the rules:
   * enabled only, default fallback, premium-only models.
   */
  async resolveChatTarget(options: {
    providerId?: string;
    modelId?: string;
    isPremium: boolean;
  }): Promise<ChatTarget> {
    let provider: AiProvider | null;

    if (options.providerId) {
      provider = await this.providersRepo.findOne({
        where: { id: options.providerId, isEnabled: true },
        relations: { models: true },
      });
      if (!provider) throw new NotFoundException('Provider not found or disabled');
    } else if (options.modelId) {
      const owner = await this.modelsRepo.findOneBy({ id: options.modelId });
      provider = owner
        ? await this.providersRepo.findOne({
            where: { id: owner.providerId, isEnabled: true },
            relations: { models: true },
          })
        : null;
      if (!provider) throw new NotFoundException('Model not found or its provider is disabled');
    } else {
      provider = await this.providersRepo.findOne({
        where: { isDefault: true, isEnabled: true },
        relations: { models: true },
      });
      if (!provider) throw new ServiceUnavailableException('No AI provider is configured yet');
    }

    const enabledModels = provider.models.filter((m) => m.isEnabled);
    const model = options.modelId
      ? enabledModels.find((m) => m.id === options.modelId)
      : (enabledModels.find((m) => m.isDefault) ?? enabledModels[0]);

    if (!model) throw new NotFoundException('Model not found or disabled for this provider');
    if (model.premiumOnly && !options.isPremium) {
      throw new ForbiddenException(`${model.displayName} requires a Premium subscription`);
    }

    return {
      provider,
      model,
      apiKey: await this.getDecryptedKey(provider.id),
      adapter: this.adapterFactory.get(provider.type),
    };
  }

  // ─────────────────────────── Helpers ───────────────────────────

  /** apiKeyEncrypted is select:false, so it must be requested explicitly */
  private async getDecryptedKey(providerId: string): Promise<string> {
    const row = await this.providersRepo
      .createQueryBuilder('p')
      .addSelect('p.apiKeyEncrypted')
      .where('p.id = :providerId', { providerId })
      .getOne();
    if (!row) throw new NotFoundException('Provider not found');

    try {
      return decrypt(row.apiKeyEncrypted, this.encryptionKey);
    } catch {
      this.logger.error(`Could not decrypt API key of provider ${providerId}. Was ENCRYPTION_KEY changed?`);
      throw new InternalServerErrorException('Provider credentials are unreadable');
    }
  }

  private async assertNameAvailable(name: string): Promise<void> {
    if (await this.providersRepo.existsBy({ name: name.trim() })) {
      throw new ConflictException('A provider with this name already exists');
    }
  }

  private async findModelOrFail(providerId: string, modelId: string): Promise<AiModel> {
    const model = await this.modelsRepo.findOneBy({ id: modelId, providerId });
    if (!model) throw new NotFoundException('Model not found for this provider');
    return model;
  }

  private async unsetDefaultModel(manager: EntityManager, providerId: string): Promise<void> {
    await manager.update(AiModel, { providerId, isDefault: true }, { isDefault: false });
  }
}