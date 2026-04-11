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

  async toggleStatus(
    id: string,
    isActive: boolean,
    reason?: string,
    disabledBy?: string,
  ) {
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
}
