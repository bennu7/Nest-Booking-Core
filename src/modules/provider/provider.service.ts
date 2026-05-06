import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@generated/enums';
import { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';
import { PrismaService } from 'src/prisma';
import {
  CreateProviderDto,
  UpdateProviderDto,
  CreateServiceDto,
  UpdateServiceDto,
} from './dto';

@Injectable()
export class ProviderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates that a PROVIDER user owns the target provider profile.
   * ADMIN/SUPER_ADMIN bypass this check — mereka mengelola semua provider di tenant mereka.
   *
   * @throws ForbiddenException jika provider yang login bukan pemilik profil target
   * @throws NotFoundException jika provider profile tidak ditemukan
   */
  private async assertProviderOwnership(
    providerId: string,
    tenantId: string,
    currentUser: CurrentUserPayload,
  ): Promise<void> {
    if (currentUser.role !== UserRole.PROVIDER) {
      // For non-providers (ADMIN/SA), we still need to verify the provider exists in this tenant
      const exists = await this.prisma.providerProfile.findUnique({
        where: { id: providerId, tenantId },
        select: { id: true },
      });
      if (!exists) {
        throw new NotFoundException('Provider not found');
      }
      return;
    }

    const profile = await this.prisma.providerProfile.findUnique({
      where: { id: providerId, tenantId },
      select: { userId: true },
    });

    if (!profile) {
      throw new NotFoundException('Provider not found');
    }

    if (profile.userId !== currentUser.id) {
      throw new ForbiddenException(
        'You can only manage your own provider profile',
      );
    }
  }

  // ==================== PROVIDER PROFILE ====================

  async create(dto: CreateProviderDto, tenantId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.tenantId && user.tenantId !== tenantId) {
      throw new BadRequestException('User does not belong to this tenant');
    }

    const existingProfile = await this.prisma.providerProfile.findUnique({
      where: { userId: dto.userId },
    });

    if (existingProfile) {
      throw new BadRequestException('User already has a provider profile');
    }

    return this.prisma.providerProfile.create({
      data: {
        userId: dto.userId,
        tenantId,
        bio: dto.bio,
        specialization: dto.specialization,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.providerProfile.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id, tenantId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            phone: true,
          },
        },
        services: {
          where: { isActive: true },
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    return provider;
  }

  async update(
    id: string,
    dto: UpdateProviderDto,
    tenantId: string,
    currentUser: CurrentUserPayload,
  ) {
    await this.assertProviderOwnership(id, tenantId, currentUser);

    return this.prisma.providerProfile.update({
      where: { id, tenantId },
      data: {
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.specialization !== undefined && {
          specialization: dto.specialization,
        }),
        ...(dto.isAvailable !== undefined && { isAvailable: dto.isAvailable }),
      },
    });
  }

  // ==================== SERVICE CRUD ====================

  async createService(
    providerId: string,
    tenantId: string,
    dto: CreateServiceDto,
    currentUser: CurrentUserPayload,
  ) {
    await this.assertProviderOwnership(providerId, tenantId, currentUser);

    if (dto.categoryId) {
      const category = await this.prisma.serviceCategory.findUnique({
        where: { id: dto.categoryId, tenantId },
      });

      if (!category) {
        throw new NotFoundException('Service category not found');
      }
    }

    return this.prisma.service.create({
      data: {
        providerId,
        name: dto.name,
        description: dto.description,
        durationMinutes: dto.durationMinutes,
        bufferMinutes: dto.bufferMinutes ?? 0,
        price: dto.price,
        currency: dto.currency ?? 'IDR',
        maxCapacity: dto.maxCapacity ?? 1,
        categoryId: dto.categoryId ?? null,
      },
    });
  }

  async findServices(providerId: string, tenantId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerId, tenantId },
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    return this.prisma.service.findMany({
      where: { providerId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async updateService(
    serviceId: string,
    providerId: string,
    tenantId: string,
    dto: UpdateServiceDto,
    currentUser: CurrentUserPayload,
  ) {
    await this.assertProviderOwnership(providerId, tenantId, currentUser);

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, providerId },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (dto.categoryId) {
      const category = await this.prisma.serviceCategory.findUnique({
        where: { id: dto.categoryId, tenantId },
      });

      if (!category) {
        throw new NotFoundException('Service category not found');
      }
    }

    return this.prisma.service.update({
      where: { id: serviceId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.durationMinutes !== undefined && {
          durationMinutes: dto.durationMinutes,
        }),
        ...(dto.bufferMinutes !== undefined && {
          bufferMinutes: dto.bufferMinutes,
        }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.maxCapacity !== undefined && {
          maxCapacity: dto.maxCapacity,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      },
    });
  }

  async deleteService(
    serviceId: string,
    providerId: string,
    tenantId: string,
    currentUser: CurrentUserPayload,
  ) {
    await this.assertProviderOwnership(providerId, tenantId, currentUser);

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, providerId },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const activeBookings = await this.prisma.booking.count({
      where: {
        serviceId,
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
      },
    });

    if (activeBookings > 0) {
      throw new BadRequestException(
        'Cannot delete service with active bookings. Deactivate it instead.',
      );
    }

    return this.prisma.service.delete({
      where: { id: serviceId },
    });
  }
}
