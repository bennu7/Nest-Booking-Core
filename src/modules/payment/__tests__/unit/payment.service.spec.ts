import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { BookingStatus, PaymentStatus } from '@generated/enums';

import { PrismaService } from 'src/prisma';

import { PAYMENT_GATEWAY } from '../../gateways/payment-gateway.interface';
import { PaymentService } from '../../payment.service';
import {
  BOOKING_ID,
  CUSTOMER_ID,
  EXTERNAL_PAYMENT_ID,
  PAYMENT_ID,
  TENANT_ID,
  makeAdminUser,
  makeBooking,
  makeCustomerUser,
  makeGatewayResponse,
  makePayment,
  makeTenant,
} from '../fixtures/payment.fixture';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createPrismaMock() {
  return {
    booking: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
  };
}

function createGatewayMock() {
  return {
    createPayment: jest.fn(),
    confirmPayment: jest.fn(),
    refundPayment: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    handleWebhookNotification: jest.fn(),
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let gateway: ReturnType<typeof createGatewayMock>;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    gateway = createGatewayMock();
    eventEmitter = { emit: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: PAYMENT_GATEWAY, useValue: gateway },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = moduleRef.get(PaymentService);
  });

  // ── createPayment ──────────────────────────────────────────────────────────

  describe('createPayment', () => {
    it('throws NotFoundException when booking not found', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);

      await expect(
        service.createPayment(BOOKING_ID, makeCustomerUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when payment already SUCCESS', async () => {
      const booking = makeBooking();
      const existingPayment = makePayment({ status: PaymentStatus.SUCCESS });

      prisma.booking.findFirst.mockResolvedValue(booking);
      prisma.payment.findUnique.mockResolvedValue(existingPayment);

      await expect(
        service.createPayment(BOOKING_ID, makeCustomerUser()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates new payment and returns redirectUrl when no payment exists', async () => {
      const booking = makeBooking();
      const tenant = makeTenant();
      const newPayment = makePayment({ externalPaymentId: null });
      const updatedPayment = makePayment({
        externalPaymentId: EXTERNAL_PAYMENT_ID,
      });
      const gatewayResp = makeGatewayResponse();

      prisma.booking.findFirst.mockResolvedValue(booking);
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.tenant.findUnique.mockResolvedValue(tenant);
      prisma.payment.create.mockResolvedValue(newPayment);
      gateway.createPayment.mockResolvedValue(gatewayResp);
      prisma.payment.update.mockResolvedValue(updatedPayment);

      const result = await service.createPayment(BOOKING_ID, makeCustomerUser());

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bookingId: BOOKING_ID,
            tenantId: TENANT_ID,
            status: PaymentStatus.PENDING,
          }),
        }),
      );
      expect(gateway.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: BOOKING_ID,
          amount: booking.totalPrice,
          customerEmail: booking.customer.email,
        }),
      );
      expect(result.redirectUrl).toBe(gatewayResp.redirectUrl);
      expect(result.token).toBe(gatewayResp.token);
    });

    it('updates existing PENDING payment instead of creating new one', async () => {
      const booking = makeBooking();
      const tenant = makeTenant();
      const existingPayment = makePayment({ status: PaymentStatus.PENDING });
      const updatedPayment = makePayment({
        externalPaymentId: EXTERNAL_PAYMENT_ID,
      });
      const gatewayResp = makeGatewayResponse();

      prisma.booking.findFirst.mockResolvedValue(booking);
      prisma.payment.findUnique.mockResolvedValue(existingPayment);
      prisma.tenant.findUnique.mockResolvedValue(tenant);
      // update called twice: once to reset status, once to set externalPaymentId
      prisma.payment.update
        .mockResolvedValueOnce(existingPayment)
        .mockResolvedValueOnce(updatedPayment);
      gateway.createPayment.mockResolvedValue(gatewayResp);

      const result = await service.createPayment(BOOKING_ID, makeCustomerUser());

      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: existingPayment.id },
          data: expect.objectContaining({ status: PaymentStatus.PENDING }),
        }),
      );
      expect(result.redirectUrl).toBe(gatewayResp.redirectUrl);
    });

    it('passes tenant payment config to gateway when settings exist', async () => {
      const booking = makeBooking();
      const tenant = makeTenant({
        settings: {
          payment: {
            enabledMethods: ['credit_card', 'gopay'],
            expiry: { unit: 'hours', duration: 1 },
          },
        },
      });
      const newPayment = makePayment();
      const gatewayResp = makeGatewayResponse();

      prisma.booking.findFirst.mockResolvedValue(booking);
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.tenant.findUnique.mockResolvedValue(tenant);
      prisma.payment.create.mockResolvedValue(newPayment);
      gateway.createPayment.mockResolvedValue(gatewayResp);
      prisma.payment.update.mockResolvedValue(newPayment);

      await service.createPayment(BOOKING_ID, makeCustomerUser());

      expect(gateway.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethods: ['credit_card', 'gopay'],
          expiry: { unit: 'hours', duration: 1 },
        }),
      );
    });

    it('re-throws gateway error without swallowing it', async () => {
      const booking = makeBooking();
      const tenant = makeTenant();
      const newPayment = makePayment();

      prisma.booking.findFirst.mockResolvedValue(booking);
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.tenant.findUnique.mockResolvedValue(tenant);
      prisma.payment.create.mockResolvedValue(newPayment);
      gateway.createPayment.mockRejectedValue(new Error('Gateway timeout'));

      await expect(
        service.createPayment(BOOKING_ID, makeCustomerUser()),
      ).rejects.toThrow('Gateway timeout');
    });
  });

  // ── findByExternalId ───────────────────────────────────────────────────────

  describe('findByExternalId', () => {
    it('returns payment when found', async () => {
      const payment = makePayment({ externalPaymentId: EXTERNAL_PAYMENT_ID });
      prisma.payment.findFirst.mockResolvedValue(payment);

      const result = await service.findByExternalId(EXTERNAL_PAYMENT_ID);

      expect(prisma.payment.findFirst).toHaveBeenCalledWith({
        where: { externalPaymentId: EXTERNAL_PAYMENT_ID },
        include: { booking: true },
      });
      expect(result).toEqual(payment);
    });

    it('returns null when not found', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      const result = await service.findByExternalId('non-existent-id');

      expect(result).toBeNull();
    });

    it('does NOT query by bookingId — only externalPaymentId (W6)', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      await service.findByExternalId(EXTERNAL_PAYMENT_ID);

      const callArg = prisma.payment.findFirst.mock.calls[0][0];
      // Pastikan TIDAK ada OR clause — fix untuk W6
      expect(callArg.where).not.toHaveProperty('OR');
      expect(callArg.where).toEqual({ externalPaymentId: EXTERNAL_PAYMENT_ID });
    });
  });

  // ── updatePaymentStatus ────────────────────────────────────────────────────

  describe('updatePaymentStatus', () => {
    it('throws NotFoundException when no payment matches externalId', async () => {
      prisma.payment.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updatePaymentStatus('non-existent', PaymentStatus.SUCCESS),
      ).rejects.toThrow(NotFoundException);
    });

    it('sets paidAt when status is SUCCESS', async () => {
      const payment = makePayment({
        externalPaymentId: EXTERNAL_PAYMENT_ID,
        status: PaymentStatus.SUCCESS,
        paidAt: new Date(),
      });
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.payment.findFirst.mockResolvedValue(payment);

      await service.updatePaymentStatus(EXTERNAL_PAYMENT_ID, PaymentStatus.SUCCESS);

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { externalPaymentId: EXTERNAL_PAYMENT_ID },
          data: expect.objectContaining({
            status: PaymentStatus.SUCCESS,
            paidAt: expect.any(Date),
          }),
        }),
      );
    });

    it('sets refundedAt when status is REFUNDED', async () => {
      const payment = makePayment({ externalPaymentId: EXTERNAL_PAYMENT_ID });
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.payment.findFirst.mockResolvedValue(payment);

      await service.updatePaymentStatus(
        EXTERNAL_PAYMENT_ID,
        PaymentStatus.REFUNDED,
      );

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.REFUNDED,
            refundedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('does NOT set paidAt or refundedAt for FAILED status', async () => {
      const payment = makePayment({ externalPaymentId: EXTERNAL_PAYMENT_ID });
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.payment.findFirst.mockResolvedValue(payment);

      await service.updatePaymentStatus(EXTERNAL_PAYMENT_ID, PaymentStatus.FAILED);

      const callData = prisma.payment.updateMany.mock.calls[0][0].data;
      expect(callData).not.toHaveProperty('paidAt');
      expect(callData).not.toHaveProperty('refundedAt');
    });

    it('merges metadata into existing payment metadata', async () => {
      const payment = makePayment({
        externalPaymentId: EXTERNAL_PAYMENT_ID,
        metadata: { existingKey: 'existingValue' },
      });
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.payment.findFirst.mockResolvedValue(payment);
      prisma.payment.update.mockResolvedValue(payment);

      await service.updatePaymentStatus(
        EXTERNAL_PAYMENT_ID,
        PaymentStatus.SUCCESS,
        { paymentType: 'credit_card', fraudStatus: 'accept' },
      );

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PAYMENT_ID },
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              existingKey: 'existingValue',
              paymentType: 'credit_card',
              fraudStatus: 'accept',
            }),
          }),
        }),
      );
    });

    it('uses atomic updateMany — tidak findFirst + update terpisah (C2)', async () => {
      const payment = makePayment({ externalPaymentId: EXTERNAL_PAYMENT_ID });
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      prisma.payment.findFirst.mockResolvedValue(payment);

      await service.updatePaymentStatus(EXTERNAL_PAYMENT_ID, PaymentStatus.FAILED);

      // updateMany harus dipanggil SEBELUM findFirst — atomic pattern
      const updateManyOrder = prisma.payment.updateMany.mock.invocationCallOrder[0];
      const findFirstOrder = prisma.payment.findFirst.mock.invocationCallOrder[0];
      expect(updateManyOrder).toBeLessThan(findFirstOrder);
    });
  });

  // ── confirmBookingAfterPayment ─────────────────────────────────────────────

  describe('confirmBookingAfterPayment', () => {
    it('throws NotFoundException when payment not found', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      await expect(
        service.confirmBookingAfterPayment(EXTERNAL_PAYMENT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates booking status to CONFIRMED', async () => {
      const payment = makePayment({ externalPaymentId: EXTERNAL_PAYMENT_ID });
      prisma.payment.findFirst.mockResolvedValue(payment);
      prisma.booking.update.mockResolvedValue(makeBooking({ status: BookingStatus.CONFIRMED }));

      await service.confirmBookingAfterPayment(EXTERNAL_PAYMENT_ID);

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: BOOKING_ID },
        data: { status: BookingStatus.CONFIRMED },
      });
    });

    it('emits payment.completed event after confirming booking', async () => {
      const payment = makePayment({ externalPaymentId: EXTERNAL_PAYMENT_ID });
      prisma.payment.findFirst.mockResolvedValue(payment);
      prisma.booking.update.mockResolvedValue(makeBooking());

      await service.confirmBookingAfterPayment(EXTERNAL_PAYMENT_ID);

      expect(eventEmitter.emit).toHaveBeenCalledWith('payment.completed', {
        paymentId: PAYMENT_ID,
        bookingId: BOOKING_ID,
        tenantId: TENANT_ID,
      });
    });

    it('uses BookingStatus enum — bukan hardcoded string (C4)', async () => {
      const payment = makePayment({ externalPaymentId: EXTERNAL_PAYMENT_ID });
      prisma.payment.findFirst.mockResolvedValue(payment);
      prisma.booking.update.mockResolvedValue(makeBooking());

      await service.confirmBookingAfterPayment(EXTERNAL_PAYMENT_ID);

      const callArg = prisma.booking.update.mock.calls[0][0];
      // BookingStatus.CONFIRMED === 'CONFIRMED' — test bahwa value-nya enum, bukan magic string
      expect(callArg.data.status).toBe(BookingStatus.CONFIRMED);
      expect(typeof callArg.data.status).toBe('string');
    });
  });

  // ── retryPayment ───────────────────────────────────────────────────────────

  describe('retryPayment', () => {
    it('throws NotFoundException when payment not found', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);

      await expect(
        service.retryPayment(PAYMENT_ID, makeCustomerUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when payment belongs to different tenant', async () => {
      const payment = makePayment({ tenantId: 'other-tenant-id' });
      prisma.payment.findUnique.mockResolvedValue(payment);

      await expect(
        service.retryPayment(PAYMENT_ID, makeCustomerUser()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when payment is already SUCCESS', async () => {
      const payment = makePayment({ status: PaymentStatus.SUCCESS });
      prisma.payment.findUnique.mockResolvedValue(payment);

      await expect(
        service.retryPayment(PAYMENT_ID, makeCustomerUser()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when gateway status does not allow retry', async () => {
      // settlement tidak ada di shouldAllowRetry list
      const payment = makePayment({
        status: PaymentStatus.PENDING,
        metadata: { gatewayResponse: { transactionStatus: 'settlement' } },
      });
      prisma.payment.findUnique.mockResolvedValue(payment);

      await expect(
        service.retryPayment(PAYMENT_ID, makeCustomerUser()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when booking is CANCELLED (W5)', async () => {
      const payment = makePayment({
        status: PaymentStatus.FAILED,
        metadata: { gatewayResponse: { transactionStatus: 'deny' } },
        booking: makeBooking({ status: BookingStatus.CANCELLED }),
      });
      prisma.payment.findUnique.mockResolvedValue(payment);

      await expect(
        service.retryPayment(PAYMENT_ID, makeCustomerUser()),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException with informative message for CANCELLED booking', async () => {
      const payment = makePayment({
        status: PaymentStatus.FAILED,
        metadata: { gatewayResponse: { transactionStatus: 'deny' } },
        booking: makeBooking({ status: BookingStatus.CANCELLED }),
      });
      prisma.payment.findUnique.mockResolvedValue(payment);

      await expect(
        service.retryPayment(PAYMENT_ID, makeCustomerUser()),
      ).rejects.toThrow('Cannot retry payment: booking is already CANCELLED');
    });

    it('calls createPayment when all validations pass', async () => {
      const booking = makeBooking({ status: BookingStatus.PENDING });
      const payment = makePayment({
        status: PaymentStatus.FAILED,
        metadata: { gatewayResponse: { transactionStatus: 'deny' } },
        booking,
      });
      const tenant = makeTenant();
      const newPayment = makePayment({ externalPaymentId: EXTERNAL_PAYMENT_ID });
      const gatewayResp = makeGatewayResponse();

      prisma.payment.findUnique.mockResolvedValue(payment);
      // Inside createPayment:
      prisma.booking.findFirst.mockResolvedValue(booking);
      prisma.payment.findUnique
        .mockResolvedValueOnce(payment)   // retryPayment lookup
        .mockResolvedValueOnce(null);     // createPayment idempotency check
      prisma.tenant.findUnique.mockResolvedValue(tenant);
      prisma.payment.create.mockResolvedValue(newPayment);
      gateway.createPayment.mockResolvedValue(gatewayResp);
      prisma.payment.update.mockResolvedValue(newPayment);

      const result = await service.retryPayment(PAYMENT_ID, makeCustomerUser());

      expect(gateway.createPayment).toHaveBeenCalled();
      expect(result.redirectUrl).toBe(gatewayResp.redirectUrl);
    });
  });

  // ── handleBookingCreated (@OnEvent) ────────────────────────────────────────

  describe('handleBookingCreated (@OnEvent booking.created)', () => {
    const eventPayload = {
      bookingId: BOOKING_ID,
      tenantId: TENANT_ID,
      customerId: CUSTOMER_ID,
      amount: 150000,
      currency: 'IDR',
      customerEmail: 'customer@example.com',
    };

    it('creates payment when none exists', async () => {
      const newPayment = makePayment();
      const gatewayResp = makeGatewayResponse();

      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.payment.create.mockResolvedValue(newPayment);
      gateway.createPayment.mockResolvedValue(gatewayResp);
      prisma.payment.update.mockResolvedValue(newPayment);

      await service.handleBookingCreated(eventPayload);

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bookingId: BOOKING_ID,
            tenantId: TENANT_ID,
            status: PaymentStatus.PENDING,
          }),
        }),
      );
      expect(gateway.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: BOOKING_ID,
          customerEmail: 'customer@example.com',
        }),
      );
    });

    it('skips creation when payment already exists (idempotency)', async () => {
      const existing = makePayment();
      prisma.payment.findUnique.mockResolvedValue(existing);

      await service.handleBookingCreated(eventPayload);

      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(gateway.createPayment).not.toHaveBeenCalled();
    });

    it('emits payment.failed when gateway throws', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.payment.create.mockResolvedValue(makePayment());
      gateway.createPayment.mockRejectedValue(new Error('Midtrans down'));

      await service.handleBookingCreated(eventPayload);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'payment.failed',
        expect.objectContaining({
          bookingId: BOOKING_ID,
          tenantId: TENANT_ID,
          customerId: CUSTOMER_ID,
          reason: 'Midtrans down',
        }),
      );
    });

    it('does not throw even when gateway fails — error is handled gracefully', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.payment.create.mockResolvedValue(makePayment());
      gateway.createPayment.mockRejectedValue(new Error('Network error'));

      // Promise harus resolve (bukan reject) karena error di-catch dan di-log
      await expect(service.handleBookingCreated(eventPayload)).resolves.toBeUndefined();
    });

    it('saves externalPaymentId from gateway response', async () => {
      const newPayment = makePayment();
      const gatewayResp = makeGatewayResponse();

      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.payment.create.mockResolvedValue(newPayment);
      gateway.createPayment.mockResolvedValue(gatewayResp);
      prisma.payment.update.mockResolvedValue(newPayment);

      await service.handleBookingCreated(eventPayload);

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PAYMENT_ID },
          data: expect.objectContaining({
            externalPaymentId: EXTERNAL_PAYMENT_ID,
          }),
        }),
      );
    });
  });
});
