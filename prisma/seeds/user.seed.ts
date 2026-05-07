import { PrismaClient } from '../../src/generated/client.js';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'PROVIDER' | 'CUSTOMER';

export interface SeedUserParams {
  prisma: PrismaClient;
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  tenantId?: string;
}

export interface SeedUserResult {
  id: string;
  email: string;
  role: UserRole;
}

export async function seedUser({
  prisma,
  email,
  password,
  fullName,
  role,
  tenantId,
}: SeedUserParams): Promise<SeedUserResult> {
  const where: { email: string; role?: UserRole } = { email };
  if (role === 'SUPER_ADMIN') where.role = role;
  const existing = await prisma.user.findFirst({ where });
  if (existing) {
    console.log(`⏭️  User "${email}" already exists, skipping...`);
    return {
      id: existing.id,
      email: existing.email,
      role: existing.role as UserRole,
    };
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      role,
      tenantId,
      isActive: true,
      authProvider: 'LOCAL',
    },
  });
  console.log(`✅ User created: ${user.email} (${user.role})`);
  return { id: user.id, email: user.email, role: user.role as UserRole };
}
