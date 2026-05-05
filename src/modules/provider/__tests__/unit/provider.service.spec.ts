import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'src/prisma';
import { ProviderService } from '../../provider.service';
import {
  CATEGORY_ID,
  PROVIDER_ID,
  SERVICE_ID,
  TENANT_ID,
  USER_ID,
  createProviderDto,
  createServiceDto,
  makeProviderProfile,
  makeService,
  makeUser,
  updateProviderDto,
  updateServiceDto,
} from '../fixtures/provider.fixture';

function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
    },
    providerProfile: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    service: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    serviceCategory: {
      findUnique: jest.fn(),
    },
    booking: {
      count: jest.fn(),
    },
  };
}

describe('ProviderService', () => {
  let service: ProviderService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(ProviderService);
  });

  // ─── create (Provider Profile) ─────────────────────────────────────────────

  describe('create', () => {
    it('throws NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create(createProviderDto(), TENANT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.providerProfile.create).not.toHaveBeenCalled();
    });

    it('throws BadRequest when user belongs to a different tenant', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ tenantId: 'different-tenant-id' }),
      );

      await expect(
        service.create(createProviderDto(), TENANT_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequest when provider profile already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );

      await expect(
        service.create(createProviderDto(), TENANT_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates provider profile when all validations pass', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      prisma.providerProfile.findUnique.mockResolvedValue(null);
      const profile = makeProviderProfile();
      prisma.providerProfile.create.mockResolvedValue(profile);

      const result = await service.create(createProviderDto(), TENANT_ID);

      expect(prisma.providerProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            tenantId: TENANT_ID,
          }),
        }),
      );
      expect(result).toEqual(profile);
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns providers with user included', async () => {
      const providers = [makeProviderProfile()];
      prisma.providerProfile.findMany.mockResolvedValue(providers);

      const result = await service.findAll(TENANT_ID);

      expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID },
          include: expect.objectContaining({ user: expect.any(Object) }),
        }),
      );
      expect(result).toEqual(providers);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException when provider not found', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne(PROVIDER_ID, TENANT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns provider with user and services included', async () => {
      const profile = makeProviderProfile();
      prisma.providerProfile.findUnique.mockResolvedValue(profile);

      const result = await service.findOne(PROVIDER_ID, TENANT_ID);

      expect(prisma.providerProfile.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PROVIDER_ID, tenantId: TENANT_ID },
          include: expect.objectContaining({
            user: expect.any(Object),
            services: expect.any(Object),
          }),
        }),
      );
      expect(result).toEqual(profile);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws NotFoundException when provider not found', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.update(PROVIDER_ID, updateProviderDto(), TENANT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.providerProfile.update).not.toHaveBeenCalled();
    });

    it('calls update when provider exists', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );
      const updated = makeProviderProfile({ bio: 'Updated bio' });
      prisma.providerProfile.update.mockResolvedValue(updated);

      const result = await service.update(
        PROVIDER_ID,
        updateProviderDto(),
        TENANT_ID,
      );

      expect(prisma.providerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PROVIDER_ID, tenantId: TENANT_ID },
        }),
      );
      expect(result).toEqual(updated);
    });
  });

  // ─── createService ─────────────────────────────────────────────────────────

  describe('createService', () => {
    it('throws NotFoundException when provider not found', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.createService(PROVIDER_ID, TENANT_ID, createServiceDto()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.service.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when category not found', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );
      prisma.serviceCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.createService(
          PROVIDER_ID,
          TENANT_ID,
          createServiceDto({ categoryId: CATEGORY_ID }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates service without category', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );
      const svc = makeService();
      prisma.service.create.mockResolvedValue(svc);

      const result = await service.createService(
        PROVIDER_ID,
        TENANT_ID,
        createServiceDto(),
      );

      expect(prisma.service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            providerId: PROVIDER_ID,
            name: 'Haircut',
          }),
        }),
      );
      expect(result).toEqual(svc);
    });

    it('creates service with valid category', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );
      prisma.serviceCategory.findUnique.mockResolvedValue({ id: CATEGORY_ID });
      prisma.service.create.mockResolvedValue(
        makeService({ categoryId: CATEGORY_ID }),
      );

      await service.createService(
        PROVIDER_ID,
        TENANT_ID,
        createServiceDto({ categoryId: CATEGORY_ID }),
      );

      expect(prisma.serviceCategory.findUnique).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID, tenantId: TENANT_ID },
      });
    });
  });

  // ─── findServices ──────────────────────────────────────────────────────────

  describe('findServices', () => {
    it('throws NotFoundException when provider not found', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.findServices(PROVIDER_ID, TENANT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns services with category included', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );
      const services = [makeService()];
      prisma.service.findMany.mockResolvedValue(services);

      const result = await service.findServices(PROVIDER_ID, TENANT_ID);

      expect(prisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { providerId: PROVIDER_ID },
          include: expect.objectContaining({ category: expect.any(Object) }),
        }),
      );
      expect(result).toEqual(services);
    });
  });

  // ─── updateService ─────────────────────────────────────────────────────────

  describe('updateService', () => {
    it('throws NotFoundException when service not found', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.updateService(
          SERVICE_ID,
          PROVIDER_ID,
          TENANT_ID,
          updateServiceDto(),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.service.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when provider not found', async () => {
      prisma.service.findFirst.mockResolvedValue(makeService());
      prisma.providerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.updateService(
          SERVICE_ID,
          PROVIDER_ID,
          TENANT_ID,
          updateServiceDto(),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when category not found', async () => {
      prisma.service.findFirst.mockResolvedValue(makeService());
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );
      prisma.serviceCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.updateService(
          SERVICE_ID,
          PROVIDER_ID,
          TENANT_ID,
          updateServiceDto({ categoryId: CATEGORY_ID }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates service when all validations pass', async () => {
      prisma.service.findFirst.mockResolvedValue(makeService());
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );
      const updated = makeService({ name: 'Haircut Premium' });
      prisma.service.update.mockResolvedValue(updated);

      const result = await service.updateService(
        SERVICE_ID,
        PROVIDER_ID,
        TENANT_ID,
        updateServiceDto(),
      );

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SERVICE_ID } }),
      );
      expect(result).toEqual(updated);
    });
  });

  // ─── deleteService ─────────────────────────────────────────────────────────

  describe('deleteService', () => {
    it('throws NotFoundException when service not found', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteService(SERVICE_ID, PROVIDER_ID, TENANT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when provider not found', async () => {
      prisma.service.findFirst.mockResolvedValue(makeService());
      prisma.providerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteService(SERVICE_ID, PROVIDER_ID, TENANT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequest when service has active bookings', async () => {
      prisma.service.findFirst.mockResolvedValue(makeService());
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );
      prisma.booking.count.mockResolvedValue(2);

      await expect(
        service.deleteService(SERVICE_ID, PROVIDER_ID, TENANT_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.service.delete).not.toHaveBeenCalled();
    });

    it('deletes service when no active bookings', async () => {
      prisma.service.findFirst.mockResolvedValue(makeService());
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );
      prisma.booking.count.mockResolvedValue(0);
      prisma.service.delete.mockResolvedValue(makeService());

      const result = await service.deleteService(
        SERVICE_ID,
        PROVIDER_ID,
        TENANT_ID,
      );

      expect(prisma.service.delete).toHaveBeenCalledWith({
        where: { id: SERVICE_ID },
      });
      expect(result).toBeDefined();
    });
  });
});
