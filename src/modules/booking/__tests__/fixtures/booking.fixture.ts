import { UserRole } from '@generated/enums';

import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';

import { CleanupExpiredHoldsQueryDto } from '../../dto/cleanup-expired-holds-query.dto';
import { CreateSlotHoldDto } from '../../dto/create-slot-hold.dto';
import { ListBookingsQueryDto } from '../../dto/list-bookings-query.dto';

export const TENANT_A = '11111111-1111-1111-1111-111111111111';
export const USER_CUSTOMER = '22222222-2222-2222-2222-222222222222';
export const USER_PROVIDER = '33333333-3333-3333-3333-333333333333';
export const PROVIDER_PROFILE_ID = '44444444-4444-4444-4444-444444444444';
export const BOOKING_ID = '55555555-5555-5555-5555-555555555555';
export const SERVICE_ID = '66666666-6666-6666-6666-666666666666';

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
