import { BookingStatus, PaymentStatus, UserRole } from '@generated/enums';

import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';

// ─── IDs ────────────────────────────────────────────────────────────────────

export const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const CUSTOMER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
export const BOOKING_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
export const PAYMENT_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
export const EXTERNAL_PAYMENT_ID = 'midtrans-order-abc123';

// ─── User payload ────────────────────────────────────────────────────────────

export function makeCustomerUser(
  overrides: Partial<CurrentUserPayload> = {},
): CurrentUserPayload {
  return {
    id: CUSTOMER_ID,
    email: 'customer@example.com',
    role: UserRole.CUSTOMER,
    tenantId: TENANT_ID,
    ...overrides,
  };
}

export function makeAdminUser(
  overrides: Partial<CurrentUserPayload> = {},
): CurrentUserPayload {
  return {
    id: 'admin-id',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    tenantId: TENANT_ID,
    ...overrides,
  };
}

// ─── Domain objects ──────────────────────────────────────────────────────────

export function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    tenantId: TENANT_ID,
    customerId: CUSTOMER_ID,
    providerId: 'provider-id',
    serviceId: 'service-id',
    status: BookingStatus.PENDING,
    totalPrice: 150000,
    currency: 'IDR',
    startTime: new Date('2030-07-01T09:00:00Z'),
    endTime: new Date('2030-07-01T10:00:00Z'),
    version: 1,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: {
      id: CUSTOMER_ID,
      email: 'customer@example.com',
      fullName: 'Test Customer',
      phone: '081234567890',
    },
    ...overrides,
  };
}

export function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: PAYMENT_ID,
    tenantId: TENANT_ID,
    bookingId: BOOKING_ID,
    amount: 150000,
    currency: 'IDR',
    status: PaymentStatus.PENDING,
    externalPaymentId: null,
    paidAt: null,
    refundedAt: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    booking: makeBooking(),
    ...overrides,
  };
}

export function makeGatewayResponse(
  overrides: Partial<{
    externalId: string;
    redirectUrl: string;
    token: string;
  }> = {},
) {
  return {
    externalId: EXTERNAL_PAYMENT_ID,
    redirectUrl: 'https://app.sandbox.midtrans.com/snap/pay/abc123',
    token: 'snap-token-xyz',
    ...overrides,
  };
}

export function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: TENANT_ID,
    name: 'Test Tenant',
    slug: 'test-tenant',
    isActive: true,
    settings: null,
    ...overrides,
  };
}
