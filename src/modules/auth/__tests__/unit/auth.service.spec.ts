import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { AuthProvider, UserRole } from '@generated/enums';

import { PrismaService } from 'src/prisma';
import { AuthService } from '../../auth.service';
import {
  createTenantDto,
  loginDto,
  registerDto,
} from '../fixtures/user.fixture';

function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let jwtService: { signAsync: jest.Mock; decode: jest.Mock };
  let configGet: jest.Mock;

  const configMap: Record<string, string | number> = {
    JWT_SECRET: 'access-secret',
    JWT_EXPIRES_IN: '15m',
    JWT_SECRET_REFRESH: 'refresh-secret',
    JWT_SECRET_REFRESH_EXPIRES_IN: 7,
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    jwtService = {
      signAsync: jest.fn(),
      decode: jest.fn().mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
      }),
    };
    configGet = jest.fn((key: string) => configMap[key]);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('throws when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ email: 'taken@test.com' });

      await expect(service.register(registerDto())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('creates user and omits passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const created = {
        id: 'u1',
        email: registerDto().email,
        passwordHash: 'hashed',
        fullName: 'Test User',
        phone: null,
        role: UserRole.CUSTOMER,
      };
      prisma.user.create.mockResolvedValue(created);

      const result = await service.register(registerDto());

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toMatchObject({
        id: 'u1',
        email: registerDto().email,
        fullName: 'Test User',
        role: UserRole.CUSTOMER,
      });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: registerDto().email,
            fullName: 'Test User',
          }),
        }),
      );
    });
  });

  describe('login', () => {
    it('throws when user not found (global user)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login(loginDto(), { ipAddress: '1.1.1.1', userAgent: 'jest' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when password invalid', async () => {
      const hash = await bcrypt.hash('other-password', 4);
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: loginDto().email,
        passwordHash: hash,
        role: UserRole.CUSTOMER,
        authProvider: AuthProvider.LOCAL,
      });

      await expect(
        service.login(loginDto(), { ipAddress: '1.1.1.1', userAgent: 'jest' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects password login when auth provider is not LOCAL', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: loginDto().email,
        passwordHash: 'x',
        role: UserRole.CUSTOMER,
        isActive: true,
        tenantId: null,
        authProvider: AuthProvider.GOOGLE,
      });

      await expect(
        service.login(loginDto(), { ipAddress: '1.1.1.1', userAgent: 'jest' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns tokens and stores refresh hash for global user', async () => {
      const dto = loginDto();
      const hash = await bcrypt.hash(dto.password, 4);
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: dto.email,
        passwordHash: hash,
        role: UserRole.CUSTOMER,
        isActive: true,
        tenantId: null,
        authProvider: AuthProvider.LOCAL,
      });
      jwtService.signAsync
        .mockResolvedValueOnce('access.jwt')
        .mockResolvedValueOnce('refresh.jwt');
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt1' });

      const result = await service.login(dto, {
        ipAddress: '1.1.1.1',
        userAgent: 'jest',
      });

      expect(result).toEqual({
        accessToken: 'access.jwt',
        refreshToken: 'refresh.jwt',
      });
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('loads user by tenant when tenantId set', async () => {
      const dto = loginDto({ tenantId: 'tenant-1' });
      const hash = await bcrypt.hash(dto.password, 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: dto.email,
        passwordHash: hash,
        role: UserRole.ADMIN,
        isActive: true,
        tenantId: 'tenant-1',
        authProvider: AuthProvider.LOCAL,
      });
      prisma.tenant.findUnique.mockResolvedValue({
        isActive: true,
        disabledReason: null,
      });
      jwtService.signAsync
        .mockResolvedValueOnce('a')
        .mockResolvedValueOnce('r');
      prisma.refreshToken.create.mockResolvedValue({});

      await service.login(dto, {});

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: {
          tenantId_email: { tenantId: 'tenant-1', email: dto.email },
        },
      });
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('throws when user is deactivated', async () => {
      const dto = loginDto();
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: dto.email,
        passwordHash: 'hash',
        role: UserRole.CUSTOMER,
        isActive: false,
        disabledReason: 'Violation of terms',
        tenantId: null,
        authProvider: AuthProvider.LOCAL,
      });

      await expect(
        service.login(dto, { ipAddress: '1.1.1.1', userAgent: 'jest' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when tenant is deactivated', async () => {
      const dto = loginDto({ tenantId: 'tenant-1' });
      const hash = await bcrypt.hash(dto.password, 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: dto.email,
        passwordHash: hash,
        role: UserRole.ADMIN,
        isActive: true,
        tenantId: 'tenant-1',
        authProvider: AuthProvider.LOCAL,
      });
      prisma.tenant.findUnique.mockResolvedValue({
        isActive: false,
        disabledReason: 'Billing issue',
      });

      await expect(
        service.login(dto, { ipAddress: '1.1.1.1', userAgent: 'jest' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('setupTenant', () => {
    const userId = 'user-1';

    it('throws when user missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.setupTenant(userId, createTenantDto()),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when user already has tenant', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'a@b.com',
        tenantId: 'existing',
        role: UserRole.CUSTOMER,
      });

      await expect(
        service.setupTenant(userId, createTenantDto()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when slug taken', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'a@b.com',
        tenantId: null,
        role: UserRole.CUSTOMER,
      });
      prisma.tenant.findUnique.mockResolvedValue({ id: 't-other' });

      await expect(
        service.setupTenant(userId, createTenantDto()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates tenant and promotes user to ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'a@b.com',
        tenantId: null,
        role: UserRole.CUSTOMER,
      });
      prisma.tenant.findUnique.mockResolvedValue(null);
      const tenant = {
        id: 'new-tenant',
        name: 'Acme',
        slug: 'acme-co',
        email: 'tenant@acme.com',
        phone: null,
        address: null,
        timezone: 'Asia/Jakarta',
      };
      prisma.tenant.create.mockResolvedValue(tenant);
      prisma.user.update.mockResolvedValue({});

      const result = await service.setupTenant(userId, createTenantDto());

      expect(result.tenant).toEqual(tenant);
      expect(result.user).toMatchObject({
        id: userId,
        tenantId: 'new-tenant',
        role: 'ADMIN',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { tenantId: 'new-tenant', role: 'ADMIN' },
      });
    });
  });

  describe('refreshToken', () => {
    it('throws when token row missing', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken('any')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws when expired', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        userId: 'u1',
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(service.refreshToken('any')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws when user missing', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        userId: 'u1',
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken('any')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rotates refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        userId: 'u1',
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        role: UserRole.CUSTOMER,
        tenantId: null,
      });
      jwtService.signAsync
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh');
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshToken('opaque-refresh');

      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('toggleUserStatus', () => {
    it('forbids ADMIN changing user in another tenant', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target',
        tenantId: 't-other',
        email: 'x@y.com',
        isActive: true,
      });

      await expect(
        service.toggleUserStatus(
          'target',
          { isActive: false },
          {
            id: 'actor',
            role: UserRole.ADMIN,
            tenantId: 't-self',
          },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows ADMIN for user in same tenant', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target',
        tenantId: 't1',
        email: 'x@y.com',
        isActive: true,
      });
      prisma.user.update.mockResolvedValue({});

      await service.toggleUserStatus(
        'target',
        { isActive: false, reason: 'test' },
        {
          id: 'actor',
          role: UserRole.ADMIN,
          tenantId: 't1',
        },
      );

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'target' },
          data: expect.objectContaining({ disabledBy: 'actor' }),
        }),
      );
    });

    it('allows SUPER_ADMIN across tenants', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target',
        tenantId: 't-far',
        email: 'x@y.com',
        isActive: true,
      });
      prisma.user.update.mockResolvedValue({});

      await service.toggleUserStatus(
        'target',
        { isActive: true },
        {
          id: 'sa',
          role: UserRole.SUPER_ADMIN,
          tenantId: null,
        },
      );

      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('throws when token unknown', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.logout('x')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('deletes refresh token row', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({ userId: 'u1' });
      prisma.refreshToken.delete.mockResolvedValue({});

      await service.logout('opaque');

      expect(prisma.refreshToken.delete).toHaveBeenCalled();
    });
  });
});
