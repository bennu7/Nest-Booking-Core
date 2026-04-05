import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AuthController } from '../../auth.controller';
import { AuthService } from '../../auth.service';
import {
  createTenantDto,
  loginDto,
  registerDto,
} from '../fixtures/user.fixture';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    setupTenant: jest.Mock;
    refreshToken: jest.Mock;
    logout: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      setupTenant: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(AuthController);
  });

  describe('register', () => {
    it('returns ApiResponse CREATED with service result', async () => {
      const dto = registerDto();
      const user = { id: '1', email: dto.email, fullName: dto.fullName };
      authService.register.mockResolvedValue(user);

      const res = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(res.code).toBe(HttpStatus.CREATED);
      expect(res.message).toBe('Success');
      expect(res.data).toEqual(user);
    });
  });

  describe('login', () => {
    it('passes ip and user-agent metadata to service', async () => {
      const dto = loginDto();
      const tokens = { accessToken: 'a', refreshToken: 'r' };
      authService.login.mockResolvedValue(tokens);

      const res = await controller.login(dto, '10.0.0.1', 'test-agent');

      expect(authService.login).toHaveBeenCalledWith(dto, {
        ipAddress: '10.0.0.1',
        userAgent: 'test-agent',
      });
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.data).toEqual(tokens);
    });
  });

  describe('setupTenant', () => {
    it('delegates with current user id', async () => {
      const dto = createTenantDto();
      const payload = { id: 'user-1', email: 'a@b.com', role: 'CUSTOMER' };
      const out = { tenant: { id: 't1' }, user: payload };
      authService.setupTenant.mockResolvedValue(out);

      const res = await controller.setupTenant(dto, payload);

      expect(authService.setupTenant).toHaveBeenCalledWith('user-1', dto);
      expect(res.code).toBe(HttpStatus.CREATED);
      expect(res.message).toBe('Tenant setup completed');
      expect(res.data).toEqual(out);
    });
  });

  describe('refreshToken', () => {
    it('reads refresh token from body field', async () => {
      const tokens = { accessToken: 'a', refreshToken: 'r' };
      authService.refreshToken.mockResolvedValue(tokens);

      const res = await controller.refreshToken('raw-refresh');

      expect(authService.refreshToken).toHaveBeenCalledWith('raw-refresh');
      expect(res.data).toEqual(tokens);
    });
  });

  describe('logout', () => {
    it('delegates to service', async () => {
      authService.logout.mockResolvedValue(undefined);

      const res = await controller.logout({ refreshToken: 'rt' });

      expect(authService.logout).toHaveBeenCalledWith('rt');
      expect(res.code).toBe(HttpStatus.OK);
    });
  });
});
