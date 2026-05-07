import { PrismaClient } from '../../src/generated/client.js';

export interface SeedBreakParams {
  prisma: PrismaClient;
  providerId: string;
  dayOfWeek: number;
  breakStart: Date;
  breakEnd: Date;
  reason?: string;
}

export async function seedBreak({
  prisma,
  providerId,
  dayOfWeek,
  breakStart,
  breakEnd,
  reason = '',
}: SeedBreakParams) {
  const existing = await prisma.providerBreak.findFirst({
    where: { providerId, dayOfWeek, isRecurring: true },
  });
  if (existing) {
    console.log(`⏭️  Break Day ${dayOfWeek} already exists, skipping...`);
    return;
  }
  await prisma.providerBreak.create({
    data: {
      providerId,
      isRecurring: true,
      dayOfWeek,
      breakStart,
      breakEnd,
      reason,
    },
  });
  console.log(`✅ Break created: Day ${dayOfWeek}`);
}
