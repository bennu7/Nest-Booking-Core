import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ProviderService } from './provider.service';
import { ScheduleService } from './schedule.service';
import {
  CreateProviderDto,
  UpdateProviderDto,
  CreateServiceDto,
  UpdateServiceDto,
  UpdateScheduleDto,
  CreateBreakDto,
} from './dto';
import { ApiResponse } from 'src/common/dto/api-response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@generated/enums';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';

@Controller({ path: 'providers', version: '1' })
@UseGuards(ThrottlerGuard)
export class ProviderController {
  constructor(
    private readonly providerService: ProviderService,
    private readonly scheduleService: ScheduleService,
  ) {}

  // ==================== PROVIDER PROFILE ====================

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post()
  async create(
    @Body() dto: CreateProviderDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const tenantId = user.tenantId;

    if (!tenantId) {
      throw new Error(
        'SUPER_ADMIN cannot create providers directly. Use a tenant context.',
      );
    }

    const result = await this.providerService.create(dto, tenantId);

    return new ApiResponse({
      code: HttpStatus.CREATED,
      message: 'Provider profile created successfully',
      data: result,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get()
  async findAll(@CurrentUser() user: CurrentUserPayload) {
    const tenantId = user.tenantId;

    if (!tenantId) {
      throw new Error(
        'SUPER_ADMIN cannot list providers without tenant context',
      );
    }

    const result = await this.providerService.findAll(tenantId);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: result,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CUSTOMER)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const tenantId = user.tenantId;

    if (!tenantId) {
      throw new Error(
        'SUPER_ADMIN cannot view providers without tenant context',
      );
    }

    const result = await this.providerService.findOne(id, tenantId);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: result,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProviderDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const tenantId = user.tenantId;

    if (!tenantId) {
      throw new Error(
        'SUPER_ADMIN cannot update providers without tenant context',
      );
    }

    const result = await this.providerService.update(id, dto, tenantId);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Provider updated successfully',
      data: result,
    });
  }

  // ==================== SERVICE CRUD ====================

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post(':id/services')
  async createService(
    @Param('id') providerId: string,
    @Body() dto: CreateServiceDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const tenantId = user.tenantId;

    if (!tenantId) {
      throw new Error(
        'SUPER_ADMIN cannot create services without tenant context',
      );
    }

    const result = await this.providerService.createService(
      providerId,
      tenantId,
      dto,
    );

    return new ApiResponse({
      code: HttpStatus.CREATED,
      message: 'Service created successfully',
      data: result,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CUSTOMER)
  @Get(':id/services')
  async findServices(
    @Param('id') providerId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const tenantId = user.tenantId;

    if (!tenantId) {
      throw new Error(
        'SUPER_ADMIN cannot list services without tenant context',
      );
    }

    const result = await this.providerService.findServices(
      providerId,
      tenantId,
    );

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: result,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':providerId/services/:serviceId')
  async updateService(
    @Param('providerId') providerId: string,
    @Param('serviceId') serviceId: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const tenantId = user.tenantId;

    if (!tenantId) {
      throw new Error(
        'SUPER_ADMIN cannot update services without tenant context',
      );
    }

    const result = await this.providerService.updateService(
      serviceId,
      providerId,
      tenantId,
      dto,
    );

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Service updated successfully',
      data: result,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Delete(':providerId/services/:serviceId')
  async deleteService(
    @Param('providerId') providerId: string,
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const tenantId = user.tenantId;

    if (!tenantId) {
      throw new Error(
        'SUPER_ADMIN cannot delete services without tenant context',
      );
    }

    await this.providerService.deleteService(serviceId, providerId, tenantId);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Service deleted successfully',
    });
  }

  // ==================== SCHEDULE ====================

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id/schedule')
  async updateSchedule(
    @Param('id') providerId: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const tenantId = user.tenantId;

    if (!tenantId) {
      throw new Error(
        'SUPER_ADMIN cannot update schedules without tenant context',
      );
    }

    const result = await this.scheduleService.updateSchedule(
      providerId,
      tenantId,
      dto,
    );

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Schedule updated successfully',
      data: result,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CUSTOMER)
  @Get(':id/schedule')
  async getSchedule(
    @Param('id') providerId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const tenantId = user.tenantId;

    if (!tenantId) {
      throw new Error(
        'SUPER_ADMIN cannot view schedules without tenant context',
      );
    }

    const result = await this.scheduleService.getSchedule(providerId, tenantId);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: result,
    });
  }

  // ==================== BREAK ====================

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post(':id/breaks')
  async createBreak(
    @Param('id') providerId: string,
    @Body() dto: CreateBreakDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const tenantId = user.tenantId;

    if (!tenantId) {
      throw new Error(
        'SUPER_ADMIN cannot create breaks without tenant context',
      );
    }

    const result = await this.scheduleService.createBreak(
      providerId,
      tenantId,
      dto,
    );

    return new ApiResponse({
      code: HttpStatus.CREATED,
      message: 'Break created successfully',
      data: result,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Delete(':providerId/breaks/:breakId')
  async deleteBreak(
    @Param('providerId') providerId: string,
    @Param('breakId') breakId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const tenantId = user.tenantId;

    if (!tenantId) {
      throw new Error(
        'SUPER_ADMIN cannot delete breaks without tenant context',
      );
    }

    await this.scheduleService.deleteBreak(breakId, providerId, tenantId);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Break deleted successfully',
    });
  }
}
