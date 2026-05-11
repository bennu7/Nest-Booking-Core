import { Controller, Post, Get, Param, UseGuards, Query } from '@nestjs/common';
import { PaymentService } from './payment.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../generated/enums';

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
