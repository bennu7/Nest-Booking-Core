import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from 'src/prisma/prisma.service';
import type { PaymentGateway } from './gateways/payment-gateway.interface';
import { PAYMENT_GATEWAY } from './gateways/payment-gateway.interface';
import { BookingStatus, PaymentStatus } from '@generated/enums';
import { shouldAllowRetry } from './utils/midtrans-status-mapper.util';
import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator.js';

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
    return this.prisma.payment.findFirst({
      where: {
        OR: [{ externalPaymentId: externalId }, { bookingId: externalId }],
      },
      include: {
        booking: true,
      },
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
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (user.tenantId && payment.tenantId !== user.tenantId) {
      throw new ForbiddenException('Access denied');
    }

    const metadata = (payment.metadata as any) || {};
    const lastStatus = metadata.gatewayResponse?.transactionStatus;

    if (payment.status === PaymentStatus.SUCCESS) {
      throw new ForbiddenException('Payment already successful');
    }

    if (!shouldAllowRetry(lastStatus)) {
      throw new ForbiddenException(
        'Payment retry not allowed for current status',
      );
    }

    return this.createPayment(payment.bookingId, user);
  }
}
