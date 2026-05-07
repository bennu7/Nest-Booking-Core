import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import {
  getPaginationParams,
  PaginationQueryDto,
} from 'src/common/dto/pagination.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateCancellationPolicyDto } from './dto/create-cancellation-policy.dto';
import { UpdateCancellationPolicyDto } from './dto/update-cancellation-policy.dto';

export interface ToggleTenantStatusParams {
  id: string;
  isActive: boolean;
  reason?: string;
  disabledBy?: string;
}

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTenantDto) {
    const existingSlug = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });

    if (existingSlug) {
      throw new BadRequestException('Tenant slug already exists');
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        timezone: dto.timezone ?? 'Asia/Jakarta',
      },
    });

    return tenant;
  }

  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    const checkNameCategory = await this.prisma.serviceCategory.findFirst({
      where: {
        name: {
          contains: dto.name,
          mode: 'insensitive',
        },
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (checkNameCategory) {
      throw new BadRequestException('Category name already exists');
    }

    const category = await this.prisma.serviceCategory.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive ?? true,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    return category;
  }

  async updateCategory(id: string, tenantId: string, dto: UpdateCategoryDto) {
    if (dto.name) {
      const existingName = await this.prisma.serviceCategory.findFirst({
        where: {
          name: { contains: dto.name, mode: 'insensitive' },
          tenantId,
        },
        select: { id: true },
      });

      if (existingName) {
        throw new BadRequestException('Category name already exists');
      }
    }

    return this.prisma.serviceCategory.update({
      where: { id, tenantId },
      data: dto,
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
  }

  async findCategories(tenantId: string) {
    return this.prisma.serviceCategory.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        sortOrder: true,
        isActive: true,
      },
    });
  }

  async deleteCategory(id: string, tenantId: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });

    if (!category || category.tenantId !== tenantId) {
      throw new NotFoundException('Category not found');
    }

    return this.prisma.serviceCategory.delete({
      where: { id },
      select: {
        id: true,
        name: true,
      },
    });
  }

  async findManyPaginated(query: PaginationQueryDto) {
    const { skip, take, page, limit } = getPaginationParams(query);
    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count(),
    ]);
    return { items, total, page, limit };
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
      },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async toggleStatus(params: ToggleTenantStatusParams) {
    const { id, isActive, reason, disabledBy } = params;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.prisma.tenant.update({
      where: { id },
      data: {
        isActive,
        disabledReason: isActive ? null : (reason ?? null),
        disabledAt: isActive ? null : new Date(),
        disabledBy: isActive ? null : (disabledBy ?? null),
      },
    });
  }

  async createCancellationPolicy(
    tenantId: string,
    dto: CreateCancellationPolicyDto,
  ) {
    // Check name uniqueness within tenant
    const existing = await this.prisma.cancellationPolicy.findFirst({
      where: { tenantId, name: dto.name },
    });

    if (existing) {
      throw new BadRequestException(
        'Cancellation policy with this name already exists',
      );
    }

    if (dto.isDefault) {
      // Unset existing default
      await this.prisma.cancellationPolicy.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.cancellationPolicy.create({
      data: {
        tenantId,
        name: dto.name,
        hoursBeforeFree: dto.hoursBeforeFree ?? 24,
        lateCancelCharge: dto.lateCancelCharge ?? 50,
        noShowCharge: dto.noShowCharge ?? 100,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async findCancellationPolicies(tenantId: string) {
    return this.prisma.cancellationPolicy.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateCancellationPolicy(
    id: string,
    tenantId: string,
    dto: UpdateCancellationPolicyDto,
  ) {
    const policy = await this.prisma.cancellationPolicy.findUnique({
      where: { id },
    });

    if (!policy || policy.tenantId !== tenantId) {
      throw new NotFoundException('Cancellation policy not found');
    }

    if (dto.name) {
      const existing = await this.prisma.cancellationPolicy.findFirst({
        where: { tenantId, name: dto.name, id: { not: id } },
      });
      if (existing) {
        throw new BadRequestException(
          'Cancellation policy with this name already exists',
        );
      }
    }

    if (dto.isDefault) {
      await this.prisma.cancellationPolicy.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.cancellationPolicy.update({
      where: { id },
      data: dto,
    });
  }

  async deleteCancellationPolicy(id: string, tenantId: string) {
    const policy = await this.prisma.cancellationPolicy.findUnique({
      where: { id },
    });

    if (!policy || policy.tenantId !== tenantId) {
      throw new NotFoundException('Cancellation policy not found');
    }

    return this.prisma.cancellationPolicy.delete({
      where: { id },
    });
  }

  async findDefaultCancellationPolicy(tenantId: string) {
    return this.prisma.cancellationPolicy.findFirst({
      where: { tenantId, isDefault: true },
    });
  }
}
