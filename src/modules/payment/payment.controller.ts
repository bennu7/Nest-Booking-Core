import { Controller, Post, Get, Param, UseGuards, Query } from '@nestjs/common';
import { PaymentService } from './payment.service.js';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../generated/enums.js';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('booking/:bookingId')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async createPayment(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.paymentService.createPayment(bookingId, user);
  }

  @Post(':id/retry')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async retryPayment(
    @Param('id') paymentId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.paymentService.retryPayment(paymentId, user);
  }

  @Get('external/:externalId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.PROVIDER)
  async getByExternalId(@Param('externalId') externalId: string) {
    return this.paymentService.findByExternalId(externalId);
  }
}
