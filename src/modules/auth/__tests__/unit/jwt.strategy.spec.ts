import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UserRole } from '@generated/enums';

import { PrismaService } from 'src/prisma';
import { JwtStrategy } from '../../strategies/jwt.strategy';
import { jwtPayload } from '../fixtures/token.fixture';

describe('JwtStrategy', () => {
  it('throws when JWT_SECRET is missing', () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    const prisma = {
      user: { findUnique: jest.fn() },
    } as unknown as PrismaService;

    expect(() => new JwtStrategy(config, prisma)).toThrow(
      InternalServerErrorException,
    );
  });

  it('validate loads user and returns tenantId', async () => {
    const config = {
      get: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'uuid-1',
          email: 'x@y.com',
          role: UserRole.ADMIN,
          tenantId: 't1',
          isActive: true,
        }),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ isActive: true }),
      },
    } as unknown as PrismaService;

    const strategy = new JwtStrategy(config, prisma);
    const payload = jwtPayload({
      sub: 'uuid-1',
      email: 'x@y.com',
      role: 'ADMIN',
      tenantId: 't1',
    });

    await expect(strategy.validate(payload)).resolves.toEqual({
      id: 'uuid-1',
      email: 'x@y.com',
      role: UserRole.ADMIN,
      tenantId: 't1',
    });
  });

  it('validate rejects when payload tenantId does not match user', async () => {
    const config = {
      get: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'uuid-1',
          email: 'x@y.com',
          role: UserRole.ADMIN,
          tenantId: 't1',
          isActive: true,
        }),
      },
    } as unknown as PrismaService;

    const strategy = new JwtStrategy(config, prisma);

    await expect(
      strategy.validate(
        jwtPayload({
          sub: 'uuid-1',
          tenantId: 'other-tenant',
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('validate rejects when tenant is inactive', async () => {
    const config = {
      get: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'uuid-1',
          email: 'x@y.com',
          role: UserRole.ADMIN,
          tenantId: 't1',
          isActive: true,
        }),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ isActive: false }),
      },
    } as unknown as PrismaService;

    const strategy = new JwtStrategy(config, prisma);

    await expect(
      strategy.validate(jwtPayload({ sub: 'uuid-1', tenantId: 't1' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
