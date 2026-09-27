import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { validate } from './config/env.validation';
import { dataSourceOptions } from './database/data-source';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { HealthModule } from './modules/health/health.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { SearchModule } from './modules/search/search.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { ApiUsageLog } from './modules/usage/entities/api-usage-log.entity';
import { UsageModule } from './modules/usage/usage.module';
import { UsersModule } from './modules/users/users.module';

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
    // Repository for the request-logging middleware
    TypeOrmModule.forFeature([ApiUsageLog]),
    AuthModule,
    UsersModule,
    SubscriptionsModule,
    UsageModule,
    ProvidersModule,
    ChatModule,
    SearchModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    // Order matters: rate limit -> who are you? -> are you allowed?
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Log every request (including ones rejected by guards)
    consumer.apply(RequestLoggingMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}