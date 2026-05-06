import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from 'src/prisma';
import { ScheduleService } from '../../schedule.service';
import {
  BREAK_ID,
  OTHER_USER_ID,
  PROVIDER_ID,
  SCHEDULE_ID,
  TENANT_ID,
  USER_ID,
  createBreakDto,
  currentUserPayload,
  makeProviderProfile,
  makeTenantContext,
  providerUserPayload,
  updateScheduleDto,
} from '../fixtures/provider.fixture';

function createPrismaMock() {
  return {
    providerProfile: {
      findUnique: jest.fn(),
    },
    providerSchedule: {
      deleteMany: jest.fn(),
      createManyAndReturn: jest.fn(),
      findMany: jest.fn(),
    },
    providerBreak: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

describe('ScheduleService', () => {
  let service: ScheduleService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    // Simulate $transaction by invoking callback immediately
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(ScheduleService);
  });

  // ─── updateSchedule ────────────────────────────────────────────────────────

  describe('updateSchedule', () => {
    it('throws NotFoundException when provider not found', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSchedule(
          PROVIDER_ID,
          updateScheduleDto(),
          makeTenantContext(),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequest on duplicate dayOfWeek', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );

      await expect(
        service.updateSchedule(
          PROVIDER_ID,
          updateScheduleDto({
            days: [
              {
                dayOfWeek: 1,
                startTime: '1970-01-01T08:00:00.000Z',
                endTime: '1970-01-01T17:00:00.000Z',
              },
              {
                dayOfWeek: 1,
                startTime: '1970-01-01T09:00:00.000Z',
                endTime: '1970-01-01T18:00:00.000Z',
              },
            ],
          }),
          makeTenantContext(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequest when dayOfWeek is out of range', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );

      await expect(
        service.updateSchedule(
          PROVIDER_ID,
          updateScheduleDto({
            days: [
              {
                dayOfWeek: 7,
                startTime: '1970-01-01T08:00:00.000Z',
                endTime: '1970-01-01T17:00:00.000Z',
              },
            ],
          }),
          makeTenantContext(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequest when endTime is not after startTime', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );

      await expect(
        service.updateSchedule(
          PROVIDER_ID,
          updateScheduleDto({
            days: [
              {
                dayOfWeek: 1,
                startTime: '1970-01-01T17:00:00.000Z',
                endTime: '1970-01-01T08:00:00.000Z',
              },
            ],
          }),
          makeTenantContext(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('runs deleteMany then createManyAndReturn inside transaction', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );
      prisma.providerSchedule.deleteMany.mockResolvedValue({ count: 0 });
      const schedules = [
        { id: SCHEDULE_ID, providerId: PROVIDER_ID, dayOfWeek: 1 },
      ];
      prisma.providerSchedule.createManyAndReturn.mockResolvedValue(schedules);

      const result = await service.updateSchedule(
        PROVIDER_ID,
        updateScheduleDto(),
        makeTenantContext(),
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.providerSchedule.deleteMany).toHaveBeenCalledWith({
        where: { providerId: PROVIDER_ID },
      });
      expect(prisma.providerSchedule.createManyAndReturn).toHaveBeenCalled();
      expect(result).toEqual(schedules);
    });

    it('should allow PROVIDER to update their own schedule', async () => {
      const providerUser = providerUserPayload({ id: USER_ID });
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile({ userId: USER_ID }),
      );
      prisma.providerSchedule.deleteMany.mockResolvedValue({ count: 0 });
      prisma.providerSchedule.createManyAndReturn.mockResolvedValue([]);

      await service.updateSchedule(
        PROVIDER_ID,
        updateScheduleDto(),
        makeTenantContext({ currentUser: providerUser }),
      );
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when PROVIDER tries to update another schedule', async () => {
      const providerUser = providerUserPayload({ id: OTHER_USER_ID });
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile({ userId: USER_ID }),
      );

      await expect(
        service.updateSchedule(
          PROVIDER_ID,
          updateScheduleDto(),
          makeTenantContext({ currentUser: providerUser }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ─── getSchedule ───────────────────────────────────────────────────────────

  describe('getSchedule', () => {
    it('throws NotFoundException when provider not found', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.getSchedule(PROVIDER_ID, TENANT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns { schedules, breaks } when provider exists', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );
      const schedules = [{ id: SCHEDULE_ID }];
      const breaks = [{ id: BREAK_ID }];
      prisma.providerSchedule.findMany.mockResolvedValue(schedules);
      prisma.providerBreak.findMany.mockResolvedValue(breaks);

      const result = await service.getSchedule(PROVIDER_ID, TENANT_ID);

      expect(result).toEqual({ schedules, breaks });
    });
  });

  // ─── createBreak ───────────────────────────────────────────────────────────

  describe('createBreak', () => {
    it('throws NotFoundException when provider not found', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.createBreak(PROVIDER_ID, createBreakDto(), makeTenantContext()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequest for recurring break without dayOfWeek', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );

      await expect(
        service.createBreak(
          PROVIDER_ID,
          createBreakDto({ isRecurring: true, dayOfWeek: undefined }),
          makeTenantContext(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequest for recurring break without breakStart/breakEnd', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );

      await expect(
        service.createBreak(
          PROVIDER_ID,
          createBreakDto({
            isRecurring: true,
            breakStart: undefined,
            breakEnd: undefined,
          }),
          makeTenantContext(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequest when recurring breakEnd is not after breakStart', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );

      await expect(
        service.createBreak(
          PROVIDER_ID,
          createBreakDto({
            isRecurring: true,
            dayOfWeek: 1,
            breakStart: '1970-01-01T13:00:00.000Z',
            breakEnd: '1970-01-01T12:00:00.000Z',
          }),
          makeTenantContext(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates recurring break successfully', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );
      const breakRecord = {
        id: BREAK_ID,
        providerId: PROVIDER_ID,
        isRecurring: true,
        dayOfWeek: 1,
      };
      prisma.providerBreak.create.mockResolvedValue(breakRecord);

      const result = await service.createBreak(
        PROVIDER_ID,
        createBreakDto(),
        makeTenantContext(),
      );

      expect(prisma.providerBreak.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            providerId: PROVIDER_ID,
            isRecurring: true,
            dayOfWeek: 1,
          }),
        }),
      );
      expect(result).toEqual(breakRecord);
    });

    it('throws BadRequest for one-time break without dateStart/dateEnd', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );

      await expect(
        service.createBreak(
          PROVIDER_ID,
          createBreakDto({
            isRecurring: false,
            dateStart: undefined,
            dateEnd: undefined,
          }),
          makeTenantContext(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequest when one-time dateEnd is before dateStart', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );

      await expect(
        service.createBreak(
          PROVIDER_ID,
          createBreakDto({
            isRecurring: false,
            dateStart: '2024-06-10',
            dateEnd: '2024-06-05',
          }),
          makeTenantContext(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates one-time break successfully', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );
      const breakRecord = {
        id: BREAK_ID,
        providerId: PROVIDER_ID,
        isRecurring: false,
        dateStart: new Date('2024-06-10'),
        dateEnd: new Date('2024-06-15'),
      };
      prisma.providerBreak.create.mockResolvedValue(breakRecord);

      const result = await service.createBreak(
        PROVIDER_ID,
        createBreakDto({
          isRecurring: false,
          dateStart: '2024-06-10',
          dateEnd: '2024-06-15',
        }),
        makeTenantContext(),
      );

      expect(prisma.providerBreak.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isRecurring: false,
          }),
        }),
      );
      expect(result).toEqual(breakRecord);
    });
  });

  // ─── deleteBreak ───────────────────────────────────────────────────────────

  describe('deleteBreak', () => {
    it('throws NotFoundException when provider not found', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteBreak(BREAK_ID, PROVIDER_ID, makeTenantContext()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when break not found', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );
      prisma.providerBreak.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteBreak(BREAK_ID, PROVIDER_ID, makeTenantContext()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.providerBreak.delete).not.toHaveBeenCalled();
    });

    it('deletes break when found', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue(
        makeProviderProfile(),
      );
      const breakRecord = { id: BREAK_ID, providerId: PROVIDER_ID };
      prisma.providerBreak.findFirst.mockResolvedValue(breakRecord);
      prisma.providerBreak.delete.mockResolvedValue(breakRecord);

      const result = await service.deleteBreak(
        BREAK_ID,
        PROVIDER_ID,
        makeTenantContext(),
      );

      expect(prisma.providerBreak.delete).toHaveBeenCalledWith({
        where: { id: BREAK_ID },
      });
      expect(result).toEqual(breakRecord);
    });
  });
});
