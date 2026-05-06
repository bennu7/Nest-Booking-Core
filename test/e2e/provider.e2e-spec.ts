import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createE2eApp } from '../helpers/app.helper';
import { truncateDatabase } from '../helpers/db.helper';
import { loginAs } from '../helpers/auth.helper';
import { seedAll, SeedResult } from '../helpers/seed.helper';
import { PrismaService } from 'src/prisma';

describe('Provider (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let seed: SeedResult;
  let adminToken: string;
  let customerToken: string;

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
  });

  // ─── POST /api/v1/providers ────────────────────────────────────────────────

  describe('POST /api/v1/providers', () => {
    it('201 — ADMIN create provider berhasil', async () => {
      // Buat user PROVIDER baru agar tidak duplikat dengan seed.providerUser
      const { randomUUID } = await import('node:crypto');
      const uid = randomUUID().slice(0, 8);
      const newProviderUser = await prisma.user.create({
        data: {
          email: `newprovider-${uid}@test.com`,
          passwordHash: 'hash',
          fullName: `New Provider ${uid}`,
          role: 'PROVIDER',
          isActive: true,
          authProvider: 'LOCAL',
          tenantId: seed.tenant.id,
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/providers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: newProviderUser.id,
          bio: 'New provider bio',
          specialization: 'Massage therapy',
        })
        .expect(201);

      expect(res.body.code).toBe(201);
      expect(res.body.data).toMatchObject({
        userId: newProviderUser.id,
      });
    });

    it('403 — CUSTOMER tidak bisa create provider', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/providers')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          userId: seed.providerUser.id,
        })
        .expect(403);

      expect(res.body.code).toBe(403);
    });

    it('401 — tanpa JWT → ditolak', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/providers')
        .send({
          userId: seed.providerUser.id,
        })
        .expect(401);

      expect(res.body.code).toBe(401);
    });

    it('400 — DTO invalid (userId bukan UUID)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/providers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: 'bukan-uuid',
        })
        .expect(400);

      expect(res.body.code).toBe(400);
    });
  });

  // ─── GET /api/v1/providers ─────────────────────────────────────────────────

  describe('GET /api/v1/providers', () => {
    it('200 — ADMIN list providers di tenant', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/providers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('403 — CUSTOMER tidak bisa list providers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/providers')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(res.body.code).toBe(403);
    });

    it('401 — tanpa JWT → ditolak', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/providers')
        .expect(401);

      expect(res.body.code).toBe(401);
    });
  });

  // ─── GET /api/v1/providers/:id ────────────────────────────────────────────

  describe('GET /api/v1/providers/:id', () => {
    it('200 — ADMIN get detail provider berhasil', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/providers/${seed.providerProfile.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data.id).toBe(seed.providerProfile.id);
    });

    it('200 — CUSTOMER dapat get detail provider', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/providers/${seed.providerProfile.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.code).toBe(200);
    });

    it('404 — ID tidak ada', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/providers/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body.code).toBe(404);
    });
  });

  // ─── PATCH /api/v1/providers/:id ──────────────────────────────────────────

  describe('PATCH /api/v1/providers/:id', () => {
    it('200 — ADMIN update provider berhasil', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/providers/${seed.providerProfile.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ bio: 'Updated bio text' })
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data.bio).toBe('Updated bio text');
    });

    it('403 — CUSTOMER tidak bisa update provider', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/providers/${seed.providerProfile.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ bio: 'Forbidden update' })
        .expect(403);

      expect(res.body.code).toBe(403);
    });
  });

  // ─── POST /api/v1/providers/:id/services ──────────────────────────────────

  describe('POST /api/v1/providers/:id/services', () => {
    it('201 — ADMIN create service untuk provider berhasil', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/providers/${seed.providerProfile.id}/services`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Service',
          durationMinutes: 60,
          price: 150000,
        })
        .expect(201);

      expect(res.body.code).toBe(201);
      expect(res.body.data).toMatchObject({ name: 'New Service' });
    });

    it('403 — CUSTOMER tidak bisa create service', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/providers/${seed.providerProfile.id}/services`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Forbidden Service',
          durationMinutes: 30,
          price: 50000,
        })
        .expect(403);

      expect(res.body.code).toBe(403);
    });

    it('400 — DTO invalid (durationMinutes kurang dari 1)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/providers/${seed.providerProfile.id}/services`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Bad Service',
          durationMinutes: 0,
          price: 50000,
        })
        .expect(400);

      expect(res.body.code).toBe(400);
    });
  });

  // ─── GET /api/v1/providers/:id/services ───────────────────────────────────

  describe('GET /api/v1/providers/:id/services', () => {
    it('200 — ADMIN list services provider berhasil', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/providers/${seed.providerProfile.id}/services`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('200 — CUSTOMER dapat melihat services', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/providers/${seed.providerProfile.id}/services`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.code).toBe(200);
    });

    it('401 — tanpa JWT → ditolak', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/providers/${seed.providerProfile.id}/services`)
        .expect(401);

      expect(res.body.code).toBe(401);
    });
  });

  // ─── PATCH /api/v1/providers/:pId/services/:sId ───────────────────────────

  describe('PATCH /api/v1/providers/:pId/services/:sId', () => {
    it('200 — ADMIN update service berhasil', async () => {
      const res = await request(app.getHttpServer())
        .patch(
          `/api/v1/providers/${seed.providerProfile.id}/services/${seed.service.id}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Service Name' })
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data.name).toBe('Updated Service Name');
    });

    it('403 — CUSTOMER tidak bisa update service', async () => {
      const res = await request(app.getHttpServer())
        .patch(
          `/api/v1/providers/${seed.providerProfile.id}/services/${seed.service.id}`,
        )
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Forbidden Update' })
        .expect(403);

      expect(res.body.code).toBe(403);
    });

    it('404 — service tidak ada', async () => {
      const res = await request(app.getHttpServer())
        .patch(
          `/api/v1/providers/${seed.providerProfile.id}/services/00000000-0000-0000-0000-000000000000`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Not Found' })
        .expect(404);

      expect(res.body.code).toBe(404);
    });
  });

  // ─── DELETE /api/v1/providers/:pId/services/:sId ──────────────────────────

  describe('DELETE /api/v1/providers/:pId/services/:sId', () => {
    it('200 — ADMIN delete service berhasil', async () => {
      const res = await request(app.getHttpServer())
        .delete(
          `/api/v1/providers/${seed.providerProfile.id}/services/${seed.service.id}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.code).toBe(200);
    });

    it('403 — CUSTOMER tidak bisa delete service', async () => {
      const res = await request(app.getHttpServer())
        .delete(
          `/api/v1/providers/${seed.providerProfile.id}/services/${seed.service.id}`,
        )
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(res.body.code).toBe(403);
    });
  });

  // ─── PATCH /api/v1/providers/:id/schedule ────────────────────────────────

  describe('PATCH /api/v1/providers/:id/schedule', () => {
    it('200 — ADMIN set schedule provider berhasil', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/providers/${seed.providerProfile.id}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          days: [
            {
              dayOfWeek: 1,
              startTime: '2024-01-01T08:00:00.000Z',
              endTime: '2024-01-01T17:00:00.000Z',
              isActive: true,
            },
          ],
        })
        .expect(200);

      expect(res.body.code).toBe(200);
    });

    it('403 — CUSTOMER tidak bisa update schedule', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/providers/${seed.providerProfile.id}/schedule`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          days: [
            {
              dayOfWeek: 1,
              startTime: '2024-01-01T08:00:00.000Z',
              endTime: '2024-01-01T17:00:00.000Z',
            },
          ],
        })
        .expect(403);

      expect(res.body.code).toBe(403);
    });
  });

  // ─── GET /api/v1/providers/:id/schedule ──────────────────────────────────

  describe('GET /api/v1/providers/:id/schedule', () => {
    it('200 — ADMIN get schedule berhasil', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/providers/${seed.providerProfile.id}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.code).toBe(200);
      // data = { schedules: [...], breaks: [...] }
      expect(res.body.data).toHaveProperty('schedules');
      expect(res.body.data).toHaveProperty('breaks');
      expect(Array.isArray(res.body.data.schedules)).toBe(true);
    });

    it('200 — CUSTOMER dapat melihat schedule', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/providers/${seed.providerProfile.id}/schedule`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data).toHaveProperty('schedules');
    });
  });

  // ─── POST /api/v1/providers/:id/breaks ────────────────────────────────────

  describe('POST /api/v1/providers/:id/breaks', () => {
    it('201 — ADMIN create break berhasil', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/providers/${seed.providerProfile.id}/breaks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dayOfWeek: 1,
          breakStart: '1970-01-01T12:00:00.000Z',
          breakEnd: '1970-01-01T13:00:00.000Z',
          reason: 'Lunch break',
          isRecurring: true,
        })
        .expect(201);

      expect(res.body.code).toBe(201);
    });

    it('403 — CUSTOMER tidak bisa create break', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/providers/${seed.providerProfile.id}/breaks`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          dayOfWeek: 2,
          breakStart: '1970-01-01T12:00:00.000Z',
          breakEnd: '1970-01-01T13:00:00.000Z',
        })
        .expect(403);

      expect(res.body.code).toBe(403);
    });
  });

  // ─── DELETE /api/v1/providers/:pId/breaks/:bId ────────────────────────────

  describe('DELETE /api/v1/providers/:pId/breaks/:bId', () => {
    it('200 — ADMIN delete break berhasil', async () => {
      // Buat break dulu
      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/providers/${seed.providerProfile.id}/breaks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dayOfWeek: 3,
          breakStart: '1970-01-01T12:00:00.000Z',
          breakEnd: '1970-01-01T13:00:00.000Z',
          isRecurring: true,
        })
        .expect(201);

      const breakId = createRes.body.data.id;

      const res = await request(app.getHttpServer())
        .delete(
          `/api/v1/providers/${seed.providerProfile.id}/breaks/${breakId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.code).toBe(200);
    });

    it('403 — CUSTOMER tidak bisa delete break', async () => {
      const res = await request(app.getHttpServer())
        .delete(
          `/api/v1/providers/${seed.providerProfile.id}/breaks/00000000-0000-0000-0000-000000000000`,
        )
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(res.body.code).toBe(403);
    });
  });
});
