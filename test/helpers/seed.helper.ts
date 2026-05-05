import { randomUUID } from 'node:crypto';

import * as bcrypt from 'bcrypt';

import { PrismaService } from 'src/prisma';

// ─── Password default semua user seeded ──────────────────────────────────────
export const SEED_PASSWORD = 'Test1234!';
const BCRYPT_ROUNDS = 10;

async function hashPassword(): Promise<string> {
  return bcrypt.hash(SEED_PASSWORD, BCRYPT_ROUNDS);
}

// ─── Return type ─────────────────────────────────────────────────────────────

export interface SeedResult {
  tenant: Awaited<ReturnType<typeof seedTenant>>;
  superAdmin: Awaited<ReturnType<typeof seedSuperAdmin>>;
  admin: Awaited<ReturnType<typeof seedAdmin>>;
  providerUser: Awaited<ReturnType<typeof seedProviderUser>>;
  customer: Awaited<ReturnType<typeof seedCustomer>>;
  category: Awaited<ReturnType<typeof seedCategory>>;
  providerProfile: Awaited<ReturnType<typeof seedProviderProfile>>;
  service: Awaited<ReturnType<typeof seedService>>;
  schedule: Awaited<ReturnType<typeof seedSchedule>>;
}

// ─── Level 0: tanpa FK ───────────────────────────────────────────────────────

export async function seedTenant(
  prisma: PrismaService,
  overrides: Record<string, unknown> = {},
) {
  const uid = randomUUID().slice(0, 8);
  return prisma.tenant.create({
    data: {
      name: `Test Tenant ${uid}`,
      slug: `test-${uid}`,
      email: `tenant-${uid}@test.com`,
      timezone: 'Asia/Jakarta',
      isActive: true,
      ...overrides,
    },
  });
}

export async function seedSuperAdmin(
  prisma: PrismaService,
  overrides: Record<string, unknown> = {},
) {
  const passwordHash = await hashPassword();
  return prisma.user.create({
    data: {
      email: 'superadmin@test.com',
      passwordHash,
      fullName: 'Super Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      authProvider: 'LOCAL',
      ...overrides,
    },
  });
}

// ─── Level 1: FK → Tenant ────────────────────────────────────────────────────

export async function seedAdmin(
  prisma: PrismaService,
  tenantId: string,
  overrides: Record<string, unknown> = {},
) {
  const uid = randomUUID().slice(0, 8);
  const passwordHash = await hashPassword();
  return prisma.user.create({
    data: {
      email: `admin-${uid}@test.com`,
      passwordHash,
      fullName: `Admin ${uid}`,
      role: 'ADMIN',
      isActive: true,
      authProvider: 'LOCAL',
      tenantId,
      ...overrides,
    },
  });
}

export async function seedProviderUser(
  prisma: PrismaService,
  tenantId: string,
  overrides: Record<string, unknown> = {},
) {
  const uid = randomUUID().slice(0, 8);
  const passwordHash = await hashPassword();
  return prisma.user.create({
    data: {
      email: `provider-${uid}@test.com`,
      passwordHash,
      fullName: `Provider ${uid}`,
      role: 'PROVIDER',
      isActive: true,
      authProvider: 'LOCAL',
      tenantId,
      ...overrides,
    },
  });
}

export async function seedCustomer(
  prisma: PrismaService,
  tenantId: string,
  overrides: Record<string, unknown> = {},
) {
  const uid = randomUUID().slice(0, 8);
  const passwordHash = await hashPassword();
  return prisma.user.create({
    data: {
      email: `customer-${uid}@test.com`,
      passwordHash,
      fullName: `Customer ${uid}`,
      role: 'CUSTOMER',
      isActive: true,
      authProvider: 'LOCAL',
      tenantId,
      ...overrides,
    },
  });
}

export async function seedCategory(
  prisma: PrismaService,
  tenantId: string,
  overrides: Record<string, unknown> = {},
) {
  const uid = randomUUID().slice(0, 8);
  return prisma.serviceCategory.create({
    data: {
      tenantId,
      name: `Category ${uid}`,
      description: 'Test category',
      sortOrder: 0,
      isActive: true,
      ...overrides,
    },
  });
}

// ─── Level 2: FK → User[PROVIDER] + Tenant ───────────────────────────────────

