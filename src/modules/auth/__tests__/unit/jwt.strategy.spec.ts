import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JwtStrategy } from '../../strategies/jwt.strategy';
import { jwtPayload } from '../fixtures/token.fixture';

describe('JwtStrategy', () => {
  it('throws when JWT_SECRET is missing', () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    expect(() => new JwtStrategy(config)).toThrow(InternalServerErrorException);
  });

  it('validate maps JWT subject to user id', () => {
    const config = {
      get: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;

    const strategy = new JwtStrategy(config);
    const payload = jwtPayload({
      sub: 'uuid-1',
      email: 'x@y.com',
      role: 'ADMIN',
    });

    expect(strategy.validate(payload)).toEqual({
      id: 'uuid-1',
      email: 'x@y.com',
      role: 'ADMIN',
    });
  });
});
