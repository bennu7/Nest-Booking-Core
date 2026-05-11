import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserRole, BookingStatus } from '@generated/enums';
import { CreateBookingDto, UpdateBookingStatusDto } from './dto';

import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';
import { getPaginationParams } from 'src/common/dto/pagination.dto';
import { PrismaService } from 'src/prisma';

import { ListBookingsQueryDto } from './dto';

const bookingListInclude = {
  service: { select: { id: true, name: true, durationMinutes: true } },
  provider: {
    select: {
      id: true,
      user: { select: { fullName: true } },
    },
  },
} as const;

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private resolveTenantId(
    user: CurrentUserPayload,
    query: ListBookingsQueryDto,
  ): string {
    if (user.role === UserRole.SUPER_ADMIN) {
      if (!query.tenantId) {
        throw new BadRequestException(
          'tenantId query parameter is required for SUPER_ADMIN',
        );
      }
      return query.tenantId;
    }

    if (!user.tenantId) {
      throw new BadRequestException('Tenant context is required');
    }
    return user.tenantId;
  }

  private async bookingListWhere(user: CurrentUserPayload, tenantId: string) {
    if (user.role === UserRole.CUSTOMER) {
      return { tenantId, customerId: user.id };
    }

    if (user.role === UserRole.ADMIN) {
      return { tenantId };
    }

    if (user.role === UserRole.PROVIDER) {
      const profile = await this.prisma.providerProfile.findUnique({
        where: { userId: user.id },
        select: { id: true, tenantId: true },
      });

      if (!profile || profile.tenantId !== tenantId) {
        throw new ForbiddenException(
          'Provider profile not found for this tenant',
        );
      }

      return { tenantId, providerId: profile.id };
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return { tenantId };
    }

    throw new ForbiddenException('Insufficient role');
  }

  async findManyPaginated(
    user: CurrentUserPayload,
    query: ListBookingsQueryDto,
  ) {
    const tenantId = this.resolveTenantId(user, query);
    const where = await this.bookingListWhere(user, tenantId);
    const { skip, take, page, limit } = getPaginationParams(query);

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take,
        orderBy: { startTime: 'desc' },
        include: bookingListInclude,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOneOrThrow(user: CurrentUserPayload, id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: bookingListInclude,
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return booking;
    }

    if (user.role === UserRole.CUSTOMER) {
      if (
        booking.customerId !== user.id ||
        booking.tenantId !== user.tenantId
      ) {
        throw new ForbiddenException('Access denied');
      }
      return booking;
    }

    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    if (booking.tenantId !== user.tenantId) {
      throw new ForbiddenException('Access denied');
    }

    if (user.role === UserRole.PROVIDER) {
      const profile = await this.prisma.providerProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!profile || booking.providerId !== profile.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    return booking;
  }

  async createBooking(user: CurrentUserPayload, dto: CreateBookingDto) {
    if (user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenException('Only customers can create bookings');
    }

    if (!user.tenantId) {
      throw new BadRequestException('Tenant context is required');
    }

    // 2. Cari SlotHold
    const slotHold = await this.prisma.slotHold.findUnique({
      where: { id: dto.slotHoldId },
    });

    // 3. Validasi SlotHold
    if (
      !slotHold ||
      slotHold.isConverted ||
      slotHold.customerId !== user.id ||
      slotHold.tenantId !== user.tenantId
    ) {
      throw new NotFoundException('Slot hold not found or already converted');
    }

    // 4. Cek expired
    if (slotHold.expiresAt < new Date()) {
      throw new BadRequestException('Slot hold has expired');
    }

    // 5. Periksa konflik booking
    const conflict = await this.prisma.booking.findFirst({
      where: {
        providerId: slotHold.providerId,
        status: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] },
        OR: [
          {
            startTime: { lt: slotHold.endTime },
            endTime: { gt: slotHold.startTime },
          },
        ],
      },
    });

    if (conflict) {
      throw new BadRequestException('Time slot conflict with existing booking');
    }

    // 7. Fetch Service
    const service = await this.prisma.service.findUnique({
      where: { id: slotHold.serviceId },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // 8. Transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          tenantId: user.tenantId!,
          customerId: user.id,
          providerId: slotHold.providerId,
          serviceId: slotHold.serviceId,
          startTime: slotHold.startTime,
          endTime: slotHold.endTime,
          status: BookingStatus.PENDING,
          totalPrice: service.price,
          currency: service.currency,
          notes: dto.notes,
          version: 1,
        },
        include: bookingListInclude,
      });

      await tx.slotHold.update({
        where: { id: slotHold.id },
        data: { isConverted: true },
      });

      await tx.bookingStatusLog.create({
        data: {
          bookingId: booking.id,
          previousStatus: null,
          newStatus: BookingStatus.PENDING,
          changedBy: user.id,
        },
      });

      return booking;
    });

    // [W7] Emit event setelah booking berhasil dibuat.
    // PaymentService subscribe ke event ini untuk auto-create Payment record.
    // Pakai EventEmitter (bukan direct call) untuk menghindari circular dependency.
    this.eventEmitter.emit('booking.created', {
      bookingId: result.id,
      tenantId: result.tenantId,
      customerId: result.customerId,
      amount: result.totalPrice,
      currency: result.currency,
      customerEmail: user.email,
    });

    this.logger.log(`Booking created: ${result.id}, event emitted`);

    return result;
  }

  async confirmBooking(
    user: CurrentUserPayload,
    id: string,
    dto: UpdateBookingStatusDto,
  ) {
    const booking = await this.findOneOrThrow(user, id);

    if (user.role === UserRole.CUSTOMER) {
      throw new ForbiddenException('Customers cannot confirm bookings');
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Booking is not in PENDING status');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CONFIRMED,
          version: { increment: 1 },
        },
      });

      await tx.bookingStatusLog.create({
        data: {
          bookingId: id,
          previousStatus: BookingStatus.PENDING,
          newStatus: BookingStatus.CONFIRMED,
          changedBy: user.id,
          changeReason: dto.reason,
        },
      });

      return updated;
    });

    return result;
  }

  async cancelBooking(
    user: CurrentUserPayload,
    id: string,
    dto: UpdateBookingStatusDto,
  ) {
    const booking = await this.findOneOrThrow(user, id);

    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Cannot cancel booking in ${booking.status} status`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let lateFee = 0;

      // Logic for CUSTOMER cancellation policy
      if (user.role === UserRole.CUSTOMER) {
        const policy = await tx.cancellationPolicy.findFirst({
          where: { tenantId: user.tenantId as string, isDefault: true },
        });

        if (policy) {
          const now = new Date();
          const hoursDiff =
            (booking.startTime.getTime() - now.getTime()) / (1000 * 60 * 60);

          if (hoursDiff < policy.hoursBeforeFree) {
            lateFee = Number(policy.lateCancelCharge);
          }
        }
      }

      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledBy: user.id,
          cancelledAt: new Date(),
          cancellationReason: dto.reason,
          version: { increment: 1 },
        },
      });

      await tx.bookingStatusLog.create({
        data: {
          bookingId: id,
          previousStatus: booking.status,
          newStatus: BookingStatus.CANCELLED,
          changedBy: user.id,
          changeReason: dto.reason,
          metadata: lateFee > 0 ? { lateFee } : {},
        },
      });

      return updated;
    });

    return result;
  }

  async completeBooking(user: CurrentUserPayload, id: string) {
    const booking = await this.findOneOrThrow(user, id);

    if (user.role === UserRole.CUSTOMER) {
      throw new ForbiddenException('Customers cannot complete bookings');
    }

    const allowedStatuses: string[] = [
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
    ];

    if (!allowedStatuses.includes(booking.status)) {
      throw new BadRequestException(
        `Cannot complete booking in ${booking.status} status`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.COMPLETED,
          version: { increment: 1 },
        },
      });

      await tx.bookingStatusLog.create({
        data: {
          bookingId: id,
          previousStatus: booking.status,
          newStatus: BookingStatus.COMPLETED,
          changedBy: user.id,
        },
      });

      return updated;
    });

    return result;
  }
}
