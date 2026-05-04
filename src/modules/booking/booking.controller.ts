import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UserRole } from '@generated/enums';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ApiResponse } from 'src/common/dto/api-response.dto';

import { BookingService } from './booking.service';
import { SlotService } from './slot.service';
import {
  CleanupExpiredHoldsQueryDto,
  CreateSlotHoldDto,
  ListBookingsQueryDto,
} from './dto';

@Controller({ path: 'bookings', version: '1' })
@UseGuards(ThrottlerGuard)
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly slotService: SlotService,
  ) {}

  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.PROVIDER,
    UserRole.CUSTOMER,
  )
  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListBookingsQueryDto,
  ) {
    const result = await this.bookingService.findManyPaginated(user, query);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: result,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('slot-holds/cleanup-expired')
  async cleanupExpiredHolds(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: CleanupExpiredHoldsQueryDto,
  ) {
    if (user.role === UserRole.SUPER_ADMIN) {
      if (!query.tenantId) {
        throw new BadRequestException(
          'tenantId query parameter is required for SUPER_ADMIN',
        );
      }

      const data = await this.slotService.deleteExpiredHolds(query.tenantId);
      return new ApiResponse({
        code: HttpStatus.OK,
        message: 'Expired slot holds removed',
        data,
      });
    }

    if (!user.tenantId) {
      throw new BadRequestException('Tenant context is required');
    }

    const data = await this.slotService.deleteExpiredHolds(user.tenantId);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Expired slot holds removed',
      data,
    });
  }

  @Roles(UserRole.CUSTOMER)
  @Post('slot-holds')
  async createSlotHold(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateSlotHoldDto,
  ) {
    const result = await this.slotService.createHold(user, dto);

    return new ApiResponse({
      code: HttpStatus.CREATED,
      message: 'Slot hold created',
      data: result,
    });
  }

  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.PROVIDER,
    UserRole.CUSTOMER,
  )
  @Get(':id')
  async getOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.bookingService.findOneOrThrow(user, id);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: result,
    });
  }
}
