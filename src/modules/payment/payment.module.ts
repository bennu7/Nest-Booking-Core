import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { MidtransWebhookController } from './webhooks/payment-webhook.controller';
import { PAYMENT_GATEWAY } from './gateways/payment-gateway.interface';
import { MockPaymentGateway } from './gateways/mock-payment.gateway';
// import { MidtransPaymentGateway } from './gateways/midtrans-payment.gateway';

@Module({
  controllers: [PaymentController, MidtransWebhookController],
  providers: [
    PaymentService,
    {
      provide: PAYMENT_GATEWAY,
      useClass: MockPaymentGateway, // Toggle between Mock and Midtrans
    },
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
