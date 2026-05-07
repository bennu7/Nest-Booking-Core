import { UserRole, BookingStatus } from '@generated/enums';

import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';

import { CleanupExpiredHoldsQueryDto } from '../../dto/cleanup-expired-holds-query.dto';
import { CreateSlotHoldDto } from '../../dto/create-slot-hold.dto';
import { ListBookingsQueryDto } from '../../dto/list-bookings-query.dto';
import { CreateBookingDto } from '../../dto/create-booking.dto';
import { UpdateBookingStatusDto } from '../../dto/update-booking-status.dto';

export const TENANT_A = '11111111-1111-1111-1111-111111111111';
export const USER_CUSTOMER = '22222222-2222-2222-2222-222222222222';
export const USER_PROVIDER = '33333333-3333-3333-3333-333333333333';
export const PROVIDER_PROFILE_ID = '44444444-4444-4444-4444-444444444444';
export const BOOKING_ID = '55555555-5555-5555-5555-555555555555';
export const SERVICE_ID = '66666666-6666-6666-6666-666666666666';
export const SLOT_HOLD_ID = '77777777-7777-7777-7777-777777777777';

export function currentUserPayload(
  overrides: Partial<CurrentUserPayload> = {},
): CurrentUserPayload {
  return {
    id: USER_CUSTOMER,
    email: 'customer@test.com',
    role: UserRole.CUSTOMER,
    tenantId: TENANT_A,
    ...overrides,
  };
}

export function listBookingsQueryDto(
  overrides: Partial<ListBookingsQueryDto> = {},
): ListBookingsQueryDto {
  return {
    page: 1,
    limit: 20,
    ...overrides,
  };
}

export function createSlotHoldDto(
  overrides: Partial<CreateSlotHoldDto> = {},
): CreateSlotHoldDto {
  return {
    providerId: PROVIDER_PROFILE_ID,
    serviceId: SERVICE_ID,
    startTime: '2030-06-15T10:00:00.000Z',
    endTime: '2030-06-15T11:00:00.000Z',
    ...overrides,
  };
}

export function cleanupExpiredHoldsQueryDto(
  overrides: Partial<CleanupExpiredHoldsQueryDto> = {},
): CleanupExpiredHoldsQueryDto {
  return {
    ...overrides,
  };
}

export function createBookingDto(
  overrides: Partial<CreateBookingDto> = {},
): CreateBookingDto {
  return {
    slotHoldId: SLOT_HOLD_ID,
    notes: 'Please be on time',
    ...overrides,
  };
}

export function makeSlotHold(overrides: Record<string, unknown> = {}) {
  return {
    id: SLOT_HOLD_ID,
    tenantId: TENANT_A,
    providerId: PROVIDER_PROFILE_ID,
    customerId: USER_CUSTOMER,
    serviceId: SERVICE_ID,
    startTime: new Date('2030-06-15T10:00:00Z'),
    endTime: new Date('2030-06-15T11:00:00Z'),
    expiresAt: new Date('2030-06-15T10:15:00Z'),
    isConverted: false,
    createdAt: new Date(),
    ...overrides,
  };
}

export function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    tenantId: TENANT_A,
    customerId: USER_CUSTOMER,
    providerId: PROVIDER_PROFILE_ID,
    serviceId: SERVICE_ID,
    startTime: new Date('2030-06-15T10:00:00Z'),
    endTime: new Date('2030-06-15T11:00:00Z'),
    status: BookingStatus.PENDING,
    totalPrice: 100000,
    currency: 'IDR',
    notes: 'Some notes',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makeBookingStatusLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-id',
    bookingId: BOOKING_ID,
    previousStatus: null,
    newStatus: BookingStatus.PENDING,
    changedBy: USER_CUSTOMER,
    createdAt: new Date(),
    ...overrides,
  };
}

export function makeService(overrides: Record<string, unknown> = {}) {
  return {
    id: SERVICE_ID,
    providerId: PROVIDER_PROFILE_ID,
    name: 'Test Service',
    price: 100000,
    currency: 'IDR',
    durationMinutes: 60,
    ...overrides,
  };
}
