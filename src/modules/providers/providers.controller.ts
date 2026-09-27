import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicProviderDto } from './dto/provider-response.dto';
import { ProvidersService } from './providers.service';

@ApiTags('AI Providers')
@ApiBearerAuth('access-token')
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  @ApiOperation({ summary: 'Providers and models I can choose from in the extension' })
  @ApiOkResponse({ type: [PublicProviderDto] })
  async findAll(): Promise<PublicProviderDto[]> {
    return (await this.providersService.findAllPublic()).map((p) => PublicProviderDto.fromEntity(p));
  }
}