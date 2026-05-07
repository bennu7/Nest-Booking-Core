import { PrismaClient } from '../../src/generated/client.js';

export interface SeedCancellationPolicyParams {
  prisma: PrismaClient;
  tenantId: string;
  name: string;
  hoursBeforeFree?: number;
  lateCancelCharge?: number;
  noShowCharge?: number;
}

export interface SeedCancellationPolicyResult {
  id: string;
  name: string;
}

export async function seedCancellationPolicy({
  prisma,
  tenantId,
  name,
  hoursBeforeFree = 24,
  lateCancelCharge = 50,
  noShowCharge = 100,
}: SeedCancellationPolicyParams): Promise<SeedCancellationPolicyResult> {
  const existing = await prisma.cancellationPolicy.findFirst({
    where: { tenantId, name },
  });
  if (existing) {
    console.log(
      `⏭️  Cancellation Policy "${name}" already exists, skipping...`,
    );
    return { id: existing.id, name: existing.name };
  }
  const policy = await prisma.cancellationPolicy.create({
    data: {
      tenantId,
      name,
      hoursBeforeFree,
      lateCancelCharge,
      noShowCharge,
      isDefault: true,
    },
  });
  console.log(`✅ Cancellation Policy created: ${policy.name}`);
  return { id: policy.id, name: policy.name };
}
