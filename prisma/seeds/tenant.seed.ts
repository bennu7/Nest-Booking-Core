import { PrismaClient } from '../../src/generated/client.js';

export interface SeedTenantParams {
  prisma: PrismaClient;
  name: string;
  slug: string;
  email: string;
  timezone?: string;
}

export interface SeedTenantResult {
  id: string;
  name: string;
  email: string;
}

export async function seedTenant({
  prisma,
  name,
  slug,
  email,
  timezone = 'Asia/Jakarta',
}: SeedTenantParams): Promise<SeedTenantResult> {
  const existing = await prisma.tenant.findFirst({ where: { slug } });
  if (existing) {
    console.log(`⏭️  Tenant "${slug}" already exists, skipping...`);
    return {
      id: existing.id,
      name: existing.name,
      email: existing.email ?? '',
    };
  }
  const tenant = await prisma.tenant.create({
    data: { name, slug, email, timezone, isActive: true },
  });
  console.log(`✅ Tenant created: ${tenant.name}`);
  return { id: tenant.id, name: tenant.name, email: tenant.email };
}
