import {
  Controller,
  Post,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { PaymentService } from '../payment.service';
import type { PaymentGateway } from '../gateways/payment-gateway.interface';
import { PAYMENT_GATEWAY } from '../gateways/payment-gateway.interface';
import {
  mapMidtransStatusToPaymentStatus,
  MidtransTransactionStatus,
} from '../utils/midtrans-status-mapper.util';
import { PaymentStatus } from '@generated/enums';

@Controller('webhooks/midtrans')
export class MidtransWebhookController {
  private readonly logger = new Logger(MidtransWebhookController.name);

  constructor(
    private readonly paymentService: PaymentService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  @Post()
  @Public()
  async handleWebhook(
    @Body() payload: any,
    @Headers('x-midtrans-signature-key') signatureKey: string,
  ) {
    try {
      if (!payload.order_id) {
        throw new HttpException('Missing order_id', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(
        `Received Midtrans webhook for order: ${payload.order_id}`,
      );

      // [C5] Signature verification BEFORE processing any business logic.
      // Formula: SHA512(order_id + status_code + gross_amount + SERVER_KEY)
      const isValidSignature = this.gateway.verifyWebhookSignature(
        JSON.stringify(payload),
        signatureKey,
      );
      if (!isValidSignature) {
        this.logger.warn(
          `Rejected webhook with invalid signature for order: ${payload.order_id}`,
        );
        throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
      }

      // [C1] Idempotency: skip if payment is already in a terminal state.
      const existingPayment = await this.paymentService.findByExternalId(
        payload.order_id,
      );
      if (existingPayment && existingPayment.status !== PaymentStatus.PENDING) {
        this.logger.log(
          `Webhook already processed for order: ${payload.order_id}, current status: ${existingPayment.status}`,
        );
        return {
          status: 'already_processed',
          orderId: payload.order_id,
          currentStatus: existingPayment.status,
        };
      }

      // Re-verify with payment gateway status API and extract normalised fields
      const notification = await this.gateway.handleWebhookNotification(
        payload as Record<string, unknown>,
      );

      const newStatus = mapMidtransStatusToPaymentStatus(
        notification.transactionStatus as MidtransTransactionStatus,
        notification.fraudStatus,
      );

      // Update payment status
      await this.paymentService.updatePaymentStatus(
        payload.order_id,
        newStatus,
        {
          paymentType: notification.paymentType,
          fraudStatus: notification.fraudStatus,
          rawResponse: payload,
        },
      );

      // Confirm booking only when payment reaches SUCCESS
      if (newStatus === PaymentStatus.SUCCESS) {
        await this.paymentService.confirmBookingAfterPayment(payload.order_id);
      }

      this.logger.log(
        `Webhook processed for order: ${payload.order_id}, newStatus: ${newStatus}`,
      );

      return {
        status: 'processed',
        orderId: payload.order_id,
        newStatus,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Webhook processing failed: ${error.message}`);
      throw new HttpException(
        'Webhook processing failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
