import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createE2eApp } from '../helpers/app.helper';

/** Must match [prisma/seed.ts](prisma/seed.ts) super admin credentials. */
const SUPER_ADMIN_EMAIL = 'superadmin@booking.com';
const SUPER_ADMIN_PASSWORD = 'SuperAdmin123!';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns 200 and JWT pair for seeded super admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('user-agent', 'e2e-supertest')
        .send({
          email: SUPER_ADMIN_EMAIL,
          password: SUPER_ADMIN_PASSWORD,
        })
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.message).toBe('Success');
      expect(res.body.data?.accessToken).toEqual(expect.any(String));
      expect(res.body.data?.refreshToken).toEqual(expect.any(String));
    });
  });

  describe('POST /api/v1/auth/refresh-token', () => {
    it('returns 200 and a new token pair', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('user-agent', 'e2e-supertest')
        .send({
          email: SUPER_ADMIN_EMAIL,
          password: SUPER_ADMIN_PASSWORD,
        })
        .expect(200);

      const { refreshToken } = login.body.data;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data?.accessToken).toEqual(expect.any(String));
      expect(res.body.data?.refreshToken).toEqual(expect.any(String));
    });
  });
});
