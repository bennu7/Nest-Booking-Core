import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { UserRole } from '@generated/enums';

import { PrismaService } from 'src/prisma';

import { BookingService } from '../../booking.service';
import {
  BOOKING_ID,
  PROVIDER_PROFILE_ID,
  TENANT_A,
  USER_CUSTOMER,
  USER_PROVIDER,
  currentUserPayload,
  listBookingsQueryDto,
} from '../fixtures/booking.fixture';

function createPrismaMock() {
  return {
    booking: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    providerProfile: {
      findUnique: jest.fn(),
    },
  };
}

describe('BookingService', () => {
  let service: BookingService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [BookingService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(BookingService);
  });

  describe('findManyPaginated', () => {
    it('throws BadRequest when SUPER_ADMIN omits tenantId', async () => {
      await expect(
        service.findManyPaginated(
          currentUserPayload({ role: UserRole.SUPER_ADMIN, tenantId: null }),
          listBookingsQueryDto({ tenantId: undefined }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
    });

    it('throws BadRequest when non-super user has no tenantId', async () => {
      await expect(
        service.findManyPaginated(
          currentUserPayload({ role: UserRole.ADMIN, tenantId: null }),
          listBookingsQueryDto(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('builds CUSTOMER where and returns paginated result', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      const query = listBookingsQueryDto({ page: 2, limit: 10 });
      const result = await service.findManyPaginated(
        currentUserPayload({ role: UserRole.CUSTOMER }),
        query,
      );

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_A, customerId: USER_CUSTOMER },
          skip: 10,
          take: 10,
          orderBy: { startTime: 'desc' },
        }),
      );
      expect(prisma.booking.count).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A, customerId: USER_CUSTOMER },
      });
      expect(result.meta).toMatchObject({
        page: 2,
        limit: 10,
        total: 0,
        totalPages: 1,
      });
      expect(result.items).toEqual([]);
    });

    it('builds ADMIN where without customerId', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(5);

      await service.findManyPaginated(
        currentUserPayload({ role: UserRole.ADMIN }),
        listBookingsQueryDto(),
      );

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_A },
        }),
      );
    });

    it('builds SUPER_ADMIN where using query tenantId', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      await service.findManyPaginated(
        currentUserPayload({ role: UserRole.SUPER_ADMIN, tenantId: null }),
        listBookingsQueryDto({ tenantId: TENANT_A }),
      );

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_A },
        }),
      );
    });

    it('throws Forbidden when PROVIDER has no profile', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.findManyPaginated(
          currentUserPayload({
            id: USER_PROVIDER,
            role: UserRole.PROVIDER,
          }),
          listBookingsQueryDto(),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
    });

    it('throws Forbidden when PROVIDER profile tenant mismatches', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue({
        id: PROVIDER_PROFILE_ID,
        tenantId: '99999999-9999-9999-9999-999999999999',
      });

      await expect(
        service.findManyPaginated(
          currentUserPayload({
            id: USER_PROVIDER,
            role: UserRole.PROVIDER,
          }),
          listBookingsQueryDto(),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('builds PROVIDER where with providerId from profile', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue({
        id: PROVIDER_PROFILE_ID,
        tenantId: TENANT_A,
      });
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      await service.findManyPaginated(
        currentUserPayload({
          id: USER_PROVIDER,
          role: UserRole.PROVIDER,
        }),
        listBookingsQueryDto(),
      );

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: TENANT_A,
            providerId: PROVIDER_PROFILE_ID,
          },
        }),
      );
    });

    it('throws Forbidden for unknown role string', async () => {
      await expect(
        service.findManyPaginated(
          currentUserPayload({ role: 'UNKNOWN' }),
          listBookingsQueryDto(),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('findOneOrThrow', () => {
    const baseBooking = {
      id: BOOKING_ID,
      tenantId: TENANT_A,
      customerId: USER_CUSTOMER,
      providerId: PROVIDER_PROFILE_ID,
      serviceId: '66666666-6666-6666-6666-666666666666',
      startTime: new Date(),
      endTime: new Date(),
      status: 'PENDING',
      totalPrice: {} as never,
      currency: 'IDR',
      notes: null,
      cancellationReason: null,
      cancelledBy: null,
      cancelledAt: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      service: { id: 's1', name: 'Cut', durationMinutes: 60 },
      provider: {
        id: PROVIDER_PROFILE_ID,
        user: { fullName: 'Provider Name' },
      },
    };

    it('throws NotFound when booking missing', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.findOneOrThrow(currentUserPayload(), BOOKING_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns booking for SUPER_ADMIN without tenant checks', async () => {
      prisma.booking.findUnique.mockResolvedValue(baseBooking);

      const out = await service.findOneOrThrow(
        currentUserPayload({ role: UserRole.SUPER_ADMIN, tenantId: null }),
        BOOKING_ID,
      );

      expect(out).toEqual(baseBooking);
      expect(prisma.providerProfile.findUnique).not.toHaveBeenCalled();
    });

    it('throws Forbidden when CUSTOMER is not the customer', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...baseBooking,
        customerId: 'other-customer-uuid',
      });

      await expect(
        service.findOneOrThrow(currentUserPayload(), BOOKING_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws Forbidden when CUSTOMER tenant mismatches', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...baseBooking,
        tenantId: '99999999-9999-9999-9999-999999999999',
      });

      await expect(
        service.findOneOrThrow(currentUserPayload(), BOOKING_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws Forbidden when ADMIN has no tenantId', async () => {
      prisma.booking.findUnique.mockResolvedValue(baseBooking);

      await expect(
        service.findOneOrThrow(
          currentUserPayload({ role: UserRole.ADMIN, tenantId: null }),
          BOOKING_ID,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws Forbidden when booking tenant differs from user tenant', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...baseBooking,
        tenantId: '99999999-9999-9999-9999-999999999999',
      });

      await expect(
        service.findOneOrThrow(
          currentUserPayload({ role: UserRole.ADMIN }),
          BOOKING_ID,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws Forbidden when PROVIDER profile does not own booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(baseBooking);
      prisma.providerProfile.findUnique.mockResolvedValue({
        id: 'other-provider-id',
      });

      await expect(
        service.findOneOrThrow(
          currentUserPayload({
            id: USER_PROVIDER,
            role: UserRole.PROVIDER,
          }),
          BOOKING_ID,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns booking for ADMIN in same tenant', async () => {
      prisma.booking.findUnique.mockResolvedValue(baseBooking);

      const out = await service.findOneOrThrow(
        currentUserPayload({ role: UserRole.ADMIN }),
        BOOKING_ID,
      );

      expect(out).toEqual(baseBooking);
    });

    it('returns booking for PROVIDER owning the booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(baseBooking);
      prisma.providerProfile.findUnique.mockResolvedValue({
        id: PROVIDER_PROFILE_ID,
      });

      const out = await service.findOneOrThrow(
        currentUserPayload({
          id: USER_PROVIDER,
          role: UserRole.PROVIDER,
        }),
        BOOKING_ID,
      );

      expect(out).toEqual(baseBooking);
    });
  });
});
