import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResult extends TokenPair {
  userId: string;
  email: string;
}

// ─── loginAs ─────────────────────────────────────────────────────────────────

/**
 * Logs in via `POST /api/v1/auth/login` and returns the token pair.
 * Throws if the response is not 200.
 *
 * @example
 * const { accessToken } = await loginAs(app, seed.admin.email);
 */
export async function loginAs(
  app: INestApplication,
  email: string,
  password = 'Test1234!',
): Promise<TokenPair> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('user-agent', 'e2e-seed-helper')
    .send({ email, password })
    .expect(200);

  return {
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
  };
}

// ─── registerUser ─────────────────────────────────────────────────────────────

/**
 * Registers a new user via `POST /api/v1/auth/register`.
 * Returns the created user id and email from the response body.
 * Throws if the response is not 201.
 *
 * @example
 * const { userId } = await registerUser(app, {
 *   email: 'new@test.com',
 *   password: 'Test1234!',
 *   fullName: 'New User',
 * });
 */
export async function registerUser(
  app: INestApplication,
  dto: { email: string; password: string; fullName: string; role?: string },
): Promise<RegisterResult & { accessToken: string; refreshToken: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .set('user-agent', 'e2e-seed-helper')
    .send(dto)
    .expect(201);

  return {
    userId: res.body.data?.id,
    email: res.body.data?.email,
    // register hanya mengembalikan user data, bukan token —
    // login diperlukan secara terpisah untuk mendapatkan token
    accessToken: '',
    refreshToken: '',
  };
}

// ─── loginWithRegister ────────────────────────────────────────────────────────

/**
 * Register + login dalam satu langkah.
 * Berguna untuk test yang membutuhkan fresh user + token sekaligus.
 *
 * @example
 * const { accessToken, userId } = await loginWithRegister(app, {
 *   email: 'fresh@test.com',
 *   password: 'Test1234!',
 *   fullName: 'Fresh User',
 * });
 */
export async function loginWithRegister(
  app: INestApplication,
  dto: { email: string; password: string; fullName: string; role?: string },
): Promise<{
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
}> {
  await registerUser(app, dto);
  const tokens = await loginAs(app, dto.email, dto.password);
  return { ...tokens, userId: '', email: dto.email };
}
