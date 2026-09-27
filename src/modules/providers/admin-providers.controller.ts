import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleName } from '../../common/enums';
import { CreateModelDto } from './dto/create-model.dto';
import { CreateProviderDto } from './dto/create-provider.dto';
import {
  AiModelResponseDto,
  AiProviderResponseDto,
  HealthCheckResultDto,
} from './dto/provider-response.dto';
import { SetEnabledDto } from './dto/set-enabled.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { ProvidersService } from './providers.service';

@ApiTags('Admin - AI Providers')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiForbiddenResponse({ description: 'Admins only' })
@Roles(RoleName.ADMIN)
@Controller('admin/providers')
export class AdminProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  @ApiOperation({ summary: 'List all providers with their models' })
  @ApiOkResponse({ type: [AiProviderResponseDto] })
  async findAll(): Promise<AiProviderResponseDto[]> {
    return (await this.providersService.findAll()).map((p) => AiProviderResponseDto.fromEntity(p));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one provider' })
  @ApiOkResponse({ type: AiProviderResponseDto })
  @ApiNotFoundResponse({ description: 'Provider not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AiProviderResponseDto> {
    return AiProviderResponseDto.fromEntity(await this.providersService.findOne(id));
  }

  @Post()
  @ApiOperation({ summary: 'Add a provider (API key is encrypted before saving)' })
  @ApiCreatedResponse({ type: AiProviderResponseDto })
  @ApiConflictResponse({ description: 'Name already used' })
  async create(@Body() dto: CreateProviderDto): Promise<AiProviderResponseDto> {
    return AiProviderResponseDto.fromEntity(await this.providersService.create(dto));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a provider (name, base URL, rotate API key)' })
  @ApiOkResponse({ type: AiProviderResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProviderDto,
  ): Promise<AiProviderResponseDto> {
    return AiProviderResponseDto.fromEntity(await this.providersService.update(id, dto));
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Enable or disable a provider' })
  @ApiOkResponse({ type: AiProviderResponseDto })
  @ApiConflictResponse({ description: 'Cannot disable the default provider' })
  async setEnabled(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetEnabledDto,
  ): Promise<AiProviderResponseDto> {
    return AiProviderResponseDto.fromEntity(await this.providersService.setEnabled(id, dto.isEnabled));
  }

  @Post(':id/default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Make this the default provider' })
  @ApiOkResponse({ type: AiProviderResponseDto })
  @ApiConflictResponse({ description: 'Provider is disabled or has no enabled models' })
  async setDefault(@Param('id', ParseUUIDPipe) id: string): Promise<AiProviderResponseDto> {
    return AiProviderResponseDto.fromEntity(await this.providersService.setDefault(id));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a provider (chat history is kept)' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiConflictResponse({ description: 'Cannot delete the default provider' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.providersService.remove(id);
  }

  @Post(':id/health-check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a tiny test prompt and record the result' })
  @ApiOkResponse({ type: HealthCheckResultDto })
  healthCheck(@Param('id', ParseUUIDPipe) id: string): Promise<HealthCheckResultDto> {
    return this.providersService.healthCheck(id);
  }

  @Post(':id/models')
  @ApiOperation({ summary: 'Add a model to a provider' })
  @ApiCreatedResponse({ type: AiModelResponseDto })
  @ApiConflictResponse({ description: 'Model already exists for this provider' })
  async addModel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateModelDto,
  ): Promise<AiModelResponseDto> {
    return AiModelResponseDto.fromEntity(await this.providersService.addModel(id, dto));
  }

  @Patch(':id/models/:modelId')
  @ApiOperation({ summary: 'Edit a model (name, enable/disable, default, premium-only, max tokens)' })
  @ApiOkResponse({ type: AiModelResponseDto })
  async updateModel(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Body() dto: UpdateModelDto,
  ): Promise<AiModelResponseDto> {
    return AiModelResponseDto.fromEntity(await this.providersService.updateModel(id, modelId, dto));
  }

  @Delete(':id/models/:modelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a model' })
  @ApiNoContentResponse({ description: 'Deleted' })
  async removeModel(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('modelId', ParseUUIDPipe) modelId: string,
  ): Promise<void> {
    await this.providersService.removeModel(id, modelId);
  }
}