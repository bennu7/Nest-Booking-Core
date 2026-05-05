import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'src/prisma';
import { TenantService } from '../../tenant.service';
import {
  CATEGORY_ID,
  TENANT_ID,
  USER_ID,
  createCategoryDto,
  createTenantDto,
  makeTenant,
  updateCategoryDto,
  updateTenantDto,
} from '../fixtures/tenant.fixture';

function createPrismaMock() {
  return {
    tenant: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    serviceCategory: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('TenantService', () => {
  let service: TenantService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [TenantService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(TenantService);
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('throws BadRequest when slug already exists', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());

      await expect(service.create(createTenantDto())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.tenant.create).not.toHaveBeenCalled();
    });

    it('creates tenant when slug is unique', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      const tenant = makeTenant();
      prisma.tenant.create.mockResolvedValue(tenant);

      const result = await service.create(createTenantDto());

      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Acme Salon',
            slug: 'acme-salon',
          }),
        }),
      );
      expect(result).toEqual(tenant);
    });
  });

  // ─── createCategory ────────────────────────────────────────────────────────

  describe('createCategory', () => {
    it('throws BadRequest when category name already exists', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValue({ id: CATEGORY_ID });

      await expect(
        service.createCategory(TENANT_ID, createCategoryDto()),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.serviceCategory.create).not.toHaveBeenCalled();
    });

    it('creates category when name is unique', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValue(null);
      const category = {
        id: CATEGORY_ID,
        name: 'Hair Care',
        description: 'All hair services',
      };
      prisma.serviceCategory.create.mockResolvedValue(category);

      const result = await service.createCategory(
        TENANT_ID,
        createCategoryDto(),
      );

      expect(prisma.serviceCategory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            name: 'Hair Care',
          }),
        }),
      );
      expect(result).toEqual(category);
    });
  });

  // ─── updateCategory ────────────────────────────────────────────────────────

  describe('updateCategory', () => {
    it('throws BadRequest when new name already exists', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValue({ id: 'other-id' });

      await expect(
        service.updateCategory(CATEGORY_ID, TENANT_ID, updateCategoryDto()),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.serviceCategory.update).not.toHaveBeenCalled();
    });

    it('updates category when name is unique', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValue(null);
      const updated = {
        id: CATEGORY_ID,
        name: 'Hair Care Updated',
        description: 'Updated description',
      };
      prisma.serviceCategory.update.mockResolvedValue(updated);

      const result = await service.updateCategory(
        CATEGORY_ID,
        TENANT_ID,
        updateCategoryDto(),
      );

      expect(prisma.serviceCategory.update).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });
  });

  // ─── findManyPaginated ─────────────────────────────────────────────────────

  describe('findManyPaginated', () => {
    it('calls findMany + count and returns paginated result', async () => {
      const tenants = [
        makeTenant(),
        makeTenant({ id: 'other-id', slug: 'other' }),
      ];
      prisma.tenant.findMany.mockResolvedValue(tenants);
      prisma.tenant.count.mockResolvedValue(2);

      const result = await service.findManyPaginated({ page: 1, limit: 10 });

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
      expect(prisma.tenant.count).toHaveBeenCalled();
      expect(result).toMatchObject({
        items: tenants,
        total: 2,
        page: 1,
        limit: 10,
      });
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException when tenant does not exist', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.findOne(TENANT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns tenant when found', async () => {
      const tenant = makeTenant();
      prisma.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.findOne(TENANT_ID);

      expect(result).toEqual(tenant);
    });
  });

  // ─── findBySlug ────────────────────────────────────────────────────────────

  describe('findBySlug', () => {
    it('throws NotFoundException when slug does not exist', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns tenant when slug found', async () => {
      const tenant = makeTenant();
      prisma.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.findBySlug('acme-salon');

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: 'acme-salon' },
      });
      expect(result).toEqual(tenant);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('propagates NotFoundException from findOne when tenant missing', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, updateTenantDto()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.tenant.update).not.toHaveBeenCalled();
    });

    it('calls update when tenant exists', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      const updated = makeTenant({ name: 'Acme Salon Updated' });
      prisma.tenant.update.mockResolvedValue(updated);

      const result = await service.update(TENANT_ID, updateTenantDto());

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TENANT_ID } }),
      );
      expect(result).toEqual(updated);
    });
  });

  // ─── toggleStatus ──────────────────────────────────────────────────────────

  describe('toggleStatus', () => {
    it('throws NotFoundException when tenant does not exist', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.toggleStatus(TENANT_ID, false, 'Billing issue', USER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.tenant.update).not.toHaveBeenCalled();
    });

    it('sets disabledBy and disabledReason when deactivating', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.tenant.update.mockResolvedValue(makeTenant({ isActive: false }));

      await service.toggleStatus(TENANT_ID, false, 'Billing issue', USER_ID);

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: false,
            disabledReason: 'Billing issue',
            disabledBy: USER_ID,
          }),
        }),
      );
    });

    it('nullifies disabledBy/disabledReason/disabledAt when activating', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        makeTenant({
          isActive: false,
          disabledReason: 'Old reason',
          disabledBy: USER_ID,
        }),
      );
      prisma.tenant.update.mockResolvedValue(makeTenant({ isActive: true }));

      await service.toggleStatus(TENANT_ID, true);

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: true,
            disabledReason: null,
            disabledAt: null,
            disabledBy: null,
          }),
        }),
      );
    });
  });
});
