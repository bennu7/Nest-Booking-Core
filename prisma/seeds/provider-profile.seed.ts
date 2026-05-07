import { PrismaClient } from '../../src/generated/client.js';

export interface SeedProviderProfileParams {
  prisma: PrismaClient;
  userId: string;
  tenantId: string;
  bio?: string;
  specialization?: string;
}

export interface SeedProviderProfileResult {
  id: string;
  userId: string;
}

export async function seedProviderProfile({
  prisma,
  userId,
  tenantId,
  bio = '',
  specialization = '',
}: SeedProviderProfileParams): Promise<SeedProviderProfileResult> {
  const existing = await prisma.providerProfile.findFirst({
    where: { userId },
  });
  if (existing) {
    console.log(`⏭️  Provider Profile already exists, skipping...`);
    return { id: existing.id, userId: existing.userId };
  }
  const profile = await prisma.providerProfile.create({
    data: { userId, tenantId, bio, specialization, isAvailable: true },
  });
  console.log(`✅ Provider Profile created`);
  return { id: profile.id, userId: profile.userId };
}
