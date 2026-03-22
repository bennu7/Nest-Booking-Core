import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import appConfig from './config/app.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseFormatterInterceptor } from './common/interceptors/response-formatter.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const { port, nodeName } = appConfig();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ResponseFormatterInterceptor());

  app.useGlobalFilters(new HttpExceptionFilter());

  // set headers user-agent
  app.getHttpAdapter().getInstance().set('user-agent', true);

  await app.listen(port).then(() => {
    console.log(`\t🚀 App ${nodeName} Running on port ${port} `);
  });
}

bootstrap().catch((err) => {
  console.error(`\t ‼️ FAILED RUNNING ON BOOTSTRAP`);
  console.error(err);
  process.exit(1);
});
