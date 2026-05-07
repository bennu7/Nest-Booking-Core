import { BadRequestException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';

import { UserRole } from '@generated/enums';

import { BookingController } from '../../booking.controller';
import { BookingService } from '../../booking.service';
import { SlotService } from '../../slot.service';
import {
  BOOKING_ID,
  TENANT_A,
  cleanupExpiredHoldsQueryDto,
  createSlotHoldDto,
  currentUserPayload,
  listBookingsQueryDto,
  createBookingDto,
} from '../fixtures/booking.fixture';

describe('BookingController', () => {
  let controller: BookingController;
  let bookingService: {
    findManyPaginated: jest.Mock;
    findOneOrThrow: jest.Mock;
    createBooking: jest.Mock;
    confirmBooking: jest.Mock;
    cancelBooking: jest.Mock;
    completeBooking: jest.Mock;
  };
  let slotService: {
    createHold: jest.Mock;
    deleteExpiredHolds: jest.Mock;
  };

  beforeEach(async () => {
    bookingService = {
      findManyPaginated: jest.fn(),
      findOneOrThrow: jest.fn(),
      createBooking: jest.fn(),
      confirmBooking: jest.fn(),
      cancelBooking: jest.fn(),
      completeBooking: jest.fn(),
    };
    slotService = {
      createHold: jest.fn(),
      deleteExpiredHolds: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [BookingController],
      providers: [
        { provide: BookingService, useValue: bookingService },
        { provide: SlotService, useValue: slotService },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(BookingController);
  });

  describe('list', () => {
    it('returns ApiResponse OK with service result', async () => {
      const user = currentUserPayload();
      const query = listBookingsQueryDto();
      const payload = {
        items: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
      };
      bookingService.findManyPaginated.mockResolvedValue(payload);

      const res = await controller.list(user, query);

      expect(bookingService.findManyPaginated).toHaveBeenCalledWith(
        user,
        query,
      );
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.message).toBe('Success');
      expect(res.data).toEqual(payload);
    });
  });

  describe('getOne', () => {
    it('returns ApiResponse OK with booking', async () => {
      const user = currentUserPayload();
      const booking = { id: BOOKING_ID };
      bookingService.findOneOrThrow.mockResolvedValue(booking);

      const res = await controller.getOne(user, BOOKING_ID);

      expect(bookingService.findOneOrThrow).toHaveBeenCalledWith(
        user,
        BOOKING_ID,
      );
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.data).toEqual(booking);
    });
  });

  describe('createSlotHold', () => {
    it('returns ApiResponse CREATED with slot hold', async () => {
      const user = currentUserPayload();
      const dto = createSlotHoldDto();
      const hold = { id: 'hold-1', expiresAt: new Date().toISOString() };
      slotService.createHold.mockResolvedValue(hold);

      const res = await controller.createSlotHold(user, dto);

      expect(slotService.createHold).toHaveBeenCalledWith(user, dto);
      expect(res.code).toBe(HttpStatus.CREATED);
      expect(res.message).toBe('Slot hold created');
      expect(res.data).toEqual(hold);
    });
  });

  describe('cleanupExpiredHolds', () => {
    it('calls deleteExpiredHolds with query tenantId for SUPER_ADMIN', async () => {
      const user = currentUserPayload({
        role: UserRole.SUPER_ADMIN,
        tenantId: null,
      });
      const query = cleanupExpiredHoldsQueryDto({ tenantId: TENANT_A });
      slotService.deleteExpiredHolds.mockResolvedValue({ deleted: 2 });

      const res = await controller.cleanupExpiredHolds(user, query);

      expect(slotService.deleteExpiredHolds).toHaveBeenCalledWith(TENANT_A);
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.message).toBe('Expired slot holds removed');
      expect(res.data).toEqual({ deleted: 2 });
    });

    it('calls deleteExpiredHolds with user tenantId for ADMIN', async () => {
      const user = currentUserPayload({ role: UserRole.ADMIN });
      const query = cleanupExpiredHoldsQueryDto();
      slotService.deleteExpiredHolds.mockResolvedValue({ deleted: 0 });

      const res = await controller.cleanupExpiredHolds(user, query);

      expect(slotService.deleteExpiredHolds).toHaveBeenCalledWith(TENANT_A);
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.data).toEqual({ deleted: 0 });
    });

    it('throws BadRequest when SUPER_ADMIN omits tenantId', async () => {
      const user = currentUserPayload({
        role: UserRole.SUPER_ADMIN,
        tenantId: null,
      });
      const query = cleanupExpiredHoldsQueryDto({ tenantId: undefined });

      await expect(
        controller.cleanupExpiredHolds(user, query),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(slotService.deleteExpiredHolds).not.toHaveBeenCalled();
    });

    it('throws BadRequest when ADMIN has no tenantId', async () => {
      const user = currentUserPayload({
        role: UserRole.ADMIN,
        tenantId: null,
      });

      await expect(
        controller.cleanupExpiredHolds(user, cleanupExpiredHoldsQueryDto()),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(slotService.deleteExpiredHolds).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('returns ApiResponse CREATED with booking result', async () => {
      const user = currentUserPayload();
      const dto = createBookingDto();
      const booking = { id: BOOKING_ID, status: 'PENDING' };
      bookingService.createBooking.mockResolvedValue(booking);

      const res = await controller.create(user, dto);

      expect(bookingService.createBooking).toHaveBeenCalledWith(user, dto);
      expect(res.code).toBe(HttpStatus.CREATED);
      expect(res.message).toBe('Booking created successfully');
      expect(res.data).toEqual(booking);
    });
  });

  describe('confirm', () => {
    it('returns ApiResponse OK with confirmed booking', async () => {
      const user = currentUserPayload({ role: UserRole.ADMIN });
      const booking = { id: BOOKING_ID, status: 'CONFIRMED' };
      bookingService.confirmBooking.mockResolvedValue(booking);

      const res = await controller.confirm(user, BOOKING_ID, {
        reason: 'Confirmed',
      });

      expect(bookingService.confirmBooking).toHaveBeenCalledWith(
        user,
        BOOKING_ID,
        { reason: 'Confirmed' },
      );
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.message).toBe('Booking confirmed successfully');
      expect(res.data).toEqual(booking);
    });
  });

  describe('cancel', () => {
    it('returns ApiResponse OK with cancelled booking', async () => {
      const user = currentUserPayload();
      const booking = { id: BOOKING_ID, status: 'CANCELLED' };
      bookingService.cancelBooking.mockResolvedValue(booking);

      const res = await controller.cancel(user, BOOKING_ID, {
        reason: 'Change of plan',
      });

      expect(bookingService.cancelBooking).toHaveBeenCalledWith(
        user,
        BOOKING_ID,
        { reason: 'Change of plan' },
      );
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.message).toBe('Booking cancelled successfully');
      expect(res.data).toEqual(booking);
    });
  });

  describe('complete', () => {
    it('returns ApiResponse OK with completed booking', async () => {
      const user = currentUserPayload({ role: UserRole.ADMIN });
      const booking = { id: BOOKING_ID, status: 'COMPLETED' };
      bookingService.completeBooking.mockResolvedValue(booking);

      const res = await controller.complete(user, BOOKING_ID);

      expect(bookingService.completeBooking).toHaveBeenCalledWith(
        user,
        BOOKING_ID,
      );
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.message).toBe('Booking completed successfully');
      expect(res.data).toEqual(booking);
    });
  });
});
