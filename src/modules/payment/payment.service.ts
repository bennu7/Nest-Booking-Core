import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from 'src/prisma/prisma.service';
import type { PaymentGateway } from './gateways/payment-gateway.interface';
import { PAYMENT_GATEWAY } from './gateways/payment-gateway.interface';
import { BookingStatus, PaymentStatus } from '@generated/enums';
import { shouldAllowRetry } from './utils/midtrans-status-mapper.util';
import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';

export interface BookingCreatedEvent {
  bookingId: string;
  tenantId: string;
  customerId: string;
  amount: any;
  currency: string;
  customerEmail: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async createPayment(bookingId: string, user: CurrentUserPayload) {
    // Validate booking exists and belongs to user's tenant
    const booking = (await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        tenantId: user.tenantId ?? undefined,
        status: 'PENDING',
      },
      include: {
        customer: true,
      },
    })) as any;

    if (!booking) {
      throw new NotFoundException(
        'Booking not found or not eligible for payment',
      );
    }

    // Check if payment already exists
    const existingPayment = await this.prisma.payment.findUnique({
      where: { bookingId },
    });

    if (existingPayment && existingPayment.status === PaymentStatus.SUCCESS) {
      throw new ForbiddenException(
        'Payment already successful for this booking',
      );
    }

    // Get tenant settings for payment config (if any)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: booking.tenantId },
    });

    const settings = (tenant?.settings as any) || {};
    const paymentConfig = settings.payment || {};

    try {
      let payment;

      if (existingPayment) {
        // Update existing pending/failed payment
        payment = await this.prisma.payment.update({
          where: { id: existingPayment.id },
          data: {
            status: PaymentStatus.PENDING,
            amount: booking.totalPrice,
          },
        });
      } else {
        // Create new payment record
        payment = await this.prisma.payment.create({
          data: {
            bookingId,
            tenantId: booking.tenantId,
            amount: booking.totalPrice,
            currency: booking.currency || 'IDR',
            status: PaymentStatus.PENDING,
          },
        });
      }

      // Create payment with gateway
      const gatewayResponse = await this.gateway.createPayment({
        orderId: bookingId,
        amount: Number(booking.totalPrice),
        currency: booking.currency || 'IDR',
        customerEmail: booking.customer.email,
        customerName: booking.customer.fullName,
        customerPhone: booking.customer.phone || undefined,
        paymentMethods: paymentConfig.enabledMethods,
        expiry: paymentConfig.expiry,
        metadata: {
          paymentId: payment.id,
          tenantId: booking.tenantId,
        },
      });

      // Update payment with gateway response
      const updatedPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          externalPaymentId: gatewayResponse.externalId,
          metadata: {
            ...(payment.metadata || {}),
            gatewayResponse,
          },
        },
      });

      this.logger.log(
        `Payment initialized: ${payment.id} for booking: ${bookingId}`,
      );

      return {
        payment: updatedPayment,
        redirectUrl: gatewayResponse.redirectUrl,
        token: gatewayResponse.token,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create payment for booking ${bookingId}: ${error.message}`,
      );
      throw error;
    }
  }

  async findByExternalId(externalId: string) {
    // Lookup hanya via externalPaymentId — canonical field untuk Midtrans order_id.
    // OR dengan bookingId dihapus karena keduanya selalu sama nilai (fragile W6).
    return this.prisma.payment.findFirst({
      where: { externalPaymentId: externalId },
      include: { booking: true },
    });
  }

  async updatePaymentStatus(
    externalId: string,
    status: PaymentStatus,
    metadata?: any,
  ) {
    // Atomic update: use updateMany with externalPaymentId directly to avoid
    // the non-atomic findFirst → update race condition (C2).
    const updateData: any = { status };

    if (status === PaymentStatus.SUCCESS) {
      updateData.paidAt = new Date();
    } else if (status === PaymentStatus.REFUNDED) {
      updateData.refundedAt = new Date();
    }

    const result = await this.prisma.payment.updateMany({
      where: { externalPaymentId: externalId },
      data: updateData,
    });

    if (result.count === 0) {
      throw new NotFoundException(
        `Payment not found for externalId: ${externalId}`,
      );
    }

    // Fetch updated record to return (and to merge metadata if needed)
    const updated = await this.prisma.payment.findFirst({
      where: { externalPaymentId: externalId },
    });

    if (metadata && updated) {
      return this.prisma.payment.update({
        where: { id: updated.id },
        data: {
          metadata: {
            ...((updated.metadata as any) || {}),
            ...metadata,
          },
        },
      });
    }

    return updated;
  }

  async confirmBookingAfterPayment(externalId: string) {
    const payment = await this.findByExternalId(externalId);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Update booking status to CONFIRMED
    await this.prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: BookingStatus.CONFIRMED },
    });

    // Emit event for notification or other side effects
    this.eventEmitter.emit('payment.completed', {
      paymentId: payment.id,
      bookingId: payment.bookingId,
      tenantId: payment.tenantId,
    });

    this.logger.log(
      `Booking ${payment.bookingId} confirmed after successful payment`,
    );
  }

  async retryPayment(paymentId: string, user: CurrentUserPayload) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (user.tenantId && payment.tenantId !== user.tenantId) {
      throw new ForbiddenException('Access denied');
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      throw new ForbiddenException('Payment already successful');
    }

    const metadata = (payment.metadata as any) || {};
    const lastStatus = metadata?.gatewayResponse?.transactionStatus;

    if (!shouldAllowRetry(lastStatus)) {
      throw new ForbiddenException(
        'Payment retry not allowed for current status',
      );
    }

    // [W5] Validasi status booking secara eksplisit sebelum retry.
    // Tanpa ini, createPayment akan throw NotFoundException dengan pesan
    // "Booking not found or not eligible" — menyesatkan karena booking-nya ada.
    if (payment.booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Cannot retry payment: booking is already ${payment.booking.status}`,
      );
    }

    return this.createPayment(payment.bookingId, user);
  }

  // [W7] Subscribe ke event 'booking.created' yang di-emit oleh BookingService.
  // Dengan pattern ini BookingModule tidak perlu import PaymentModule sama sekali
  // — tidak ada circular dependency.
  @OnEvent('booking.created')
  async handleBookingCreated(payload: BookingCreatedEvent): Promise<void> {
    await this.createPaymentFromEvent(payload);
  }

  private async createPaymentFromEvent(
    payload: BookingCreatedEvent,
  ): Promise<void> {
    try {
      // Cek apakah payment sudah ada (idempotency — kalau event ter-emit 2x)
      const existing = await this.prisma.payment.findUnique({
        where: { bookingId: payload.bookingId },
      });

      if (existing) {
        this.logger.warn(
          `Payment already exists for booking ${payload.bookingId}, skipping auto-create`,
        );
        return;
      }

      // Buat Payment record PENDING
      const payment = await this.prisma.payment.create({
        data: {
          bookingId: payload.bookingId,
          tenantId: payload.tenantId,
          amount: payload.amount,
          currency: payload.currency ?? 'IDR',
          status: PaymentStatus.PENDING,
        },
      });

      // Hit gateway untuk mendapatkan snap token / redirect URL
      const gatewayResponse = await this.gateway.createPayment({
        orderId: payload.bookingId,
        amount: Number(payload.amount),
        currency: payload.currency ?? 'IDR',
        customerEmail: payload.customerEmail,
        metadata: { paymentId: payment.id, tenantId: payload.tenantId },
      });

      // Simpan externalPaymentId dari response gateway
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          externalPaymentId: gatewayResponse.externalId,
          metadata: { gatewayResponse } as any,
        },
      });

      this.logger.log(
        `Auto-created payment ${payment.id} for booking ${payload.bookingId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to auto-create payment for booking ${payload.bookingId}: ${error.message}`,
      );

      // [W7 error handling] Emit payment.failed agar NotificationService bisa
      // kirim notifikasi ke customer bahwa payment perlu dibuat ulang secara manual.
      this.eventEmitter.emit('payment.failed', {
        bookingId: payload.bookingId,
        tenantId: payload.tenantId,
        customerId: payload.customerId,
        reason: error.message,
      });
    }
  }
}
