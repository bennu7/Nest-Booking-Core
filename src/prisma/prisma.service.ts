import {
  Injectable,
  OnModuleInit,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client.js';

interface PrismaQueryClient {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');
    const adapter = new PrismaPg({ connectionString });
    const isDev = configService.get<string>('NODE_ENV') === 'DEV';

    super({
      adapter,
      log: isDev
        ? [
            {
              emit: 'event',
              level: 'query',
            },
            {
              emit: 'stdout',
              level: 'info',
            },
            {
              emit: 'stdout',
              level: 'warn',
            },
            {
              emit: 'stdout',
              level: 'error',
            },
          ]
        : [
            {
              emit: 'stdout',
              level: 'error',
            },
          ],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();

      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.$on('query', (e: PrismaQueryClient) => {
          this.logger.debug(`Query: ${e.query}`);
          this.logger.debug(`Params: ${JSON.stringify(e.params)}`);
          this.logger.debug(`Duration: ${e.duration}ms`);
        });
      }

      // await this.$queryRaw`SELECT 1`;
      console.log(`\t ✅ Database connected and verified`);
    } catch (err) {
      console.error(`\t ❌ Databasen connection FAILED!!`);
      console.error(err);
      throw err;
    }
  }

  /**
   * Runs after the HTTP server is closed (see Nest shutdown sequence). Disconnecting
   * here avoids blocking `httpAdapter.close()` behind slow `$disconnect` during watch restarts.
   * @see https://docs.nestjs.com/fundamentals/lifecycle-events (Application shutdown)
   */
  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
