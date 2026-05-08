import { PaymentStatus } from '../../../generated/enums.js';

export enum MidtransTransactionStatus {
  CAPTURE = 'capture',
  SETTLEMENT = 'settlement',
  PENDING = 'pending',
  DENY = 'deny',
  EXPIRE = 'expire',
  CANCEL = 'cancel',
  REFUND = 'refund',
  PARTIAL_REFUND = 'partial_refund',
  AUTHORIZATION = 'authorization',
}

export function mapMidtransStatusToPaymentStatus(
  midtransStatus: MidtransTransactionStatus,
  fraudStatus?: string,
): PaymentStatus {
  switch (midtransStatus) {
    case MidtransTransactionStatus.CAPTURE:
      if (fraudStatus === 'challenge') {
        return PaymentStatus.PENDING;
      }
      return PaymentStatus.SUCCESS;

    case MidtransTransactionStatus.SETTLEMENT:
      return PaymentStatus.SUCCESS;

    case MidtransTransactionStatus.DENY:
      return PaymentStatus.FAILED;

    case MidtransTransactionStatus.CANCEL:
    case MidtransTransactionStatus.EXPIRE:
      return PaymentStatus.EXPIRED;

    case MidtransTransactionStatus.REFUND:
    case MidtransTransactionStatus.PARTIAL_REFUND:
      return PaymentStatus.REFUNDED;

    case MidtransTransactionStatus.PENDING:
    case MidtransTransactionStatus.AUTHORIZATION:
    default:
      return PaymentStatus.PENDING;
  }
}

export function shouldAllowRetry(midtransStatus: string): boolean {
  return [
    MidtransTransactionStatus.DENY,
    MidtransTransactionStatus.EXPIRE,
    MidtransTransactionStatus.CANCEL,
  ].includes(midtransStatus as MidtransTransactionStatus);
}
