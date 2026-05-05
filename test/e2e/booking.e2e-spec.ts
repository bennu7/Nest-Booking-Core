import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createE2eApp } from '../helpers/app.helper';
import { truncateDatabase } from '../helpers/db.helper';
import { loginAs } from '../helpers/auth.helper';
import {
  seedAll,
  seedBooking,
  SeedResult,
} from '../helpers/seed.helper';
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
    adminToken = (await loginAs(app, seed.admin.email, 'Test1234!', seed.tenant.id)).accessToken;
    customerToken = (await loginAs(app, seed.customer.email, 'Test1234!', seed.tenant.id)).accessToken;
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
});
