/**
 * Cross-Module Integration Flows
 *
 * Skenario end-to-end yang melintasi banyak modul sekaligus.
 * Setiap `it` adalah satu alur penuh — tidak dipecah ke describe nested.
 */

import { randomUUID } from 'node:crypto';

import * as bcrypt from 'bcrypt';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createE2eApp } from '../helpers/app.helper';
import { truncateDatabase } from '../helpers/db.helper';
import { loginAs } from '../helpers/auth.helper';
import { seedAll, SeedResult, SEED_PASSWORD } from '../helpers/seed.helper';
import { PrismaService } from 'src/prisma';

describe('Cross-Module Flows (e2e)', () => {
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

  // ─── Flow 1: Full Booking Lifecycle ─────────────────────────────────────────

  it('Flow 1 — full booking lifecycle: hold → pending → confirmed → completed', async () => {
    // 1. Login sebagai ADMIN & CUSTOMER
    const { accessToken: adminToken } = await loginAs(
      app,
      seed.admin.email,
      SEED_PASSWORD,
      seed.tenant.id,
    );
    const { accessToken: customerToken } = await loginAs(
      app,
      seed.customer.email,
      SEED_PASSWORD,
      seed.tenant.id,
    );

    // 2. Customer buat slot hold (Gunakan waktu lusa jam 11 agar aman)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    futureDate.setHours(11, 0, 0, 0);
    const futureEnd = new Date(futureDate);
    futureEnd.setHours(12, 0, 0, 0);

    const holdRes = await request(app.getHttpServer())
      .post('/api/v1/bookings/slot-holds')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        providerId: seed.providerProfile.id,
        serviceId: seed.service.id,
        startTime: futureDate.toISOString(),
        endTime: futureEnd.toISOString(),
      })
      .expect(201);

    const holdId = holdRes.body.data.id;

    // 3. Customer convert hold ke booking (PENDING)
    const bookingRes = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        slotHoldId: holdId,
      })
      .expect(201);

    const bookingId = bookingRes.body.data.id;
    expect(bookingRes.body.data.status).toBe('PENDING');

    // 4. Admin confirm booking (CONFIRMED)
    const confirmRes = await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${bookingId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(confirmRes.body.data.status).toBe('CONFIRMED');

    // 5. Admin complete booking (COMPLETED)
    const completeRes = await request(app.getHttpServer())
      .patch(`/api/v1/bookings/${bookingId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(completeRes.body.data.status).toBe('COMPLETED');

    // 6. Verifikasi audit log (BookingStatusLog)
    const logs = await prisma.bookingStatusLog.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' },
    });

    // PENDING, CONFIRMED, COMPLETED
    expect(logs.length).toBe(3);
    expect(logs[0].newStatus).toBe('PENDING');
    expect(logs[1].newStatus).toBe('CONFIRMED');
    expect(logs[2].newStatus).toBe('COMPLETED');
  });

  // ─── Flow 2: Tenant Data Isolation ──────────────────────────────────────────

  it('Flow 2 — tenant data isolation: ADMIN hanya melihat data tenant sendiri', async () => {
    // Tenant A sudah ada dari seed (seed.tenant + seed.admin)
    const { accessToken: adminAToken } = await loginAs(
      app,
      seed.admin.email,
      SEED_PASSWORD,
      seed.tenant.id,
    );

    // Buat Tenant B secara terpisah via DB langsung (untuk efisiensi)
    const uid = randomUUID().slice(0, 8);
    const tenantB = await prisma.tenant.create({
      data: {
        name: `Tenant B ${uid}`,
        slug: `tenant-b-${uid}`,
        email: `tenantb-${uid}@test.com`,
        timezone: 'Asia/Jakarta',
        isActive: true,
      },
    });

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    const providerUserB = await prisma.user.create({
      data: {
        email: `provider-b-${uid}@test.com`,
        passwordHash,
        fullName: `Provider B ${uid}`,
        role: 'PROVIDER',
        isActive: true,
        authProvider: 'LOCAL',
        tenantId: tenantB.id,
      },
    });

    await prisma.providerProfile.create({
      data: {
        userId: providerUserB.id,
        tenantId: tenantB.id,
        bio: 'Provider B bio',
        isAvailable: true,
      },
    });

    // ADMIN tenant A list providers — hanya dapat provider dari tenant A
    const resA = await request(app.getHttpServer())
      .get('/api/v1/providers')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);

    const providerIds: string[] = resA.body.data.map(
      (p: { id: string }) => p.id,
    );

    // Pastikan provider dari tenant A ada
    expect(providerIds).toContain(seed.providerProfile.id);

    // Pastikan semua provider yang dikembalikan adalah milik tenant A
    for (const pid of providerIds) {
      const provider = await prisma.providerProfile.findUnique({
        where: { id: pid },
      });
      expect(provider?.tenantId).toBe(seed.tenant.id);
    }
  });

  // ─── Flow 3: Auth Token Lifecycle ───────────────────────────────────────────

  it('Flow 3 — auth token lifecycle: login → akses → refresh → logout → revoke', async () => {
    // Login (admin punya tenantId)
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('user-agent', 'e2e-flow-test')
      .send({
        email: seed.admin.email,
        password: SEED_PASSWORD,
        tenantId: seed.tenant.id,
      })
      .expect(200);

    const { accessToken, refreshToken } = loginRes.body.data;

    // Akses endpoint protected → 200
    await request(app.getHttpServer())
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // Refresh token → token baru
    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken })
      .expect(200);

    const newAccessToken = refreshRes.body.data.accessToken;
    const newRefreshToken = refreshRes.body.data.refreshToken;

    // Token baru harus berupa string JWT yang valid
    expect(newAccessToken).toEqual(expect.any(String));
    expect(newRefreshToken).toEqual(expect.any(String));

    // Akses dengan token baru → 200
    await request(app.getHttpServer())
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${newAccessToken}`)
      .expect(200);

    // Logout — revoke token baru
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: newRefreshToken })
      .expect(200);

    // Coba refresh dengan token yang sudah di-revoke → 401
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: newRefreshToken })
      .expect(401);

    // Login ulang berhasil
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('user-agent', 'e2e-flow-test')
      .send({
        email: seed.admin.email,
        password: SEED_PASSWORD,
        tenantId: seed.tenant.id,
      })
      .expect(200);
  });

  // ─── Flow 4: User Deactivation Impact ───────────────────────────────────────

  it('Flow 4 — user deactivation: admin nonaktifkan user → login ditolak', async () => {
    const { accessToken: adminToken } = await loginAs(
      app,
      seed.admin.email,
      SEED_PASSWORD,
      seed.tenant.id,
    );

    // Pastikan customer bisa login dulu
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('user-agent', 'e2e-flow-test')
      .send({
        email: seed.customer.email,
        password: SEED_PASSWORD,
        tenantId: seed.tenant.id,
      })
      .expect(200);

    // ADMIN toggle customer inactive
    const toggleRes = await request(app.getHttpServer())
      .patch(`/api/v1/auth/users/${seed.customer.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false, reason: 'Deactivated for flow test' })
      .expect(200);

    expect(toggleRes.body.data.isActive).toBe(false);

    // Customer coba login → ditolak (401)
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('user-agent', 'e2e-flow-test')
      .send({
        email: seed.customer.email,
        password: SEED_PASSWORD,
        tenantId: seed.tenant.id,
      })
      .expect(401);

    // ADMIN aktifkan kembali
    await request(app.getHttpServer())
      .patch(`/api/v1/auth/users/${seed.customer.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true })
      .expect(200);

    // Customer bisa login kembali
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('user-agent', 'e2e-flow-test')
      .send({
        email: seed.customer.email,
        password: SEED_PASSWORD,
        tenantId: seed.tenant.id,
      })
      .expect(200);
  });
});
