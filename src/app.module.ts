import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { UsageModule } from './modules/usage/usage.module';
import { UsersModule } from './modules/users/users.module';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { validate } from './config/env.validation';
import { dataSourceOptions } from './database/data-source';
import { AuthModule } from './modules/auth/auth.module';
import { ProvidersModule } from './modules/providers/providers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate }),
    TypeOrmModule.forRoot(dataSourceOptions),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.getOrThrow('THROTTLE_TTL_SECONDS')) * 1000,
          limit: Number(config.getOrThrow('THROTTLE_LIMIT')),
        },
      ],
    }),
    AuthModule,
    UsersModule,
    SubscriptionsModule,
    UsageModule,
    ProvidersModule,
  ],
  providers: [
    // Order matters: rate limit -> who are you? -> are you allowed?
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}