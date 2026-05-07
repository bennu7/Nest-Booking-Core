import { PrismaClient } from '../../src/generated/client.js';

export interface SeedBookingParams {
  prisma: PrismaClient;
  tenantId: string;
  customerId: string;
  providerId: string;
  serviceId: string;
  startTime: Date;
  endTime: Date;
  totalPrice: number;
}

export interface SeedBookingResult {
  id: string;
  status: string;
}

export async function seedBooking({
  prisma,
  tenantId,
  customerId,
  providerId,
  serviceId,
  startTime,
  endTime,
  totalPrice,
}: SeedBookingParams): Promise<SeedBookingResult> {
  const existing = await prisma.booking.findFirst({
    where: { tenantId, customerId, providerId, serviceId, startTime },
  });
  if (existing) {
    console.log(`⏭️  Booking already exists, skipping...`);
    return { id: existing.id, status: existing.status };
  }
  const booking = await prisma.booking.create({
    data: {
      tenantId,
      customerId,
      providerId,
      serviceId,
      startTime,
      endTime,
      status: 'PENDING',
      totalPrice,
      currency: 'IDR',
    },
  });
  console.log(`✅ Booking created: ${booking.id}`);
  return { id: booking.id, status: booking.status };
}
