import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { UserRole } from '@generated/enums';

import { PrismaService } from 'src/prisma';

import { SlotService } from '../../slot.service';
import {
  PROVIDER_PROFILE_ID,
  SERVICE_ID,
  TENANT_A,
  USER_CUSTOMER,
  createSlotHoldDto,
  currentUserPayload,
} from '../fixtures/booking.fixture';

function createPrismaMock() {
  return {
    service: {
      findFirst: jest.fn(),
    },
    slotHold: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
}

describe('SlotService', () => {
  let service: SlotService;
  let prisma: ReturnType<typeof createPrismaMock>;

  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [SlotService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(SlotService);
  });

  describe('createHold', () => {
    it('throws Forbidden when role is not CUSTOMER', async () => {
      await expect(
        service.createHold(
          currentUserPayload({ role: UserRole.ADMIN }),
          createSlotHoldDto(),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.service.findFirst).not.toHaveBeenCalled();
    });

    it('throws BadRequest when CUSTOMER has no tenantId', async () => {
      await expect(
        service.createHold(
          currentUserPayload({ role: UserRole.CUSTOMER, tenantId: null }),
          createSlotHoldDto(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequest when startTime is not before endTime', async () => {
      await expect(
        service.createHold(
          currentUserPayload(),
          createSlotHoldDto({
            startTime: '2030-06-15T12:00:00.000Z',
            endTime: '2030-06-15T11:00:00.000Z',
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequest when startTime is in the past', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2030-01-01T12:00:00.000Z'));

      await expect(
        service.createHold(
          currentUserPayload(),
          createSlotHoldDto({
            startTime: '2020-06-15T10:00:00.000Z',
            endTime: '2020-06-15T11:00:00.000Z',
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      jest.useRealTimers();
    });

    it('throws BadRequest when service is not found for tenant', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2020-01-01T12:00:00.000Z'));
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.createHold(currentUserPayload(), createSlotHoldDto()),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.service.findFirst).toHaveBeenCalled();
      expect(prisma.slotHold.create).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('creates slot hold with expiresAt 15 minutes after now', async () => {
      const fixed = new Date('2030-03-01T12:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(fixed);

      prisma.service.findFirst.mockResolvedValue({ id: SERVICE_ID });
      const created = {
        id: 'hold-1',
        tenantId: TENANT_A,
        expiresAt: new Date(fixed.getTime() + 15 * 60 * 1000),
      };
      prisma.slotHold.create.mockResolvedValue(created);

      const dto = createSlotHoldDto();
      const result = await service.createHold(currentUserPayload(), dto);

      expect(prisma.slotHold.create).toHaveBeenCalledWith({
        data: {
          tenantId: TENANT_A,
          providerId: PROVIDER_PROFILE_ID,
          customerId: USER_CUSTOMER,
          serviceId: SERVICE_ID,
          startTime: new Date(dto.startTime),
          endTime: new Date(dto.endTime),
          expiresAt: new Date(fixed.getTime() + 15 * 60 * 1000),
        },
      });
      expect(result).toEqual(created);

      jest.useRealTimers();
    });
  });

  describe('deleteExpiredHolds', () => {
    it('returns deleted count from deleteMany', async () => {
      prisma.slotHold.deleteMany.mockResolvedValue({ count: 3 });

      const out = await service.deleteExpiredHolds(TENANT_A);

      expect(prisma.slotHold.deleteMany).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_A,
          expiresAt: { lt: expect.any(Date) },
          isConverted: false,
        },
      });
      expect(out).toEqual({ deleted: 3 });
    });
  });
});
