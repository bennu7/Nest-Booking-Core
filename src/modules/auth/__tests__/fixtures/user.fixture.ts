import { UserRole } from '@generated/enums';

import { LoginDto } from '../../dto/login.dto';
import { RegisterDto } from '../../dto/register.dto';
import { CreateTenantDto } from '../../../tenant/dto/create-tenant.dto';

export function registerDto(overrides: Partial<RegisterDto> = {}): RegisterDto {
  return {
    email: 'user@test.com',
    password: 'secret12',
    fullName: 'Test User',
    role: UserRole.CUSTOMER,
    ...overrides,
  };
}

export function loginDto(overrides: Partial<LoginDto> = {}): LoginDto {
  return {
    email: 'user@test.com',
    password: 'secret12',
    ...overrides,
  };
}

export function createTenantDto(
  overrides: Partial<CreateTenantDto> = {},
): CreateTenantDto {
  return {
    name: 'Acme',
    slug: 'acme-co',
    email: 'tenant@acme.com',
    timezone: 'Asia/Jakarta',
    ...overrides,
  };
}
