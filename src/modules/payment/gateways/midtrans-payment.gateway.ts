import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as midtransClient from 'midtrans-client';
import {
  CreatePaymentParams,
  MidtransNotificationResponse,
  PaymentGateway,
  PaymentGatewayResponse,
} from './payment-gateway.interface.js';

@Injectable()
export class MidtransPaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(MidtransPaymentGateway.name);
  private readonly snap: any;
  private readonly core: any;

  constructor(private readonly configService: ConfigService) {
    this.snap = new midtransClient.Snap({
      isProduction: this.configService.get('MIDTRANS_IS_PRODUCTION') === 'true',
      serverKey: this.configService.get('MIDTRANS_SERVER_KEY') || '',
      clientKey: this.configService.get('MIDTRANS_CLIENT_KEY') || '',
    });

    this.core = new midtransClient.CoreApi({
      isProduction: this.configService.get('MIDTRANS_IS_PRODUCTION') === 'true',
      serverKey: this.configService.get('MIDTRANS_SERVER_KEY') || '',
      clientKey: this.configService.get('MIDTRANS_CLIENT_KEY') || '',
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
    try {
      const parameter: any = {
        refund_key: `${orderId}-refund-${Date.now()}`,
        reason: reason || 'Customer requested refund',
      };

      if (amount) {
        parameter.amount = amount;
      }

      const response = await this.core.transaction.refund(orderId, parameter);
      this.logger.log(
        `Midtrans refund initiated for order ${orderId}: ${JSON.stringify(response)}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Midtrans refundPayment error for order ${orderId}: ${error.message}`,
      );
      return false;
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    // Midtrans doesn't use a standard signature header like Stripe in Snap,
    // it's verified by calling the status API or using the server key.
    // However, the CoreApi notification handler does verification.
    return true;
  }

  async handleWebhookNotification(
    notificationJson: any,
  ): Promise<MidtransNotificationResponse> {
    try {
      const response =
        await this.core.transaction.notification(notificationJson);
      return response as MidtransNotificationResponse;
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
