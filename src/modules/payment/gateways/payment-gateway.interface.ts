export enum PaymentProvider {
  MIDTRANS = 'midtrans',
  STRIPE = 'stripe',
}

export interface CreatePaymentParams {
  orderId: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethods?: string[];
  expiry?: { unit: 'minutes' | 'hours'; duration: number };
  metadata?: Record<string, unknown>;
}

export interface PaymentGatewayResponse {
  externalId: string;
  redirectUrl?: string;
  token?: string;
}

export interface WebhookNotification {
  orderId: string;
  transactionStatus: string;
  fraudStatus?: string;
  paymentType?: string;
}

export interface PaymentGateway {
  createPayment(params: CreatePaymentParams): Promise<PaymentGatewayResponse>;
  confirmPayment(orderId: string): Promise<boolean>;
  refundPayment(
    orderId: string,
    amount?: number,
    reason?: string,
  ): Promise<boolean>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
  handleWebhookNotification(
    notificationJson: Record<string, unknown>,
  ): Promise<WebhookNotification>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
