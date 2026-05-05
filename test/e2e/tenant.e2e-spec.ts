import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createE2eApp } from '../helpers/app.helper';
import { truncateDatabase } from '../helpers/db.helper';
import { loginAs } from '../helpers/auth.helper';
import { seedAll, SeedResult } from '../helpers/seed.helper';
import { PrismaService } from 'src/prisma';

describe('Tenant (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let seed: SeedResult;
  let superAdminToken: string;
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
    // SUPER_ADMIN tidak punya tenantId (null), ADMIN/CUSTOMER butuh tenantId
    superAdminToken = (await loginAs(app, seed.superAdmin.email)).accessToken;
    adminToken = (await loginAs(app, seed.admin.email, 'Test1234!', seed.tenant.id)).accessToken;
    customerToken = (await loginAs(app, seed.customer.email, 'Test1234!', seed.tenant.id)).accessToken;
  });

  // ─── POST /api/v1/tenants ─────────────────────────────────────────────────────

  describe('POST /api/v1/tenants', () => {
    it('201 — SUPER_ADMIN create tenant berhasil', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'New Tenant',
          slug: 'new-tenant',
          email: 'new@tenant.com',
        })
        .expect(201);

      expect(res.body.code).toBe(201);
      expect(res.body.data).toMatchObject({
        name: 'New Tenant',
        slug: 'new-tenant',
      });
    });

    it('403 — ADMIN tidak bisa create tenant', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Forbidden Tenant',
          slug: 'forbidden-tenant',
          email: 'forbidden@tenant.com',
        })
        .expect(403);

      expect(res.body.code).toBe(403);
    });

    it('403 — CUSTOMER tidak bisa create tenant', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Forbidden Tenant',
          slug: 'forbidden-tenant',
          email: 'forbidden@tenant.com',
        })
        .expect(403);

      expect(res.body.code).toBe(403);
    });

    it('400 — slug duplikat → bad request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Duplicate Slug',
          slug: seed.tenant.slug, // pakai slug yang sudah ada
          email: 'duplicate@tenant.com',
        })
        .expect(400);

      expect(res.body.code).toBe(400);
    });

    it('400 — DTO invalid (email format salah)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Bad Tenant',
          slug: 'bad-tenant',
          email: 'bukan-email',
        })
        .expect(400);

      expect(res.body.code).toBe(400);
    });

    it('401 — tanpa JWT → ditolak', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .send({
          name: 'Unauth Tenant',
          slug: 'unauth-tenant',
          email: 'unauth@tenant.com',
        })
        .expect(401);

      expect(res.body.code).toBe(401);
    });
  });

  // ─── GET /api/v1/tenants ──────────────────────────────────────────────────────

  describe('GET /api/v1/tenants', () => {
    it('200 — SUPER_ADMIN list tenants dengan pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/tenants')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('page');
      expect(res.body.data).toHaveProperty('limit');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('403 — ADMIN tidak bisa list tenants', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(res.body.code).toBe(403);
    });

    it('401 — tanpa JWT → ditolak', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/tenants')
        .expect(401);

      expect(res.body.code).toBe(401);
    });
  });

  // ─── GET /api/v1/tenants/slug/:slug ──────────────────────────────────────────

  describe('GET /api/v1/tenants/slug/:slug', () => {
    it('200 — SUPER_ADMIN find by slug berhasil', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tenants/slug/${seed.tenant.slug}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data.slug).toBe(seed.tenant.slug);
    });

    it('404 — slug tidak ada', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/tenants/slug/slug-yang-tidak-ada-sama-sekali')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);

      expect(res.body.code).toBe(404);
    });

    it('403 — ADMIN tidak bisa akses', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tenants/slug/${seed.tenant.slug}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(res.body.code).toBe(403);
    });
  });

  // ─── GET /api/v1/tenants/:id ──────────────────────────────────────────────────

  describe('GET /api/v1/tenants/:id', () => {
    it('200 — SUPER_ADMIN find by ID berhasil', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${seed.tenant.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data.id).toBe(seed.tenant.id);
    });

    it('404 — ID tidak ada', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/tenants/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);

      expect(res.body.code).toBe(404);
    });

    it('403 — CUSTOMER tidak bisa akses', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${seed.tenant.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(res.body.code).toBe(403);
    });
  });

  // ─── PATCH /api/v1/tenants/:id/status ────────────────────────────────────────

  describe('PATCH /api/v1/tenants/:id/status', () => {
    it('200 — SUPER_ADMIN toggle inactive berhasil', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tenants/${seed.tenant.id}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ isActive: false, reason: 'Test deactivation' })
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('200 — SUPER_ADMIN toggle active kembali', async () => {
      // nonaktifkan dulu
      await request(app.getHttpServer())
        .patch(`/api/v1/tenants/${seed.tenant.id}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ isActive: false })
        .expect(200);

      // aktifkan kembali
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tenants/${seed.tenant.id}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ isActive: true })
        .expect(200);

      expect(res.body.data.isActive).toBe(true);
    });

    it('403 — ADMIN tidak bisa toggle tenant status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tenants/${seed.tenant.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(403);

      expect(res.body.code).toBe(403);
    });

    it('404 — tenant ID tidak ada', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/tenants/00000000-0000-0000-0000-000000000000/status')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ isActive: false })
        .expect(404);

      expect(res.body.code).toBe(404);
    });
  });

  // ─── PATCH /api/v1/tenants/:id ────────────────────────────────────────────────

  describe('PATCH /api/v1/tenants/:id', () => {
    it('200 — SUPER_ADMIN update tenant berhasil', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tenants/${seed.tenant.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: 'Updated Tenant Name' })
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data.name).toBe('Updated Tenant Name');
    });

    it('403 — ADMIN tidak bisa update tenant', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tenants/${seed.tenant.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Forbidden Update' })
        .expect(403);

      expect(res.body.code).toBe(403);
    });

    it('400 — DTO invalid (unknown field ditolak)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tenants/${seed.tenant.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ unknownField: 'value' })
        .expect(400);

      expect(res.body.code).toBe(400);
    });
  });
});
