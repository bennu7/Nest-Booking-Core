/// <reference types="webpack-env" />

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { VersioningType } from '@nestjs/common';

import { AppModule } from './app.module';
import appConfig from './config/app.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TenantContextInterceptor } from './common/middleware/tenant-context.middleware';
import { ResponseFormatterInterceptor } from './common/interceptors/response-formatter.interceptor';
import { LoggingMiddleware } from './common/middleware/logging.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();
  const { port, nodeName } = appConfig();

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

  // Global logging middleware
  const loggingMiddleware = new LoggingMiddleware();
  app.use(loggingMiddleware.use.bind(loggingMiddleware));

  // set headers user-agent
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'api/v',
    defaultVersion: '1',
  });

  // Do not retry `app.listen()` on failure: each attempt adds listeners on the same
  // http.Server (MaxListenersExceededWarning) and EADDRINUSE here usually means another
  // process still owns the port — backoff does not fix that.
  await app.listen(port);
  console.log(`\t🚀 App ${nodeName} Running on port ${port} `);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => void app.close());
  }
}

bootstrap().catch((err) => {
  console.error(`\t ‼️ FAILED RUNNING ON BOOTSTRAP`);
  console.error(err);
  process.exit(1);
});
