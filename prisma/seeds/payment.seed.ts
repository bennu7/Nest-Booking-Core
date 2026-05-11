import { PrismaClient, PaymentStatus } from '../../src/generated/client.js';

export interface SeedPaymentParams {
  prisma: PrismaClient;
  tenantId: string;
  bookingId: string;
  amount: number;
  status?: PaymentStatus;
  paymentMethod?: string;
  externalPaymentId?: string;
  paidAt?: Date | null;
  refundedAt?: Date | null;
}

export interface SeedPaymentResult {
  id: string;
  status: string;
}

export async function seedPayment({
  prisma,
  tenantId,
  bookingId,
  amount,
  status = PaymentStatus.PENDING,
  paymentMethod = 'credit_card',
  externalPaymentId,
  paidAt,
  refundedAt,
}: SeedPaymentParams): Promise<SeedPaymentResult> {
  const existing = await prisma.payment.findUnique({
    where: { bookingId },
  });
  if (existing) {
    console.log(
      `⏭️  Payment already exists for booking ${bookingId}, skipping...`,
    );
    return { id: existing.id, status: existing.status };
  }

  const payment = await prisma.payment.create({
    data: {
      tenantId,
      bookingId,
      amount,
      currency: 'IDR',
      status,
      paymentMethod,
      externalPaymentId,
      paidAt,
      refundedAt,
      metadata: {},
    },
  });

  console.log(`✅ Payment created: ${payment.id} (${status})`);
  return { id: payment.id, status: payment.status };
}

export async function seedPaymentSuccess({
  prisma,
  tenantId,
  bookingId,
  amount,
}: Omit<SeedPaymentParams, 'status' | 'paidAt'>) {
  return seedPayment({
    prisma,
    tenantId,
    bookingId,
    amount,
    status: PaymentStatus.SUCCESS,
    paymentMethod: 'credit_card',
    externalPaymentId: `midtrans-${bookingId}-${Date.now()}`,
    paidAt: new Date(),
  });
}

export async function seedPaymentFailed({
  prisma,
  tenantId,
  bookingId,
  amount,
}: Omit<SeedPaymentParams, 'status'>) {
  return seedPayment({
    prisma,
    tenantId,
    bookingId,
    amount,
    status: PaymentStatus.FAILED,
    paymentMethod: 'credit_card',
    externalPaymentId: `midtrans-${bookingId}-${Date.now()}`,
  });
}

export async function seedPaymentExpired({
  prisma,
  tenantId,
  bookingId,
  amount,
}: Omit<SeedPaymentParams, 'status'>) {
  return seedPayment({
    prisma,
    tenantId,
    bookingId,
    amount,
    status: PaymentStatus.EXPIRED,
    paymentMethod: 'bank_transfer',
  });
}

export async function seedPaymentRefunded({
  prisma,
  tenantId,
  bookingId,
  amount,
}: Omit<SeedPaymentParams, 'status' | 'refundedAt'>) {
  return seedPayment({
    prisma,
    tenantId,
    bookingId,
    amount,
    status: PaymentStatus.REFUNDED,
    paymentMethod: 'credit_card',
    externalPaymentId: `midtrans-${bookingId}-${Date.now()}`,
    paidAt: new Date(Date.now() - 86400000),
    refundedAt: new Date(),
  });
}
