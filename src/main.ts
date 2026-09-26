import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // 1. Every route starts with /api/v1 (versioning)
  app.setGlobalPrefix('api/v1');

  // 2. Security headers. CSP is off because this is a JSON API
  //    and Swagger UI needs inline scripts.
  app.use(helmet({ contentSecurityPolicy: false }));

  // 3. CORS: which origins (websites / extensions) may call the API
  const corsOrigin = config.getOrThrow<string>('CORS_ORIGIN');
  app.enableCors({
    origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map((o) => o.trim()),
  });

  // 4. Validate every request body/query against its DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not in the DTO
      forbidNonWhitelisted: true, // ...and reject the request if any were sent
      transform: true, // convert plain JSON into DTO class instances
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 5. One consistent, safe error format for the whole API
  app.useGlobalFilters(new AllExceptionsFilter());

  // 6. Swagger (OpenAPI) documentation at /docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('EchoGPT API')
    .setDescription(
      'Backend REST API for the EchoGPT Chrome extension: auth, subscriptions, ' +
        'multi-provider AI chat, AI-assisted web search and admin analytics.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // 7. Close DB connections cleanly when the app stops
  app.enableShutdownHooks();

  const port = Number(config.getOrThrow('PORT'));
  await app.listen(port);
  logger.log(`API running at http://localhost:${port}/api/v1`);
  logger.log(`Swagger docs at http://localhost:${port}/docs`);
}

void bootstrap();