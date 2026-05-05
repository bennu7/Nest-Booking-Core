import { PrismaService } from 'src/prisma';

/**
 * Ordered from leaf to root to avoid FK violation.
 * CASCADE handles remaining FK constraints, but explicit order is faster.
 */
const TABLE_ORDER = [
  'notifications',
  'booking_status_logs',
  'payments',
  'slot_holds',
  'bookings',
  'idempotency_keys',
  'refresh_tokens',
  'provider_breaks',
  'provider_schedules',
  'services',
  'provider_profiles',
  'service_categories',
  'cancellation_policies',
  'users',
  'tenants',
];

/**
 * Truncates all domain tables and restarts sequences.
 * Call in `beforeEach` to guarantee full test isolation.
 *
 * @example
 * beforeEach(async () => {
 *   await truncateDatabase(prisma);
 *   seed = await seedAll(prisma);
 * });
 */
export async function truncateDatabase(prisma: PrismaService): Promise<void> {
  const tableList = TABLE_ORDER.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
  );
}