export async function seedProviderProfile(
  prisma: PrismaService,
  userId: string,
  tenantId: string,
  overrides: Record<string, unknown> = {},
) {
  return prisma.providerProfile.create({
    data: {
      userId,
      tenantId,
      bio: 'Test provider bio',
      specialization: 'General services',
      isAvailable: true,
      ...overrides,
    },
  });
}

// ─── Level 3: FK → ProviderProfile ───────────────────────────────────────────

export async function seedService(
  prisma: PrismaService,
  providerId: string,
  overrides: Record<string, unknown> = {},
) {
  const uid = randomUUID().slice(0, 8);
  return prisma.service.create({
    data: {
      providerId,
      name: `Service ${uid}`,
      durationMinutes: 60,
      bufferMinutes: 0,
      price: 100000,
      currency: 'IDR',
      maxCapacity: 1,
      isActive: true,
      ...overrides,
    },
  });
}

export async function seedSchedule(
  prisma: PrismaService,
  providerId: string,
  overrides: Record<string, unknown> = {},
) {
  return prisma.providerSchedule.create({
    data: {
      providerId,
      dayOfWeek: 1, // Senin
      startTime: new Date('1970-01-01T08:00:00.000Z'),
      endTime: new Date('1970-01-01T17:00:00.000Z'),
      isActive: true,
      ...overrides,
    },
  });
}

export async function seedBreak(
  prisma: PrismaService,
  providerId: string,
  overrides: Record<string, unknown> = {},
) {
  return prisma.providerBreak.create({
    data: {
      providerId,
      isRecurring: true,
      dayOfWeek: 1,
      breakStart: new Date('1970-01-01T12:00:00.000Z'),
      breakEnd: new Date('1970-01-01T13:00:00.000Z'),
      reason: 'Lunch break',
      ...overrides,
    },
  });
}

// ─── Level 4: FK → Tenant + User + ProviderProfile + Service ─────────────────

export async function seedBooking(
  prisma: PrismaService,
  ids: {
    tenantId: string;
    customerId: string;
    providerId: string;
    serviceId: string;
  },
  overrides: Record<string, unknown> = {},
) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const endTime = new Date(tomorrow);
  endTime.setHours(10, 0, 0, 0);

  return prisma.booking.create({
    data: {
      tenantId: ids.tenantId,
      customerId: ids.customerId,
      providerId: ids.providerId,
      serviceId: ids.serviceId,
      startTime: tomorrow,
      endTime,
      status: 'PENDING',
      totalPrice: 100000,
      currency: 'IDR',
      ...overrides,
    },
  });
}

export async function seedSlotHold(
  prisma: PrismaService,
  ids: {
    tenantId: string;
    customerId: string;
    providerId: string;
    serviceId: string;
  },
  overrides: Record<string, unknown> = {},
) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const endTime = new Date(tomorrow);
  endTime.setHours(10, 0, 0, 0);

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 menit dari sekarang

  return prisma.slotHold.create({
    data: {
      tenantId: ids.tenantId,
      customerId: ids.customerId,
      providerId: ids.providerId,
      serviceId: ids.serviceId,
      startTime: tomorrow,
      endTime,
      expiresAt,
      isConverted: false,
      ...overrides,
    },
  });
}

// ─── Composite: seedAll ───────────────────────────────────────────────────────

/**
 * Membuat dataset baseline lengkap untuk E2E test.
 * Urutan mengikuti dependency graph FK (Level 0 → 3).
 *
 * @example
 * beforeEach(async () => {
 *   await truncateDatabase(prisma);
 *   const seed = await seedAll(prisma);
 *   adminToken = (await loginAs(app, seed.admin.email)).accessToken;
 * });
 */
export async function seedAll(prisma: PrismaService): Promise<SeedResult> {
  // Level 0
  const tenant = await seedTenant(prisma);
  const superAdmin = await seedSuperAdmin(prisma);

  // Level 1
  const admin = await seedAdmin(prisma, tenant.id);
  const providerUser = await seedProviderUser(prisma, tenant.id);
  const customer = await seedCustomer(prisma, tenant.id);
  const category = await seedCategory(prisma, tenant.id);

  // Level 2
  const providerProfile = await seedProviderProfile(
    prisma,
    providerUser.id,
    tenant.id,
  );

  // Level 3
  const service = await seedService(prisma, providerProfile.id, {
    categoryId: category.id,
  });
  const schedule = await seedSchedule(prisma, providerProfile.id);

  return {
    tenant,
    superAdmin,
    admin,
    providerUser,
    customer,
    category,
    providerProfile,
    service,
    schedule,
  };
}
