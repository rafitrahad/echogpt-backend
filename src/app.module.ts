import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validate } from './config/env.validation';
import { dataSourceOptions } from './database/data-source';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // 1. Load .env and VALIDATE it. The app refuses to start if anything is wrong.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate,
    }),

    // 2. Database: reuse the exact same settings as the migration CLI
    TypeOrmModule.forRoot(dataSourceOptions),

    // 3. Rate limiting: max THROTTLE_LIMIT requests per THROTTLE_TTL_SECONDS per client
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.getOrThrow('THROTTLE_TTL_SECONDS')) * 1000,
          limit: Number(config.getOrThrow('THROTTLE_LIMIT')),
        },
      ],
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply rate limiting to EVERY route in the app
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}