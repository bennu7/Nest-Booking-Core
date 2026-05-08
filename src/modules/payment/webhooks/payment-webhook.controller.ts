import {
  Controller,
  Post,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Public } from '../../../common/decorators/public.decorator.js';
import { PaymentService } from '../payment.service.js';
import { MidtransPaymentGateway } from '../gateways/midtrans-payment.gateway.js';
import {
  mapMidtransStatusToPaymentStatus,
  MidtransTransactionStatus,
} from '../utils/midtrans-status-mapper.util.js';

@Controller('webhooks/midtrans')
export class MidtransWebhookController {
  private readonly logger = new Logger(MidtransWebhookController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly midtransGateway: MidtransPaymentGateway,
  ) {}

  @Post()
  @Public()
  async handleWebhook(@Body() payload: any) {
    try {
      this.logger.log(
        `Received Midtrans webhook for order: ${payload.order_id}`,
      );

      if (!payload.order_id) {
        throw new HttpException('Missing order_id', HttpStatus.BAD_REQUEST);
      }

      // Process webhook using Midtrans client's built-in verification
      const notification =
        await this.midtransGateway.handleWebhookNotification(payload);

      const newStatus = mapMidtransStatusToPaymentStatus(
        notification.transaction_status as MidtransTransactionStatus,
        notification.fraud_status,
      );

      // Update payment status
      await this.paymentService.updatePaymentStatus(
        payload.order_id,
        newStatus,
        {
          paymentType: notification.payment_type,
          fraudStatus: notification.fraud_status,
          rawResponse: payload,
        },
      );

      // Update booking status if payment is successful
      if (newStatus === 'SUCCESS') {
        await this.paymentService.confirmBookingAfterPayment(payload.order_id);
      }

      return {
        status: 'processed',
        orderId: payload.order_id,
        newStatus,
      };
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error.message}`);
      throw new HttpException(
        'Webhook processing failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
