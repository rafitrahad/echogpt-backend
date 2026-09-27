import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' }) status: 'ok';
  @ApiProperty({ example: 'up' }) database: 'up';
  @ApiProperty({ example: 3 }) databaseLatencyMs: number;
  @ApiProperty({ example: 5234 }) uptimeSeconds: number;
  @ApiProperty() timestamp: Date;
}

/** Public liveness check for load balancers, Docker and uptime monitors */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'Is the API up and can it reach the database? (public)' })
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiServiceUnavailableResponse({ description: 'Database unreachable' })
  async check(): Promise<HealthResponseDto> {
    const started = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Database is unreachable');
    }
    return {
      status: 'ok',
      database: 'up',
      databaseLatencyMs: Date.now() - started,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date(),
    };
  }
}