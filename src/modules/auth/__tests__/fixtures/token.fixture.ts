import type { JwtPayload } from '../../strategies/jwt.strategy';

export function jwtPayload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'user-id-1',
    email: 'user@test.com',
    role: 'CUSTOMER',
    ...overrides,
  };
}
