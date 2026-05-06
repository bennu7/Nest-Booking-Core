import { UserRole } from '@generated/enums';

import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';
import type { TenantContext } from 'src/common/interfaces/tenant-context.interface';

import { CreateBreakDto } from '../../dto/create-break.dto';
import { CreateProviderDto } from '../../dto/create-provider.dto';
import { CreateServiceDto } from '../../dto/create-service.dto';
import { UpdateProviderDto } from '../../dto/update-provider.dto';
import { UpdateScheduleDto } from '../../dto/update-schedule.dto';
import { UpdateServiceDto } from '../../dto/update-service.dto';

export const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
export const PROVIDER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
export const SERVICE_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
export const CATEGORY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
export const BREAK_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
export const SCHEDULE_ID = '11111111-1111-1111-1111-111111111111';

export const PROVIDER_USER_ID = '22222222-2222-2222-2222-222222222222';
export const OTHER_PROVIDER_ID = '33333333-3333-3333-3333-333333333333';
export const OTHER_USER_ID = '44444444-4444-4444-4444-444444444444';

export function currentUserPayload(
  overrides: Partial<CurrentUserPayload> = {},
): CurrentUserPayload {
  return {
    id: USER_ID,
    email: 'admin@test.com',
    role: UserRole.ADMIN,
    tenantId: TENANT_ID,
    ...overrides,
  };
}

export function providerUserPayload(
  overrides: Partial<CurrentUserPayload> = {},
): CurrentUserPayload {
  return {
    id: PROVIDER_USER_ID,
    email: 'provider@test.com',
    role: UserRole.PROVIDER,
    tenantId: TENANT_ID,
    ...overrides,
  };
}

export function createProviderDto(
  overrides: Partial<CreateProviderDto> = {},
): CreateProviderDto {
  return {
    userId: USER_ID,
    bio: 'Expert barber with 10 years experience',
    specialization: 'Hair cutting',
    ...overrides,
  };
}

export function updateProviderDto(
  overrides: Partial<UpdateProviderDto> = {},
): UpdateProviderDto {
  return {
    bio: 'Updated bio',
    specialization: 'Hair cutting & styling',
    isAvailable: true,
    ...overrides,
  };
}

export function createServiceDto(
  overrides: Partial<CreateServiceDto> = {},
): CreateServiceDto {
  return {
    name: 'Haircut',
    description: 'Standard haircut service',
    durationMinutes: 30,
    bufferMinutes: 5,
    price: 50000,
    currency: 'IDR',
    maxCapacity: 1,
    ...overrides,
  };
}

export function updateServiceDto(
  overrides: Partial<UpdateServiceDto> = {},
): UpdateServiceDto {
  return {
    name: 'Haircut Premium',
    price: 75000,
    ...overrides,
  };
}

export function updateScheduleDto(
  overrides: Partial<UpdateScheduleDto> = {},
): UpdateScheduleDto {
  return {
    days: [
      {
        dayOfWeek: 1,
        startTime: '1970-01-01T08:00:00.000Z',
        endTime: '1970-01-01T17:00:00.000Z',
        isActive: true,
      },
      {
        dayOfWeek: 2,
        startTime: '1970-01-01T08:00:00.000Z',
        endTime: '1970-01-01T17:00:00.000Z',
        isActive: true,
      },
    ],
    ...overrides,
  };
}

export function createBreakDto(
  overrides: Partial<CreateBreakDto> = {},
): CreateBreakDto {
  return {
    isRecurring: true,
    dayOfWeek: 1,
    breakStart: '1970-01-01T12:00:00.000Z',
    breakEnd: '1970-01-01T13:00:00.000Z',
    reason: 'Lunch break',
    ...overrides,
  };
}

export function makeProviderProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: PROVIDER_ID,
    userId: USER_ID,
    tenantId: TENANT_ID,
    bio: 'Expert barber',
    specialization: 'Hair cutting',
    ratingAvg: 0,
    totalReviews: 0,
    isAvailable: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function makeService(overrides: Record<string, unknown> = {}) {
  return {
    id: SERVICE_ID,
    providerId: PROVIDER_ID,
    categoryId: null,
    name: 'Haircut',
    description: 'Standard haircut',
    durationMinutes: 30,
    bufferMinutes: 5,
    price: 50000,
    currency: 'IDR',
    maxCapacity: 1,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    tenantId: TENANT_ID,
    email: 'provider@test.com',
    fullName: 'Test Provider',
    role: UserRole.PROVIDER,
    isActive: true,
    ...overrides,
  };
}

export function makeTenantContext(
  overrides: Partial<TenantContext> = {},
): TenantContext {
  return {
    tenantId: TENANT_ID,
    currentUser: currentUserPayload(),
    ...overrides,
  };
}
