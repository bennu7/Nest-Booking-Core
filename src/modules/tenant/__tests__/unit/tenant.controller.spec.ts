import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';

import { UserRole } from '@generated/enums';

import { TenantController } from '../../tenant.controller';
import { TenantService } from '../../tenant.service';
import {
  TENANT_ID,
  USER_ID,
  createTenantDto,
  makeTenant,
  toggleStatusDto,
  updateTenantDto,
  POLICY_ID,
  createCancellationPolicyDto,
  updateCancellationPolicyDto,
  makeCancellationPolicy,
} from '../fixtures/tenant.fixture';

describe('TenantController', () => {
  let controller: TenantController;
  let tenantService: {
    create: jest.Mock;
    findManyPaginated: jest.Mock;
    findBySlug: jest.Mock;
    findOne: jest.Mock;
    toggleStatus: jest.Mock;
    update: jest.Mock;
    createCancellationPolicy: jest.Mock;
    findCancellationPolicies: jest.Mock;
    updateCancellationPolicy: jest.Mock;
    deleteCancellationPolicy: jest.Mock;
  };

  const superAdminUser = {
    id: USER_ID,
    email: 'superadmin@test.com',
    role: UserRole.SUPER_ADMIN,
    tenantId: null,
  };

  beforeEach(async () => {
    tenantService = {
      create: jest.fn(),
      findManyPaginated: jest.fn(),
      findBySlug: jest.fn(),
      findOne: jest.fn(),
      toggleStatus: jest.fn(),
      update: jest.fn(),
      createCancellationPolicy: jest.fn(),
      findCancellationPolicies: jest.fn(),
      updateCancellationPolicy: jest.fn(),
      deleteCancellationPolicy: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [{ provide: TenantService, useValue: tenantService }],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(TenantController);
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('returns ApiResponse CREATED with tenant data', async () => {
      const dto = createTenantDto();
      const tenant = makeTenant();
      tenantService.create.mockResolvedValue(tenant);

      const res = await controller.create(dto);

      expect(tenantService.create).toHaveBeenCalledWith(dto);
      expect(res.code).toBe(HttpStatus.CREATED);
      expect(res.message).toBe('Tenant created successfully');
      expect(res.data).toEqual(tenant);
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns ApiResponse OK with paginated result', async () => {
      const paginated = { items: [makeTenant()], total: 1, page: 1, limit: 10 };
      tenantService.findManyPaginated.mockResolvedValue(paginated);

      const res = await controller.findAll({ page: 1, limit: 10 });

      expect(tenantService.findManyPaginated).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
      });
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.message).toBe('Success');
      expect(res.data).toEqual(paginated);
    });
  });

  // ─── findBySlug ────────────────────────────────────────────────────────────

  describe('findBySlug', () => {
    it('returns ApiResponse OK with tenant', async () => {
      const tenant = makeTenant();
      tenantService.findBySlug.mockResolvedValue(tenant);

      const res = await controller.findBySlug('acme-salon');

      expect(tenantService.findBySlug).toHaveBeenCalledWith('acme-salon');
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.data).toEqual(tenant);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns ApiResponse OK with tenant', async () => {
      const tenant = makeTenant();
      tenantService.findOne.mockResolvedValue(tenant);

      const res = await controller.findOne(TENANT_ID);

      expect(tenantService.findOne).toHaveBeenCalledWith(TENANT_ID);
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.data).toEqual(tenant);
    });
  });

  // ─── toggleStatus ──────────────────────────────────────────────────────────

  describe('toggleStatus', () => {
    it('returns "deactivated" message when isActive is false', async () => {
      const dto = toggleStatusDto({ isActive: false, reason: 'Billing issue' });
      const updated = makeTenant({ isActive: false });
      tenantService.toggleStatus.mockResolvedValue(updated);

      const res = await controller.toggleStatus(TENANT_ID, dto, superAdminUser);

      expect(tenantService.toggleStatus).toHaveBeenCalledWith({
        id: TENANT_ID,
        isActive: false,
        reason: 'Billing issue',
        disabledBy: USER_ID,
      });
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.message).toBe('Tenant deactivated successfully');
      expect(res.data).toEqual(updated);
    });

    it('returns "activated" message when isActive is true', async () => {
      const dto = toggleStatusDto({ isActive: true, reason: undefined });
      const updated = makeTenant({ isActive: true });
      tenantService.toggleStatus.mockResolvedValue(updated);

      const res = await controller.toggleStatus(TENANT_ID, dto, superAdminUser);

      expect(res.message).toBe('Tenant activated successfully');
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('returns ApiResponse OK with updated tenant', async () => {
      const dto = updateTenantDto();
      const updated = makeTenant({ name: 'Acme Salon Updated' });
      tenantService.update.mockResolvedValue(updated);

      const res = await controller.update(TENANT_ID, dto);

      expect(tenantService.update).toHaveBeenCalledWith(TENANT_ID, dto);
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.message).toBe('Tenant updated successfully');
      expect(res.data).toEqual(updated);
    });
  });

  // ─── CancellationPolicy ───────────────────────────────────────────────────

  describe('createCancellationPolicy', () => {
    it('returns ApiResponse CREATED with policy data', async () => {
      const dto = createCancellationPolicyDto();
      const policy = makeCancellationPolicy();
      tenantService.createCancellationPolicy.mockResolvedValue(policy);

      const user = { ...superAdminUser, tenantId: TENANT_ID };
      const res = await controller.createCancellationPolicy(dto, user);

      expect(tenantService.createCancellationPolicy).toHaveBeenCalledWith(
        TENANT_ID,
        dto,
      );
      expect(res.code).toBe(HttpStatus.CREATED);
      expect(res.data).toEqual(policy);
    });
  });

  describe('getCancellationPolicies', () => {
    it('returns ApiResponse OK with policies', async () => {
      const policies = [makeCancellationPolicy()];
      tenantService.findCancellationPolicies.mockResolvedValue(policies);

      const user = { ...superAdminUser, tenantId: TENANT_ID };
      const res = await controller.getCancellationPolicies(user);

      expect(tenantService.findCancellationPolicies).toHaveBeenCalledWith(
        TENANT_ID,
      );
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.data).toEqual(policies);
    });
  });

  describe('updateCancellationPolicy', () => {
    it('returns ApiResponse OK with updated policy', async () => {
      const dto = updateCancellationPolicyDto();
      const updated = makeCancellationPolicy({ name: 'Updated' });
      tenantService.updateCancellationPolicy.mockResolvedValue(updated);

      const user = { ...superAdminUser, tenantId: TENANT_ID };
      const res = await controller.updateCancellationPolicy(
        POLICY_ID,
        dto,
        user,
      );

      expect(tenantService.updateCancellationPolicy).toHaveBeenCalledWith(
        POLICY_ID,
        TENANT_ID,
        dto,
      );
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.data).toEqual(updated);
    });
  });

  describe('deleteCancellationPolicy', () => {
    it('returns ApiResponse OK with deleted policy', async () => {
      const policy = makeCancellationPolicy();
      tenantService.deleteCancellationPolicy.mockResolvedValue(policy);

      const user = { ...superAdminUser, tenantId: TENANT_ID };
      const res = await controller.deleteCancellationPolicy(POLICY_ID, user);

      expect(tenantService.deleteCancellationPolicy).toHaveBeenCalledWith(
        POLICY_ID,
        TENANT_ID,
      );
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.data).toEqual(policy);
    });
  });
});
