import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createE2eApp } from '../helpers/app.helper';
import { truncateDatabase } from '../helpers/db.helper';
import { loginAs, randomTestIp } from '../helpers/auth.helper';
import { seedAll, seedSuperAdmin, SeedResult, SEED_PASSWORD } from '../helpers/seed.helper';
import { PrismaService } from 'src/prisma';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let seed: SeedResult;

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
  });

  // ─── POST /api/v1/auth/register ─────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('201 — register user baru berhasil', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('user-agent', 'e2e-test')
        .set('X-Forwarded-For', randomTestIp())
        .send({
          email: 'newuser@test.com',
          password: 'Test1234!',
          fullName: 'New User',
        })
        .expect(201);

      expect(res.body.code).toBe(201);
      expect(res.body.data).toMatchObject({
        email: 'newuser@test.com',
        fullName: 'New User',
      });
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('400 — email sudah dipakai → bad request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('user-agent', 'e2e-test')
        .set('X-Forwarded-For', randomTestIp())
        .send({
          email: seed.admin.email,
          password: 'Test1234!',
          fullName: 'Duplicate',
        })
        .expect(400);

      expect(res.body.code).toBe(400);
    });

    it('400 — DTO invalid (email format salah)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('user-agent', 'e2e-test')
        .set('X-Forwarded-For', randomTestIp())
        .send({
          email: 'bukan-email',
          password: 'Test1234!',
          fullName: 'Invalid',
        })
        .expect(400);

      expect(res.body.code).toBe(400);
    });

    it('400 — DTO invalid (password terlalu pendek)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('user-agent', 'e2e-test')
        .set('X-Forwarded-For', randomTestIp())
        .send({
          email: 'valid@test.com',
          password: '123',
          fullName: 'Short Pass',
        })
        .expect(400);

      expect(res.body.code).toBe(400);
    });
  });

  // ─── POST /api/v1/auth/login ─────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('200 — login berhasil → JWT pair', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('user-agent', 'e2e-test')
        .set('X-Forwarded-For', randomTestIp())
        .send({ email: seed.admin.email, password: SEED_PASSWORD, tenantId: seed.tenant.id })
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.body.data.refreshToken).toEqual(expect.any(String));
    });

    it('401 — password salah', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('user-agent', 'e2e-test')
        .set('X-Forwarded-For', randomTestIp())
        .send({ email: seed.admin.email, password: 'WrongPass999!', tenantId: seed.tenant.id })
        .expect(401);

      expect(res.body.code).toBe(401);
    });

    it('401 — user tidak ada → unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('user-agent', 'e2e-test')
        .set('X-Forwarded-For', randomTestIp())
        .send({ email: 'notexist@test.com', password: 'Test1234!' })
        .expect(401);

      expect(res.body.code).toBe(401);
    });

    it('400 — DTO invalid (email kosong)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('user-agent', 'e2e-test')
        .set('X-Forwarded-For', randomTestIp())
        .send({ password: 'Test1234!' })
        .expect(400);

      expect(res.body.code).toBe(400);
    });
  });

  // ─── POST /api/v1/auth/refresh-token ─────────────────────────────────────────

  describe('POST /api/v1/auth/refresh-token', () => {
    it('200 — refresh valid → token pair baru', async () => {
      const { refreshToken } = await loginAs(app, seed.admin.email, SEED_PASSWORD, seed.tenant.id);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.body.data.refreshToken).toEqual(expect.any(String));
    });

    it('401 — refreshToken tidak valid / random string', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: 'invalid-token-string' })
        .expect(401);

      expect(res.body.code).toBe(401);
    });

    it('401 — refreshToken sudah di-revoke setelah logout', async () => {
      const { refreshToken } = await loginAs(app, seed.admin.email, SEED_PASSWORD, seed.tenant.id);

      // logout dulu — revoke token
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken })
        .expect(200);

      // coba refresh dengan token yang sudah di-revoke
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken })
        .expect(401);

      expect(res.body.code).toBe(401);
    });
  });

  // ─── POST /api/v1/auth/logout ────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('200 — logout berhasil dengan token valid', async () => {
      const { refreshToken } = await loginAs(app, seed.admin.email, SEED_PASSWORD, seed.tenant.id);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.code).toBe(200);
    });

    it('401 — logout dengan token tidak dikenal → unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'token-tidak-dikenal' })
        .expect(401);

      expect(res.body.code).toBe(401);
    });
  });

  // ─── POST /api/v1/auth/setup-tenant ──────────────────────────────────────────

  describe('POST /api/v1/auth/setup-tenant', () => {
    it('201 — user authenticated → setup tenant berhasil', async () => {
      // Seed fresh SUPER_ADMIN tanpa tenant
      const freshUser = await seedSuperAdmin(prisma, {
        email: 'freshsuper@test.com',
      });
      const { accessToken } = await loginAs(app, freshUser.email);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/setup-tenant')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'My New Tenant',
          slug: 'my-new-tenant',
          email: 'tenant@newtenant.com',
        })
        .expect(201);

      expect(res.body.code).toBe(201);
      expect(res.body.data).toBeDefined();
    });

    it('401 — tanpa JWT → ditolak', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/setup-tenant')
        .send({
          name: 'My Tenant',
          slug: 'my-tenant',
          email: 'tenant@example.com',
        })
        .expect(401);

      expect(res.body.code).toBe(401);
    });

    it('400 — DTO invalid (slug kurang dari 3 karakter)', async () => {
      const { accessToken } = await loginAs(app, seed.admin.email, SEED_PASSWORD, seed.tenant.id);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/setup-tenant')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'My Tenant',
          slug: 'ab',
          email: 'tenant@example.com',
        })
        .expect(400);

      expect(res.body.code).toBe(400);
    });
  });

  // ─── PATCH /api/v1/auth/users/:id/status ─────────────────────────────────────

  describe('PATCH /api/v1/auth/users/:id/status', () => {
    it('200 — SUPER_ADMIN toggle user inactive', async () => {
      const { accessToken } = await loginAs(app, seed.superAdmin.email);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/auth/users/${seed.customer.id}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isActive: false, reason: 'Suspended for testing' })
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('200 — ADMIN toggle user active kembali', async () => {
      const { accessToken } = await loginAs(app, seed.admin.email, SEED_PASSWORD, seed.tenant.id);

      // Nonaktifkan dulu lewat admin
      await request(app.getHttpServer())
        .patch(`/api/v1/auth/users/${seed.customer.id}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isActive: false })
        .expect(200);

      // Aktifkan kembali
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/auth/users/${seed.customer.id}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isActive: true })
        .expect(200);

      expect(res.body.data.isActive).toBe(true);
    });

    it('403 — CUSTOMER tidak bisa toggle status', async () => {
      const { accessToken } = await loginAs(app, seed.customer.email, SEED_PASSWORD, seed.tenant.id);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/auth/users/${seed.admin.id}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isActive: false })
        .expect(403);

      expect(res.body.code).toBe(403);
    });

    it('401 — user tidak ditemukan → unauthorized', async () => {
      const { accessToken } = await loginAs(app, seed.superAdmin.email);

      const res = await request(app.getHttpServer())
        .patch('/api/v1/auth/users/00000000-0000-0000-0000-000000000000/status')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isActive: false })
        .expect(401);

      expect(res.body.code).toBe(401);
    });

    it('401 — tanpa JWT → ditolak', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/auth/users/${seed.customer.id}/status`)
        .send({ isActive: false })
        .expect(401);

      expect(res.body.code).toBe(401);
    });
  });
});
