import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createE2eApp } from '../helpers/app.helper';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Smoke Test ──────────────────────────────────────────────────────────────

  it('GET / returns hello wrapped as ApiResponse (public)', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);

    expect(res.body).toMatchObject({
      code: 200,
      message: 'Success',
      data: 'Hello World!',
    });
  });

  // ─── Health Check ─────────────────────────────────────────────────────────────

  describe('GET /api/v1/health', () => {
    it('200 — health check publik berhasil', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body).toMatchObject({
        code: 200,
        message: 'Success',
      });
    });
  });

  describe('GET /api/v1/health/ready', () => {
    it('200 — database connectivity check berhasil', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);

      expect(res.body).toMatchObject({
        code: 200,
        message: 'Service is ready',
        data: { status: 'ready' },
      });
    });
  });
});
