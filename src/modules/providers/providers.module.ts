import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAdapterFactory } from './adapters/ai-adapter.factory';
import { AdminProvidersController } from './admin-providers.controller';
import { AiModel } from './entities/ai-model.entity';
import { AiProvider } from './entities/ai-provider.entity';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiProvider, AiModel])],
  controllers: [AdminProvidersController, ProvidersController],
  providers: [ProvidersService, AiAdapterFactory],
  exports: [ProvidersService],
})
export class ProvidersModule {}