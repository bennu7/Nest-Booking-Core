import 'dotenv/config';
import { PrismaClient } from '../src/generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const superAdminEmail = 'superadmin@booking.com';
  const password = 'SuperAdmin123!';

  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      email: superAdminEmail,
      role: 'SUPER_ADMIN',
    },
  });

  if (existingSuperAdmin) {
    console.log('⏭️  Super Admin already exists, skipping...');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const superAdmin = await prisma.user.create({
    data: {
      email: superAdminEmail,
      passwordHash: hashedPassword,
      fullName: 'Super Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      authProvider: 'LOCAL',
    },
  });

  console.log('✅ Super Admin created:', {
    id: superAdmin.id,
    email: superAdmin.email,
    role: superAdmin.role,
  });
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
