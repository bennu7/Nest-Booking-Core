import { BadRequestException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';

import { UserRole } from '@generated/enums';

import { ProviderController } from '../../provider.controller';
import { ProviderService } from '../../provider.service';
import { ScheduleService } from '../../schedule.service';
import {
  BREAK_ID,
  PROVIDER_ID,
  SERVICE_ID,
  TENANT_ID,
  USER_ID,
  createBreakDto,
  createProviderDto,
  createServiceDto,
  currentUserPayload,
  makeProviderProfile,
  makeService,
  updateProviderDto,
  updateScheduleDto,
  updateServiceDto,
} from '../fixtures/provider.fixture';

describe('ProviderController', () => {
  let controller: ProviderController;
  let providerService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    createService: jest.Mock;
    findServices: jest.Mock;
    updateService: jest.Mock;
    deleteService: jest.Mock;
  };
  let scheduleService: {
    updateSchedule: jest.Mock;
    getSchedule: jest.Mock;
    createBreak: jest.Mock;
    deleteBreak: jest.Mock;
  };

  const adminUser = currentUserPayload();

  beforeEach(async () => {
    providerService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      createService: jest.fn(),
      findServices: jest.fn(),
      updateService: jest.fn(),
      deleteService: jest.fn(),
    };
    scheduleService = {
      updateSchedule: jest.fn(),
      getSchedule: jest.fn(),
      createBreak: jest.fn(),
      deleteBreak: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ProviderController],
      providers: [
        { provide: ProviderService, useValue: providerService },
        { provide: ScheduleService, useValue: scheduleService },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(ProviderController);
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('returns ApiResponse CREATED with provider profile', async () => {
      const dto = createProviderDto();
      const profile = makeProviderProfile();
      providerService.create.mockResolvedValue(profile);

      const res = await controller.create(dto, adminUser);

      expect(providerService.create).toHaveBeenCalledWith(dto, TENANT_ID);
      expect(res.code).toBe(HttpStatus.CREATED);
      expect(res.message).toBe('Provider profile created successfully');
      expect(res.data).toEqual(profile);
    });

    it('throws BadRequestException when SUPER_ADMIN has no tenantId', async () => {
      const superAdmin = currentUserPayload({
        role: UserRole.SUPER_ADMIN,
        tenantId: null,
      });

      await expect(
        controller.create(createProviderDto(), superAdmin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns ApiResponse OK with provider list', async () => {
      const profiles = [makeProviderProfile()];
      providerService.findAll.mockResolvedValue(profiles);

      const res = await controller.findAll(adminUser);

      expect(providerService.findAll).toHaveBeenCalledWith(TENANT_ID);
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.message).toBe('Success');
      expect(res.data).toEqual(profiles);
    });

    it('throws BadRequestException when SUPER_ADMIN has no tenantId', async () => {
      const superAdmin = currentUserPayload({
        role: UserRole.SUPER_ADMIN,
        tenantId: null,
      });

      await expect(controller.findAll(superAdmin)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns ApiResponse OK with provider', async () => {
      const profile = makeProviderProfile();
      providerService.findOne.mockResolvedValue(profile);

      const res = await controller.findOne(PROVIDER_ID, adminUser);

      expect(providerService.findOne).toHaveBeenCalledWith(
        PROVIDER_ID,
        TENANT_ID,
      );
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.data).toEqual(profile);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('returns ApiResponse OK with updated provider', async () => {
      const dto = updateProviderDto();
      const updated = makeProviderProfile({ bio: 'Updated bio' });
      providerService.update.mockResolvedValue(updated);

      const res = await controller.update(PROVIDER_ID, dto, adminUser);

      expect(providerService.update).toHaveBeenCalledWith(
        PROVIDER_ID,
        dto,
        TENANT_ID,
        adminUser,
      );
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.message).toBe('Provider updated successfully');
      expect(res.data).toEqual(updated);
    });
  });

  // ─── createService ─────────────────────────────────────────────────────────

  describe('createService', () => {
    it('returns ApiResponse CREATED with service', async () => {
      const dto = createServiceDto();
      const svc = makeService();
      providerService.createService.mockResolvedValue(svc);

      const res = await controller.createService(PROVIDER_ID, dto, adminUser);

      expect(providerService.createService).toHaveBeenCalledWith(
        PROVIDER_ID,
        TENANT_ID,
        dto,
        adminUser,
      );
      expect(res.code).toBe(HttpStatus.CREATED);
      expect(res.message).toBe('Service created successfully');
      expect(res.data).toEqual(svc);
    });
  });

  // ─── findServices ──────────────────────────────────────────────────────────

  describe('findServices', () => {
    it('returns ApiResponse OK with services', async () => {
      const services = [makeService()];
      providerService.findServices.mockResolvedValue(services);

      const res = await controller.findServices(PROVIDER_ID, adminUser);

      expect(providerService.findServices).toHaveBeenCalledWith(
        PROVIDER_ID,
        TENANT_ID,
      );
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.data).toEqual(services);
    });
  });

  // ─── updateService ─────────────────────────────────────────────────────────

  describe('updateService', () => {
    it('returns ApiResponse OK with updated service', async () => {
      const dto = updateServiceDto();
      const updated = makeService({ name: 'Haircut Premium' });
      providerService.updateService.mockResolvedValue(updated);

      const res = await controller.updateService(
        PROVIDER_ID,
        SERVICE_ID,
        dto,
        adminUser,
      );

      expect(providerService.updateService).toHaveBeenCalledWith(
        SERVICE_ID,
        PROVIDER_ID,
        TENANT_ID,
        dto,
        adminUser,
      );
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.message).toBe('Service updated successfully');
      expect(res.data).toEqual(updated);
    });
  });

  // ─── deleteService ─────────────────────────────────────────────────────────

  describe('deleteService', () => {
    it('returns ApiResponse OK on successful delete', async () => {
      providerService.deleteService.mockResolvedValue(undefined);

      const res = await controller.deleteService(
        PROVIDER_ID,
        SERVICE_ID,
        adminUser,
      );

      expect(providerService.deleteService).toHaveBeenCalledWith(
        SERVICE_ID,
        PROVIDER_ID,
        TENANT_ID,
        adminUser,
      );
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.message).toBe('Service deleted successfully');
    });
  });

  // ─── updateSchedule ────────────────────────────────────────────────────────

  describe('updateSchedule', () => {
    it('returns ApiResponse OK with schedules', async () => {
      const dto = updateScheduleDto();
      const schedules = [{ id: 's1', dayOfWeek: 1 }];
      scheduleService.updateSchedule.mockResolvedValue(schedules);

      const res = await controller.updateSchedule(PROVIDER_ID, dto, adminUser);

      expect(scheduleService.updateSchedule).toHaveBeenCalledWith(
        PROVIDER_ID,
        TENANT_ID,
        dto,
        adminUser,
      );
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.message).toBe('Schedule updated successfully');
      expect(res.data).toEqual(schedules);
    });
  });

  // ─── getSchedule ───────────────────────────────────────────────────────────

  describe('getSchedule', () => {
    it('returns ApiResponse OK with schedules and breaks', async () => {
      const schedule = { schedules: [], breaks: [] };
      scheduleService.getSchedule.mockResolvedValue(schedule);

      const res = await controller.getSchedule(PROVIDER_ID, adminUser);

      expect(scheduleService.getSchedule).toHaveBeenCalledWith(
        PROVIDER_ID,
        TENANT_ID,
      );
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.data).toEqual(schedule);
    });
  });

  // ─── createBreak ───────────────────────────────────────────────────────────

  describe('createBreak', () => {
    it('returns ApiResponse CREATED with break record', async () => {
      const dto = createBreakDto();
      const breakRecord = { id: BREAK_ID, providerId: PROVIDER_ID };
      scheduleService.createBreak.mockResolvedValue(breakRecord);

      const res = await controller.createBreak(PROVIDER_ID, dto, adminUser);

      expect(scheduleService.createBreak).toHaveBeenCalledWith(
        PROVIDER_ID,
        TENANT_ID,
        dto,
        adminUser,
      );
      expect(res.code).toBe(HttpStatus.CREATED);
      expect(res.message).toBe('Break created successfully');
      expect(res.data).toEqual(breakRecord);
    });
  });

  // ─── deleteBreak ───────────────────────────────────────────────────────────

  describe('deleteBreak', () => {
    it('returns ApiResponse OK on successful delete', async () => {
      scheduleService.deleteBreak.mockResolvedValue(undefined);

      const res = await controller.deleteBreak(
        PROVIDER_ID,
        BREAK_ID,
        adminUser,
      );

      expect(scheduleService.deleteBreak).toHaveBeenCalledWith(
        BREAK_ID,
        PROVIDER_ID,
        TENANT_ID,
        adminUser,
      );
      expect(res.code).toBe(HttpStatus.OK);
      expect(res.message).toBe('Break deleted successfully');
    });
  });

  // ─── SUPER_ADMIN without tenantId guard ────────────────────────────────────

  describe('SUPER_ADMIN without tenantId', () => {
    const superAdmin = currentUserPayload({
      id: USER_ID,
      role: UserRole.SUPER_ADMIN,
      tenantId: null,
    });

    it('throws when trying to update schedule', async () => {
      await expect(
        controller.updateSchedule(PROVIDER_ID, updateScheduleDto(), superAdmin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when trying to get schedule', async () => {
      await expect(
        controller.getSchedule(PROVIDER_ID, superAdmin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when trying to create break', async () => {
      await expect(
        controller.createBreak(PROVIDER_ID, createBreakDto(), superAdmin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when trying to delete break', async () => {
      await expect(
        controller.deleteBreak(PROVIDER_ID, BREAK_ID, superAdmin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
