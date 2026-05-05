import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { INestApplication } from '@nestjs/common';

import { AppModule } from 'src/app.module';
import { HttpExceptionFilter } from 'src/common/filters/http-exception.filter';
import { ResponseFormatterInterceptor } from 'src/common/interceptors/response-formatter.interceptor';
import { LoggingMiddleware } from 'src/common/middleware/logging.middleware';
import { TenantContextInterceptor } from 'src/common/middleware/tenant-context.middleware';

/**
 * Nest app configured like production [main.ts](../../src/main.ts) (no listen).
 */
export async function createE2eApp(): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
  });
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(
    new TenantContextInterceptor(),
    new ResponseFormatterInterceptor(),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const loggingMiddleware = new LoggingMiddleware();
  app.use(loggingMiddleware.use.bind(loggingMiddleware));

  app.getHttpAdapter().getInstance().set('trust proxy', true);

  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'api/v',
    defaultVersion: '1',
  });

  await app.init();
  return app;
}
