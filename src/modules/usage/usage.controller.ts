import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsageSummaryDto } from './dto/usage-summary.dto';
import { UsageService } from './usage.service';

@ApiTags('Usage')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@Controller('usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get('me')
  @ApiOperation({ summary: 'My usage today and remaining requests' })
  @ApiOkResponse({ type: UsageSummaryDto })
  getMyUsage(@CurrentUser('id') userId: string): Promise<UsageSummaryDto> {
    return this.usageService.getSummary(userId);
  }
}