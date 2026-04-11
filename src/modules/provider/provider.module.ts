import { Module } from '@nestjs/common';
import { ProviderController } from './provider.controller';
import { ProviderService } from './provider.service';
import { ScheduleService } from './schedule.service';

@Module({
  controllers: [ProviderController],
  providers: [ProviderService, ScheduleService],
  exports: [ProviderService, ScheduleService],
})
export class ProviderModule {}
