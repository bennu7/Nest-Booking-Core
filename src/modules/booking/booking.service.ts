import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@generated/enums';

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
  constructor(private readonly prisma: PrismaService) {}

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
}
