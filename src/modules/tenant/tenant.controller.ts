import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ToggleStatusDto } from './dto/toggle-status.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateCancellationPolicyDto } from './dto/create-cancellation-policy.dto';
import { UpdateCancellationPolicyDto } from './dto/update-cancellation-policy.dto';
import { ApiResponse } from 'src/common/dto/api-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@generated/enums';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';

@Controller({ path: 'tenants', version: '1' })
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  // ==================== CATEGORIES ====================

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('categories')
  async createCategory(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('User does not belong to any tenant');
    }
    const result = await this.tenantService.createCategory(user.tenantId, dto);

    return new ApiResponse({
      code: HttpStatus.CREATED,
      message: 'Category created successfully',
      data: result,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('categories')
  async getCategories(@CurrentUser() user: CurrentUserPayload) {
    if (!user.tenantId) {
      throw new BadRequestException('User does not belong to any tenant');
    }
    const result = await this.tenantService.findCategories(user.tenantId);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: result,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('User does not belong to any tenant');
    }
    const result = await this.tenantService.updateCategory(
      id,
      user.tenantId,
      dto,
    );

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Category updated successfully',
      data: result,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Delete('categories/:id')
  async deleteCategory(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('User does not belong to any tenant');
    }
    const result = await this.tenantService.deleteCategory(id, user.tenantId);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Category deleted successfully',
      data: result,
    });
  }

  // ==================== CANCELLATION POLICIES ====================

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('cancellation-policies')
  async createCancellationPolicy(
    @Body() dto: CreateCancellationPolicyDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('User does not belong to any tenant');
    }
    const result = await this.tenantService.createCancellationPolicy(
      user.tenantId,
      dto,
    );

    return new ApiResponse({
      code: HttpStatus.CREATED,
      message: 'Cancellation policy created successfully',
      data: result,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('cancellation-policies')
  async getCancellationPolicies(@CurrentUser() user: CurrentUserPayload) {
    if (!user.tenantId) {
      throw new BadRequestException('User does not belong to any tenant');
    }
    const result = await this.tenantService.findCancellationPolicies(
      user.tenantId,
    );

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: result,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch('cancellation-policies/:id')
  async updateCancellationPolicy(
    @Param('id') id: string,
    @Body() dto: UpdateCancellationPolicyDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('User does not belong to any tenant');
    }
    const result = await this.tenantService.updateCancellationPolicy(
      id,
      user.tenantId,
      dto,
    );

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Cancellation policy updated successfully',
      data: result,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Delete('cancellation-policies/:id')
  async deleteCancellationPolicy(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('User does not belong to any tenant');
    }
    const result = await this.tenantService.deleteCancellationPolicy(
      id,
      user.tenantId,
    );

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Cancellation policy deleted successfully',
      data: result,
    });
  }

  // ==================== TENANTS ====================

  @Roles(UserRole.SUPER_ADMIN)
  @Post()
  async create(@Body() dto: CreateTenantDto) {
    const result = await this.tenantService.create(dto);

    return new ApiResponse({
      code: HttpStatus.CREATED,
      message: 'Tenant created successfully',
      data: result,
    });
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  async findAll(@Query() query: PaginationQueryDto) {
    const result = await this.tenantService.findManyPaginated(query);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: result,
    });
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    const result = await this.tenantService.findBySlug(slug);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: result,
    });
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.tenantService.findOne(id);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: result,
    });
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id/status')
  async toggleStatus(
    @Param('id') id: string,
    @Body() dto: ToggleStatusDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const result = await this.tenantService.toggleStatus({
      id,
      isActive: dto.isActive,
      reason: dto.reason,
      disabledBy: user.id,
    });

    return new ApiResponse({
      code: HttpStatus.OK,
      message: dto.isActive
        ? 'Tenant activated successfully'
        : 'Tenant deactivated successfully',
      data: result,
    });
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    const result = await this.tenantService.update(id, dto);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Tenant updated successfully',
      data: result,
    });
  }
}
