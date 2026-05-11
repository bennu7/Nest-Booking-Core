import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { UserRole, BookingStatus } from '@generated/enums';

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
  createBookingDto,
  makeSlotHold,
  makeBooking,
  makeService,
} from '../fixtures/booking.fixture';

function createPrismaMock() {
  const mock = {
    booking: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    slotHold: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    cancellationPolicy: {
      findFirst: jest.fn(),
    },
    providerProfile: {
      findUnique: jest.fn(),
    },
    service: {
      findUnique: jest.fn(),
    },
    bookingStatusLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mock)),
  };
  return mock;
}

describe('BookingService', () => {
  let service: BookingService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
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

  describe('createBooking', () => {
    it('throws Forbidden when user is not CUSTOMER', async () => {
      await expect(
        service.createBooking(
          currentUserPayload({ role: UserRole.ADMIN }),
          createBookingDto(),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFound when slotHold missing or converted', async () => {
      prisma.slotHold.findUnique.mockResolvedValue(null);

      await expect(
        service.createBooking(currentUserPayload(), createBookingDto()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequest when slotHold expired', async () => {
      prisma.slotHold.findUnique.mockResolvedValue(
        makeSlotHold({ expiresAt: new Date(Date.now() - 10000) }),
      );

      await expect(
        service.createBooking(currentUserPayload(), createBookingDto()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequest when there is a conflicting booking', async () => {
      prisma.slotHold.findUnique.mockResolvedValue(makeSlotHold());
      prisma.booking.findFirst.mockResolvedValue({ id: 'conflicting-id' });

      await expect(
        service.createBooking(currentUserPayload(), createBookingDto()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates booking successfully within a transaction', async () => {
      const slotHold = makeSlotHold();
      const testService = makeService();
      const expectedBooking = makeBooking();

      prisma.slotHold.findUnique.mockResolvedValue(slotHold);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.service.findUnique.mockResolvedValue(testService);
      prisma.booking.create.mockResolvedValue(expectedBooking);

      const res = await service.createBooking(
        currentUserPayload(),
        createBookingDto({ notes: 'My Notes' }),
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: USER_CUSTOMER,
            providerId: slotHold.providerId,
            serviceId: slotHold.serviceId,
            notes: 'My Notes',
          }),
        }),
      );
      expect(prisma.slotHold.update).toHaveBeenCalledWith({
        where: { id: slotHold.id },
        data: { isConverted: true },
      });
      expect(prisma.bookingStatusLog.create).toHaveBeenCalled();
      expect(res).toEqual(expectedBooking);
    });
  });

  describe('confirmBooking', () => {
    it('throws Forbidden when user is CUSTOMER', async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      await expect(
        service.confirmBooking(
          currentUserPayload({ role: UserRole.CUSTOMER }),
          BOOKING_ID,
          {},
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequest when status is not PENDING', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        makeBooking({ status: BookingStatus.CONFIRMED }),
      );

      await expect(
        service.confirmBooking(
          currentUserPayload({ role: UserRole.ADMIN }),
          BOOKING_ID,
          {},
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('confirms booking successfully', async () => {
      const booking = makeBooking({ status: BookingStatus.PENDING });
      prisma.booking.findUnique.mockResolvedValue(booking);
      prisma.booking.update.mockResolvedValue({
        ...booking,
        status: BookingStatus.CONFIRMED,
      });

      const res = await service.confirmBooking(
        currentUserPayload({ role: UserRole.ADMIN }),
        BOOKING_ID,
        { reason: 'Looks good' },
      );

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BOOKING_ID },
          data: expect.objectContaining({ status: BookingStatus.CONFIRMED }),
        }),
      );
      expect(prisma.bookingStatusLog.create).toHaveBeenCalled();
      expect(res.status).toBe(BookingStatus.CONFIRMED);
    });
  });

  describe('cancelBooking', () => {
    it('cancels booking successfully for CUSTOMER (free)', async () => {
      const booking = makeBooking({
        status: BookingStatus.PENDING,
        startTime: new Date(Date.now() + 25 * 60 * 60 * 1000), // 25 jam lagi
      });
      prisma.booking.findUnique.mockResolvedValue(booking);
      prisma.cancellationPolicy.findFirst.mockResolvedValue({
        hoursBeforeFree: 24,
        lateCancelCharge: 50000,
      });
      prisma.booking.update.mockResolvedValue({
        ...booking,
        status: BookingStatus.CANCELLED,
      });

      const res = await service.cancelBooking(
        currentUserPayload({ role: UserRole.CUSTOMER }),
        BOOKING_ID,
        { reason: 'Change of plan' },
      );

      expect(res.status).toBe(BookingStatus.CANCELLED);
      expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: {},
          }),
        }),
      );
    });

    it('cancels booking with late fee for CUSTOMER', async () => {
      const booking = makeBooking({
        status: BookingStatus.PENDING,
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 jam lagi
      });
      prisma.booking.findUnique.mockResolvedValue(booking);
      prisma.cancellationPolicy.findFirst.mockResolvedValue({
        hoursBeforeFree: 24,
        lateCancelCharge: 50000,
      });
      prisma.booking.update.mockResolvedValue({
        ...booking,
        status: BookingStatus.CANCELLED,
      });

      const res = await service.cancelBooking(
        currentUserPayload({ role: UserRole.CUSTOMER }),
        BOOKING_ID,
        { reason: 'Too late' },
      );

      expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: { lateFee: 50000 },
          }),
        }),
      );
    });

    it('throws BadRequest when booking already CANCELLED', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        makeBooking({ status: BookingStatus.CANCELLED }),
      );

      await expect(
        service.cancelBooking(
          currentUserPayload({ role: UserRole.ADMIN }),
          BOOKING_ID,
          {},
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('completeBooking', () => {
    it('completes booking successfully for ADMIN', async () => {
      const booking = makeBooking({ status: BookingStatus.CONFIRMED });
      prisma.booking.findUnique.mockResolvedValue(booking);
      prisma.booking.update.mockResolvedValue({
        ...booking,
        status: BookingStatus.COMPLETED,
      });

      const res = await service.completeBooking(
        currentUserPayload({ role: UserRole.ADMIN }),
        BOOKING_ID,
      );

      expect(res.status).toBe(BookingStatus.COMPLETED);
    });

    it('throws Forbidden when user is CUSTOMER', async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());

      await expect(
        service.completeBooking(
          currentUserPayload({ role: UserRole.CUSTOMER }),
          BOOKING_ID,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
