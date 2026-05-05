import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

const envFilePath = process.env.E2E_TEST === '1' ? '.env.test' : '.env';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        PORT: Joi.number().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().required(),
        JWT_SECRET_REFRESH: Joi.string().required(),
        JWT_SECRET_REFRESH_EXPIRES_IN: Joi.string().required(),
        NODE_ENV: Joi.string().required(),
      }),
    }),
  ],
})
export class AppConfigModule {}
