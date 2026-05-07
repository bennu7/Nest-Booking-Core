import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createE2eApp } from '../helpers/app.helper';
import { truncateDatabase } from '../helpers/db.helper';
import { loginAs } from '../helpers/auth.helper';
import { seedAll, seedBooking, SeedResult } from '../helpers/seed.helper';
import { PrismaService } from 'src/prisma';

describe('Booking (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let seed: SeedResult;
  let adminToken: string;
  let customerToken: string;
  let superAdminToken: string;

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateDatabase(prisma);
    seed = await seedAll(prisma);
    adminToken = (
      await loginAs(app, seed.admin.email, 'Test1234!', seed.tenant.id)
    ).accessToken;
    customerToken = (
      await loginAs(app, seed.customer.email, 'Test1234!', seed.tenant.id)
    ).accessToken;
    superAdminToken = (await loginAs(app, seed.superAdmin.email)).accessToken;
  });

  // ─── GET /api/v1/bookings ─────────────────────────────────────────────────

  describe('GET /api/v1/bookings', () => {
    it('200 — ADMIN dapat list bookings', async () => {
      // Buat booking untuk dilist
      await seedBooking(prisma, {
        tenantId: seed.tenant.id,
        customerId: seed.customer.id,
        providerId: seed.providerProfile.id,
        serviceId: seed.service.id,
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('meta');
    });

    it('200 — CUSTOMER dapat list bookings sendiri', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('200 — result mendukung pagination query', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 5 })
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data.meta).toMatchObject({
        page: 1,
        limit: 5,
      });
    });

    it('401 — tanpa JWT → ditolak', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings')
        .expect(401);

      expect(res.body.code).toBe(401);
    });
  });

  // ─── GET /api/v1/bookings/:id ─────────────────────────────────────────────

  describe('GET /api/v1/bookings/:id', () => {
    it('200 — ADMIN dapat get detail booking', async () => {
      const booking = await seedBooking(prisma, {
        tenantId: seed.tenant.id,
        customerId: seed.customer.id,
        providerId: seed.providerProfile.id,
        serviceId: seed.service.id,
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data.id).toBe(booking.id);
    });

    it('200 — CUSTOMER dapat get detail booking miliknya', async () => {
      const booking = await seedBooking(prisma, {
        tenantId: seed.tenant.id,
        customerId: seed.customer.id,
        providerId: seed.providerProfile.id,
        serviceId: seed.service.id,
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${booking.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.code).toBe(200);
    });

    it('404 — booking ID tidak ada', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body.code).toBe(404);
    });

    it('400 — ID bukan UUID valid', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings/bukan-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.code).toBe(400);
    });

    it('401 — tanpa JWT → ditolak', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings/00000000-0000-0000-0000-000000000000')
        .expect(401);

      expect(res.body.code).toBe(401);
    });
  });

  // ─── POST /api/v1/bookings/slot-holds ─────────────────────────────────────

  describe('POST /api/v1/bookings/slot-holds', () => {
    const getTomorrow9am = () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    };

    const getTomorrow10am = () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
      return d.toISOString();
    };

    it('201 — CUSTOMER create slot hold berhasil', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings/slot-holds')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          providerId: seed.providerProfile.id,
          serviceId: seed.service.id,
          startTime: getTomorrow9am(),
          endTime: getTomorrow10am(),
        })
        .expect(201);

      expect(res.body.code).toBe(201);
      expect(res.body.data).toMatchObject({
        providerId: seed.providerProfile.id,
        serviceId: seed.service.id,
      });
    });

    it('403 — ADMIN tidak bisa create slot hold', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings/slot-holds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          providerId: seed.providerProfile.id,
          serviceId: seed.service.id,
          startTime: getTomorrow9am(),
          endTime: getTomorrow10am(),
        })
        .expect(403);

      expect(res.body.code).toBe(403);
    });

    it('400 — DTO invalid (providerId bukan UUID)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings/slot-holds')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          providerId: 'bukan-uuid',
          serviceId: seed.service.id,
          startTime: getTomorrow9am(),
          endTime: getTomorrow10am(),
        })
        .expect(400);

      expect(res.body.code).toBe(400);
    });

    it('401 — tanpa JWT → ditolak', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings/slot-holds')
        .send({
          providerId: seed.providerProfile.id,
          serviceId: seed.service.id,
          startTime: getTomorrow9am(),
          endTime: getTomorrow10am(),
        })
        .expect(401);

      expect(res.body.code).toBe(401);
    });
  });

  // ─── POST /api/v1/bookings/slot-holds/cleanup-expired ─────────────────────

  describe('POST /api/v1/bookings/slot-holds/cleanup-expired', () => {
    it('200 — ADMIN cleanup expired slot holds', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings/slot-holds/cleanup-expired')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data).toHaveProperty('deleted');
    });

    it('200 — SUPER_ADMIN cleanup dengan tenantId query param', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings/slot-holds/cleanup-expired')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .query({ tenantId: seed.tenant.id })
        .expect(200);

      expect(res.body.code).toBe(200);
    });

    it('400 — SUPER_ADMIN tanpa tenantId → bad request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings/slot-holds/cleanup-expired')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);

      expect(res.body.code).toBe(400);
    });

    it('403 — CUSTOMER tidak bisa cleanup', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings/slot-holds/cleanup-expired')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(res.body.code).toBe(403);
    });

    it('401 — tanpa JWT → ditolak', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings/slot-holds/cleanup-expired')
        .expect(401);

      expect(res.body.code).toBe(401);
    });
  });

  // ─── POST /api/v1/bookings ────────────────────────────────────────────────

  describe('POST /api/v1/bookings', () => {
    const getTomorrow9am = () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    };

    const getTomorrow10am = () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
      return d.toISOString();
    };

    it('201 — CUSTOMER create booking dari slot hold berhasil', async () => {
      // 1. Create slot hold
      const holdRes = await request(app.getHttpServer())
        .post('/api/v1/bookings/slot-holds')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          providerId: seed.providerProfile.id,
          serviceId: seed.service.id,
          startTime: getTomorrow9am(),
          endTime: getTomorrow10am(),
        })
        .expect(201);

      const slotHoldId = holdRes.body.data.id;

      // 2. Create booking
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          slotHoldId,
          notes: 'E2E Booking Notes',
        })
        .expect(201);

      expect(res.body.code).toBe(201);
      expect(res.body.data).toMatchObject({
        customerId: seed.customer.id,
        status: 'PENDING',
      });

      // 3. Verifikasi SlotHold sudah isConverted=true
      const hold = await prisma.slotHold.findUnique({
        where: { id: slotHoldId },
      });
      expect(hold?.isConverted).toBe(true);
    });

    it('404 — SlotHold sudah dikonversi → ditolak', async () => {
      // 1. Create slot hold
      const holdRes = await request(app.getHttpServer())
        .post('/api/v1/bookings/slot-holds')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          providerId: seed.providerProfile.id,
          serviceId: seed.service.id,
          startTime: getTomorrow9am(),
          endTime: getTomorrow10am(),
        })
        .expect(201);

      const slotHoldId = holdRes.body.data.id;

      // 2. Create booking pertama
      await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ slotHoldId })
        .expect(201);

      // 3. Create booking kedua dengan ID yang sama
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ slotHoldId })
        .expect(404);

      expect(res.body.code).toBe(404);
    });

    it('403 — ADMIN tidak bisa create booking', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ slotHoldId: '00000000-0000-0000-0000-000000000000' })
        .expect(403);
    });

    it('400 — Konflik dengan booking yang ada', async () => {
      // 1. Create existing booking di jam besok 09:00 - 10:00
      await seedBooking(
        prisma,
        {
          tenantId: seed.tenant.id,
          customerId: seed.customer.id,
          providerId: seed.providerProfile.id,
          serviceId: seed.service.id,
        },
        {
          startTime: new Date(getTomorrow9am()),
          endTime: new Date(getTomorrow10am()),
          status: 'CONFIRMED',
        },
      );

      // 2. Create slot hold di jam yang sama (logic slot hold mungkin belum cek booking conflict secara ketat di service-nya, tapi BookingService harus cek)
      const holdRes = await request(app.getHttpServer())
        .post('/api/v1/bookings/slot-holds')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          providerId: seed.providerProfile.id,
          serviceId: seed.service.id,
          startTime: getTomorrow9am(),
          endTime: getTomorrow10am(),
        })
        .expect(201);

      const slotHoldId = holdRes.body.data.id;

      // 3. Create booking → harusnya konflik
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ slotHoldId })
        .expect(400);

      expect(res.body.message).toContain('conflict');
    });
  });

  // ─── PATCH /api/v1/bookings/:id/confirm ───────────────────────────────────

  describe('PATCH /api/v1/bookings/:id/confirm', () => {
    it('200 — ADMIN confirm booking berhasil', async () => {
      // 1. Seed PENDING booking
      const booking = await seedBooking(
        prisma,
        {
          tenantId: seed.tenant.id,
          customerId: seed.customer.id,
          providerId: seed.providerProfile.id,
          serviceId: seed.service.id,
        },
        { status: 'PENDING' },
      );

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${booking.id}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Confirmed by E2E' })
        .expect(200);

      expect(res.body.data.status).toBe('CONFIRMED');

      // 3. Verifikasi log
      const log = await prisma.bookingStatusLog.findFirst({
        where: { bookingId: booking.id, newStatus: 'CONFIRMED' },
      });
      expect(log).toBeDefined();
    });

    it('403 — CUSTOMER tidak bisa confirm booking', async () => {
      const booking = await seedBooking(
        prisma,
        {
          tenantId: seed.tenant.id,
          customerId: seed.customer.id,
          providerId: seed.providerProfile.id,
          serviceId: seed.service.id,
        },
        { status: 'PENDING' },
      );

      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${booking.id}/confirm`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('400 — Confirm booking yang sudah CANCELLED', async () => {
      const booking = await seedBooking(
        prisma,
        {
          tenantId: seed.tenant.id,
          customerId: seed.customer.id,
          providerId: seed.providerProfile.id,
          serviceId: seed.service.id,
        },
        { status: 'CANCELLED' },
      );

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${booking.id}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.message).toContain('PENDING');
    });
  });

  // ─── PATCH /api/v1/bookings/:id/cancel ────────────────────────────────────

  describe('PATCH /api/v1/bookings/:id/cancel', () => {
    it('200 — CUSTOMER cancel booking berhasil (free)', async () => {
      // 1. Seed booking 2 hari lagi
      const tomorrow2 = new Date();
      tomorrow2.setDate(tomorrow2.getDate() + 2);
      tomorrow2.setHours(9, 0, 0, 0);

      const booking = await seedBooking(
        prisma,
        {
          tenantId: seed.tenant.id,
          customerId: seed.customer.id,
          providerId: seed.providerProfile.id,
          serviceId: seed.service.id,
        },
        { startTime: tomorrow2, status: 'PENDING' },
      );

      // 2. Seed cancellation policy (24h free)
      await prisma.cancellationPolicy.create({
        data: {
          tenantId: seed.tenant.id,
          name: 'Free 24h',
          hoursBeforeFree: 24,
          lateCancelCharge: '10.50',
          isDefault: true,
        },
      });

      // 3. Cancel
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'E2E Free Cancel' })
        .expect(200);

      expect(res.body.data.status).toBe('CANCELLED');

      // 4. Verifikasi log metadata kosong (free)
      const log = await prisma.bookingStatusLog.findFirst({
        where: { bookingId: booking.id, newStatus: 'CANCELLED' },
      });
      expect(log?.metadata).toEqual({});
    });

    it('200 — CUSTOMER cancel booking dengan late fee', async () => {
      // 1. Seed booking 2 jam lagi
      const soon = new Date();
      soon.setHours(soon.getHours() + 2);

      const booking = await seedBooking(
        prisma,
        {
          tenantId: seed.tenant.id,
          customerId: seed.customer.id,
          providerId: seed.providerProfile.id,
          serviceId: seed.service.id,
        },
        { startTime: soon, status: 'PENDING' },
      );

      // (Policy sudah ada dari test sebelumnya karena truncateDatabase dipanggil di beforeEach,
      //  tapi di sini kita buat policy baru jika perlu. Namun beforeEach memanggil truncateDatabase,
      //  jadi kita harus buat lagi)
      await prisma.cancellationPolicy.create({
        data: {
          tenantId: seed.tenant.id,
          name: 'Free 24h',
          hoursBeforeFree: 24,
          lateCancelCharge: '10.50',
          isDefault: true,
        },
      });

      // 2. Cancel
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'E2E Late Cancel' })
        .expect(200);

      expect(res.body.data.status).toBe('CANCELLED');

      // 3. Verifikasi log metadata ada lateFee
      const log = await prisma.bookingStatusLog.findFirst({
        where: { bookingId: booking.id, newStatus: 'CANCELLED' },
      });
      expect(log?.metadata).toMatchObject({ lateFee: 10.5 });
    });

    it('200 — ADMIN cancel booking berhasil', async () => {
      const booking = await seedBooking(prisma, {
        tenantId: seed.tenant.id,
        customerId: seed.customer.id,
        providerId: seed.providerProfile.id,
        serviceId: seed.service.id,
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Admin override' })
        .expect(200);
    });
  });

  // ─── PATCH /api/v1/bookings/:id/complete ──────────────────────────────────

  describe('PATCH /api/v1/bookings/:id/complete', () => {
    it('200 — ADMIN complete booking berhasil', async () => {
      const booking = await seedBooking(
        prisma,
        {
          tenantId: seed.tenant.id,
          customerId: seed.customer.id,
          providerId: seed.providerProfile.id,
          serviceId: seed.service.id,
        },
        { status: 'CONFIRMED' },
      );

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${booking.id}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('COMPLETED');
    });

    it('403 — CUSTOMER tidak bisa complete booking', async () => {
      const booking = await seedBooking(
        prisma,
        {
          tenantId: seed.tenant.id,
          customerId: seed.customer.id,
          providerId: seed.providerProfile.id,
          serviceId: seed.service.id,
        },
        { status: 'CONFIRMED' },
      );

      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${booking.id}/complete`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('400 — Complete booking yang masih PENDING', async () => {
      const booking = await seedBooking(prisma, {
        tenantId: seed.tenant.id,
        customerId: seed.customer.id,
        providerId: seed.providerProfile.id,
        serviceId: seed.service.id,
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${booking.id}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.message).toContain('PENDING');
    });
  });
});
