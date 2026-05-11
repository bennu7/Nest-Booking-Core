import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as midtransClient from 'midtrans-client';
import {
  CreatePaymentParams,
  PaymentGateway,
  PaymentGatewayResponse,
  WebhookNotification,
} from './payment-gateway.interface';
import { MidtransNotificationResponse } from '../types/midtrans.types';

@Injectable()
export class MidtransPaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(MidtransPaymentGateway.name);
  private readonly snap: any;
  private readonly core: any;
  private readonly serverKey: string;

  constructor(private readonly configService: ConfigService) {
    const serverKey = this.configService.get<string>('MIDTRANS_SERVER_KEY');
    if (!serverKey) {
      throw new Error(
        'MIDTRANS_SERVER_KEY is not set. Cannot initialize payment gateway.',
      );
    }
    this.serverKey = serverKey;

    const isProduction =
      this.configService.get('MIDTRANS_IS_PRODUCTION') === 'true';
    const clientKey =
      this.configService.get<string>('MIDTRANS_CLIENT_KEY') || '';

    this.snap = new midtransClient.Snap({
      isProduction,
      serverKey: this.serverKey,
      clientKey,
    });

    this.core = new midtransClient.CoreApi({
      isProduction,
      serverKey: this.serverKey,
      clientKey,
    });
  }

  async createPayment(
    params: CreatePaymentParams,
  ): Promise<PaymentGatewayResponse> {
    try {
      const parameter: any = {
        transaction_details: {
          order_id: params.orderId,
          gross_amount: params.amount,
        },
        customer_details: {
          email: params.customerEmail,
          first_name: params.customerName?.split(' ')[0] || '',
          last_name: params.customerName?.split(' ').slice(1).join(' ') || '',
          phone: params.customerPhone,
        },
        item_details: params.metadata?.items || [],
        expiry: params.expiry
          ? {
              unit: params.expiry.unit,
              duration: params.expiry.duration,
            }
          : undefined,
      };

      if (params.paymentMethods && params.paymentMethods.length > 0) {
        parameter.enabled_payments = params.paymentMethods;
      }

      const transaction = await this.snap.createTransaction(parameter);

      this.logger.log(
        `Midtrans transaction created: ${transaction.token} for order: ${params.orderId}`,
      );

      return {
        externalId: params.orderId, // In Midtrans Snap, we usually track by orderId
        redirectUrl: transaction.redirect_url,
        token: transaction.token,
      };
    } catch (error) {
      this.logger.error(`Midtrans createPayment error: ${error.message}`);
      throw new PaymentGatewayException(
        'Failed to create Midtrans transaction',
        error.httpStatusCode,
        error.ApiResponse,
      );
    }
  }

  async confirmPayment(orderId: string): Promise<boolean> {
    try {
      const statusResponse = await this.core.transaction.status(orderId);
      this.logger.log(
        `Midtrans status check for order ${orderId}: ${statusResponse.transaction_status}`,
      );
      return ['capture', 'settlement'].includes(
        statusResponse.transaction_status,
      );
    } catch (error) {
      this.logger.error(
        `Midtrans confirmPayment error for order ${orderId}: ${error.message}`,
      );
      return false;
    }
  }

  async refundPayment(
    orderId: string,
    amount?: number,
    reason?: string,
  ): Promise<boolean> {
    const parameter: any = {
      refund_key: `${orderId}-refund-${Date.now()}`,
      reason: reason || 'Customer requested refund',
    };

    if (amount) {
      parameter.amount = amount;
    }

    try {
      const response = await this.core.transaction.refund(orderId, parameter);
      this.logger.log(
        `Midtrans refund initiated for order ${orderId}: ${JSON.stringify(response)}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Midtrans refundPayment error for order ${orderId}: ${error.message}`,
      );
      // Throw so the caller knows the refund failed and can react accordingly
      // (e.g. alert finance team, mark for manual review).
      // Returning false would leave Payment.status as SUCCESS with no signal.
      throw new PaymentGatewayException(
        `Refund failed for order ${orderId}: ${error.message}`,
        error.httpStatusCode,
        error.ApiResponse,
      );
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    // Midtrans signature verification:
    // SHA512(order_id + status_code + gross_amount + SERVER_KEY)
    try {
      const notification = JSON.parse(payload) as MidtransNotificationResponse;
      const computed = crypto
        .createHash('sha512')
        .update(
          `${notification.order_id}${notification.status_code}${notification.gross_amount}${this.serverKey}`,
        )
        .digest('hex');

      const isValid = computed === signature;
      if (!isValid) {
        this.logger.warn(
          `Invalid webhook signature for order: ${notification.order_id}`,
        );
      }
      return isValid;
    } catch (error) {
      this.logger.error(
        `Webhook signature verification error: ${error.message}`,
      );
      return false;
    }
  }

  async handleWebhookNotification(
    notificationJson: Record<string, unknown>,
  ): Promise<WebhookNotification> {
    try {
      // Midtrans CoreApi re-verifies the transaction status server-side
      const response = (await this.core.transaction.notification(
        notificationJson,
      )) as MidtransNotificationResponse;

      return {
        orderId: response.order_id,
        transactionStatus: response.transaction_status,
        fraudStatus: response.fraud_status,
        paymentType: response.payment_type,
      };
    } catch (error) {
      this.logger.error(
        `Webhook notification handling error: ${error.message}`,
      );
      throw error;
    }
  }
}

export class PaymentGatewayException extends Error {
  constructor(
    message: string,
    public readonly httpStatusCode?: number,
    public readonly apiResponse?: any,
  ) {
    super(message);
    this.name = 'PaymentGatewayException';
  }
}
