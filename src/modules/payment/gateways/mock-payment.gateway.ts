import { Injectable } from '@nestjs/common';
import {
  CreatePaymentParams,
  PaymentGateway,
  PaymentGatewayResponse,
} from './payment-gateway.interface.js';

@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  async createPayment(
    params: CreatePaymentParams,
  ): Promise<PaymentGatewayResponse> {
    return Promise.resolve({
      externalId: `mock-${params.orderId}-${Date.now()}`,
      redirectUrl: `https://mock-payment.test/pay/${params.orderId}`,
    });
  }

  async confirmPayment(_orderId: string): Promise<boolean> {
    return Promise.resolve(true); // Selalu sukses di mock
  }

  async refundPayment(_orderId: string, _amount?: number): Promise<boolean> {
    return Promise.resolve(true);
  }

  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    return true; // Selalu valid di mock
  }
}
