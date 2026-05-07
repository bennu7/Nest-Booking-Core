import { PrismaClient } from '../../src/generated/client.js';

export interface SeedCategoryParams {
  prisma: PrismaClient;
  tenantId: string;
  name: string;
  description?: string;
}

export interface SeedCategoryResult {
  id: string;
  name: string;
}

export async function seedCategory({
  prisma,
  tenantId,
  name,
  description = '',
}: SeedCategoryParams): Promise<SeedCategoryResult> {
  const existing = await prisma.serviceCategory.findFirst({
    where: { tenantId, name },
  });
  if (existing) {
    console.log(`⏭️  Category "${name}" already exists, skipping...`);
    return { id: existing.id, name: existing.name };
  }
  const category = await prisma.serviceCategory.create({
    data: { tenantId, name, description, sortOrder: 0, isActive: true },
  });
  console.log(`✅ Category created: ${category.name}`);
  return { id: category.id, name: category.name };
}
