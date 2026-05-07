import { PrismaClient } from '../../src/generated/client.js';

export interface SeedServiceParams {
  prisma: PrismaClient;
  providerId: string;
  categoryId: string;
  name: string;
  durationMinutes?: number;
  price?: number;
}

export interface SeedServiceResult {
  id: string;
  name: string;
  price: number;
}

export async function seedService({
  prisma,
  providerId,
  categoryId,
  name,
  durationMinutes = 60,
  price = 100000,
}: SeedServiceParams): Promise<SeedServiceResult> {
  const existing = await prisma.service.findFirst({
    where: { providerId, name },
  });
  if (existing) {
    console.log(`⏭️  Service "${name}" already exists, skipping...`);
    return {
      id: existing.id,
      name: existing.name,
      price: Number(existing.price),
    };
  }
  const service = await prisma.service.create({
    data: {
      providerId,
      categoryId,
      name,
      durationMinutes,
      bufferMinutes: 0,
      price,
      currency: 'IDR',
      maxCapacity: 1,
      isActive: true,
    },
  });
  console.log(`✅ Service created: ${service.name}`);
  return { id: service.id, name: service.name, price: Number(service.price) };
}
