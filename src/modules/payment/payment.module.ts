import { Module, Global } from '@nestjs/common';
import { PaymentService } from './payment.service.js';
import { PaymentController } from './payment.controller.js';
import { MidtransWebhookController } from './webhooks/payment-webhook.controller.js';
import { PAYMENT_GATEWAY } from './gateways/payment-gateway.interface.js';
import { MockPaymentGateway } from './gateways/mock-payment.gateway.js';
import { MidtransPaymentGateway } from './gateways/midtrans-payment.gateway.js';

@Global()
@Module({
  controllers: [PaymentController, MidtransWebhookController],
  providers: [
    PaymentService,
    MidtransPaymentGateway,
    {
      provide: PAYMENT_GATEWAY,
      useClass: MockPaymentGateway, // Toggle between Mock and Midtrans
    },
  ],
  exports: [PaymentService, PAYMENT_GATEWAY],
})
export class PaymentModule {}
