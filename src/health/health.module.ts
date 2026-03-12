import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from 'src/prisma';
import { HealthService } from './health.service';

@Module({
  imports: [PrismaModule],
  providers: [HealthService],
  controllers: [HealthController],
})
export class HealthModule {}
