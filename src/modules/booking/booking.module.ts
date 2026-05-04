import { Module } from '@nestjs/common';

import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { SlotService } from './slot.service';

@Module({
  controllers: [BookingController],
  providers: [BookingService, SlotService],
  exports: [BookingService, SlotService],
})
export class BookingModule {}
