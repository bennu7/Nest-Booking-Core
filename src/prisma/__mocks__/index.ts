import { Global, Injectable, Module } from '@nestjs/common';

/**
 * Manual mock for `jest.mock('src/prisma')` — avoids loading the generated
 * Prisma client in Jest (NodeNext `.js` specifiers + runtime assets).
 */
@Injectable()
export class PrismaService {}

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
