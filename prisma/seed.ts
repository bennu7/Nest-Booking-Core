import 'dotenv/config';
import { PrismaClient } from '../src/generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  seedTenant,
  seedUser,
  seedCategory,
  seedProviderProfile,
  seedService,
  seedSchedule,
  seedBreak,
  seedCancellationPolicy,
  seedBooking,
  seedPayment,
  seedPaymentSuccess,
  seedPaymentFailed,
  seedPaymentRefunded,
  SEED_PASSWORD,
} from './seeds/index.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenant = await seedTenant({
    prisma,
    name: 'Demo Tenant',
    slug: 'demo-tenant',
    email: 'demo@booking.com',
  });

  await seedUser({
    prisma,
    email: 'superadmin@booking.com',
    password: 'SuperAdmin123!',
    fullName: 'Super Admin',
    role: 'SUPER_ADMIN',
  });

  const admin = await seedUser({
    prisma,
    email: 'admin@demo.com',
    password: SEED_PASSWORD,
    fullName: 'Admin Demo',
    role: 'ADMIN',
    tenantId: tenant.id,
  });

  const providerUser = await seedUser({
    prisma,
    email: 'provider@demo.com',
    password: SEED_PASSWORD,
    fullName: 'Provider Demo',
    role: 'PROVIDER',
    tenantId: tenant.id,
  });

  const customer = await seedUser({
    prisma,
    email: 'customer@demo.com',
    password: SEED_PASSWORD,
    fullName: 'Customer Demo',
    role: 'CUSTOMER',
    tenantId: tenant.id,
  });

  const category = await seedCategory({
    prisma,
    tenantId: tenant.id,
    name: 'General',
    description: 'General services',
  });

  const providerProfile = await seedProviderProfile({
    prisma,
    userId: providerUser.id,
    tenantId: tenant.id,
    bio: 'Professional service provider',
    specialization: 'General services',
  });

  const service = await seedService({
    prisma,
    providerId: providerProfile.id,
    categoryId: category.id,
    name: 'Consultation',
    durationMinutes: 60,
    price: 150000,
  });

  const startTime = new Date('2026-01-01T08:00:00.000Z');
  const endTime = new Date('2026-01-01T17:00:00.000Z');
  for (const day of [1, 2, 3, 4, 5]) {
    await seedSchedule({
      prisma,
      providerId: providerProfile.id,
      dayOfWeek: day,
      startTime,
      endTime,
    });
  }

  await seedBreak({
    prisma,
    providerId: providerProfile.id,
    dayOfWeek: 1,
    breakStart: new Date('2026-01-01T12:00:00.000Z'),
    breakEnd: new Date('2026-01-01T13:00:00.000Z'),
    reason: 'Lunch break',
  });

  await seedCancellationPolicy({
    prisma,
    tenantId: tenant.id,
    name: 'Standard Policy',
    hoursBeforeFree: 24,
    lateCancelCharge: 50,
    noShowCharge: 100,
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const bookingEndTime = new Date(tomorrow);
  bookingEndTime.setHours(10, 0, 0, 0);

  const booking = await seedBooking({
    prisma,
    tenantId: tenant.id,
    customerId: customer.id,
    providerId: providerProfile.id,
    serviceId: service.id,
    startTime: tomorrow,
    endTime: bookingEndTime,
    totalPrice: service.price,
  });

  const failedBooking = await seedBooking({
    prisma,
    tenantId: tenant.id,
    customerId: customer.id,
    providerId: providerProfile.id,
    serviceId: service.id,
    startTime: new Date(Date.now() + 86400000 * 2),
    endTime: new Date(Date.now() + 86400000 * 2 + 3600000),
    totalPrice: service.price,
  });

  await seedPayment({
    prisma,
    tenantId: tenant.id,
    bookingId: booking.id,
    amount: service.price,
    status: 'PENDING',
    paymentMethod: 'credit_card',
  });

  await seedPaymentSuccess({
    prisma,
    tenantId: tenant.id,
    bookingId: failedBooking.id,
    amount: service.price,
  });

  console.log('\n📋 Seed Summary:');
  console.log(`  Tenant: ${tenant.email}`);
  console.log(`  Admin: ${admin.email} / ${SEED_PASSWORD}`);
  console.log(`  Provider: ${providerUser.email} / ${SEED_PASSWORD}`);
  console.log(`  Customer: ${customer.email} / ${SEED_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
