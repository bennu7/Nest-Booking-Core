import { PrismaClient } from '../../src/generated/client.js';

export interface SeedScheduleParams {
  prisma: PrismaClient;
  providerId: string;
  dayOfWeek: number;
  startTime: Date;
  endTime: Date;
}

export async function seedSchedule({
  prisma,
  providerId,
  dayOfWeek,
  startTime,
  endTime,
}: SeedScheduleParams) {
  const existing = await prisma.providerSchedule.findFirst({
    where: { providerId, dayOfWeek },
  });
  if (existing) {
    console.log(`⏭️  Schedule Day ${dayOfWeek} already exists, skipping...`);
    return;
  }
  await prisma.providerSchedule.create({
    data: { providerId, dayOfWeek, startTime, endTime, isActive: true },
  });
  console.log(
    `✅ Schedule created: Day ${dayOfWeek} (${startTime.toISOString().slice(11, 16)}-${endTime.toISOString().slice(11, 16)})`,
  );
}
