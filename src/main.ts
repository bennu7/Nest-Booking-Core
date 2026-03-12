import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import appConfig from './config/app.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseFormatterInterceptor } from './common/interceptors/response-formatter.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { port, nodeName } = appConfig();

  app.useGlobalInterceptors(new ResponseFormatterInterceptor());

  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(port).then(() => {
    console.log(`\t🚀 App ${nodeName} Running on port ${port} `);
  });
}

bootstrap();
