/**
 * Midtrans-specific types.
 * Kept separate so the generic PaymentGateway interface stays gateway-agnostic.
 */

export interface MidtransNotificationResponse {
  order_id: string;
  transaction_status: string;
  status_code?: string;
  status_message?: string;
  fraud_status?: string;
  payment_type?: string;
  gross_amount?: string;
  currency?: string;
  signature_key?: string;
  [key: string]: unknown;
}
