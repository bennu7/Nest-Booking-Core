import { CreateCategoryDto } from '../../dto/create-category.dto';
import { CreateTenantDto } from '../../dto/create-tenant.dto';
import { ToggleStatusDto } from '../../dto/toggle-status.dto';
import { UpdateCategoryDto } from '../../dto/update-category.dto';
import { UpdateTenantDto } from '../../dto/update-tenant.dto';
import { CreateCancellationPolicyDto } from '../../dto/create-cancellation-policy.dto';
import { UpdateCancellationPolicyDto } from '../../dto/update-cancellation-policy.dto';

export const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const CATEGORY_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
export const USER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
export const POLICY_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

export function createTenantDto(
  overrides: Partial<CreateTenantDto> = {},
): CreateTenantDto {
  return {
    name: 'Acme Salon',
    slug: 'acme-salon',
    email: 'tenant@acme.com',
    timezone: 'Asia/Jakarta',
    ...overrides,
  };
}

export function updateTenantDto(
  overrides: Partial<UpdateTenantDto> = {},
): UpdateTenantDto {
  return {
    name: 'Acme Salon Updated',
    email: 'updated@acme.com',
    ...overrides,
  };
}

export function toggleStatusDto(
  overrides: Partial<ToggleStatusDto> = {},
): ToggleStatusDto {
  return {
    isActive: false,
    reason: 'Billing issue',
    ...overrides,
  };
}

export function createCategoryDto(
  overrides: Partial<CreateCategoryDto> = {},
): CreateCategoryDto {
  return {
    name: 'Hair Care',
    description: 'All hair services',
    sortOrder: 1,
    isActive: true,
    ...overrides,
  };
}

export function updateCategoryDto(
  overrides: Partial<UpdateCategoryDto> = {},
): UpdateCategoryDto {
  return {
    name: 'Hair Care Updated',
    description: 'Updated description',
    ...overrides,
  };
}

export function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: TENANT_ID,
    name: 'Acme Salon',
    slug: 'acme-salon',
    email: 'tenant@acme.com',
    phone: null,
    address: null,
    timezone: 'Asia/Jakarta',
    logoUrl: null,
    isActive: true,
    disabledReason: null,
    disabledAt: null,
    disabledBy: null,
    settings: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function createCancellationPolicyDto(
  overrides: Partial<CreateCancellationPolicyDto> = {},
): CreateCancellationPolicyDto {
  return {
    name: 'Standard Policy',
    hoursBeforeFree: 24,
    lateCancelCharge: 50,
    noShowCharge: 100,
    isDefault: true,
    ...overrides,
  };
}

export function updateCancellationPolicyDto(
  overrides: Partial<UpdateCancellationPolicyDto> = {},
): UpdateCancellationPolicyDto {
  return {
    name: 'Updated Policy',
    lateCancelCharge: 75,
    ...overrides,
  };
}

export function makeCancellationPolicy(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: POLICY_ID,
    tenantId: TENANT_ID,
    name: 'Standard Policy',
    hoursBeforeFree: 24,
    lateCancelCharge: 50,
    noShowCharge: 100,
    isDefault: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}
