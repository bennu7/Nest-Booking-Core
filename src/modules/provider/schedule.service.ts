import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@generated/enums';
import { TenantContext } from 'src/common/interfaces/tenant-context.interface';
import { PrismaService } from 'src/prisma';
import { UpdateScheduleDto, CreateBreakDto } from './dto';

@Injectable()
export class ScheduleService {
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
    context: TenantContext,
  ): Promise<void> {
    const { tenantId, currentUser } = context;
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

  // ==================== PROVIDER SCHEDULE ====================

  async updateSchedule(
    providerId: string,
    dto: UpdateScheduleDto,
    context: TenantContext,
  ) {
    await this.assertProviderOwnership(providerId, context);

    const daySet = new Set(dto.days.map((d) => d.dayOfWeek));

    if (daySet.size !== dto.days.length) {
      throw new BadRequestException('Duplicate dayOfWeek in schedule');
    }

    for (const day of dto.days) {
      if (day.dayOfWeek < 0 || day.dayOfWeek > 6) {
        throw new BadRequestException('dayOfWeek must be between 0 and 6');
      }

      const start = new Date(day.startTime);
      const end = new Date(day.endTime);

      if (end <= start) {
        throw new BadRequestException(
          `endTime must be after startTime for day ${day.dayOfWeek}`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.providerSchedule.deleteMany({
        where: { providerId },
      });

      const schedules = await tx.providerSchedule.createManyAndReturn({
        data: dto.days.map((day) => ({
          providerId,
          dayOfWeek: day.dayOfWeek,
          startTime: new Date(day.startTime),
          endTime: new Date(day.endTime),
          isActive: day.isActive ?? true,
        })),
      });

      return schedules;
    });
  }

  async getSchedule(providerId: string, tenantId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerId, tenantId },
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const schedules = await this.prisma.providerSchedule.findMany({
      where: { providerId },
      orderBy: { dayOfWeek: 'asc' },
    });

    const breaks = await this.prisma.providerBreak.findMany({
      where: { providerId },
      orderBy: { createdAt: 'desc' },
    });

    return { schedules, breaks };
  }

  // ==================== PROVIDER BREAK ====================

  async createBreak(
    providerId: string,
    dto: CreateBreakDto,
    context: TenantContext,
  ) {
    await this.assertProviderOwnership(providerId, context);

    if (dto.isRecurring) {
      if (dto.dayOfWeek === undefined) {
        throw new BadRequestException(
          'dayOfWeek is required for recurring breaks',
        );
      }

      if (!dto.breakStart || !dto.breakEnd) {
        throw new BadRequestException(
          'breakStart and breakEnd are required for recurring breaks',
        );
      }

      const start = new Date(dto.breakStart);
      const end = new Date(dto.breakEnd);

      if (end <= start) {
        throw new BadRequestException('breakEnd must be after breakStart');
      }

      return this.prisma.providerBreak.create({
        data: {
          providerId,
          dayOfWeek: dto.dayOfWeek,
          breakStart: start,
          breakEnd: end,
          reason: dto.reason,
          isRecurring: true,
        },
      });
    } else {
      if (!dto.dateStart || !dto.dateEnd) {
        throw new BadRequestException(
          'dateStart and dateEnd are required for one-time breaks',
        );
      }

      const start = new Date(dto.dateStart);
      const end = new Date(dto.dateEnd);

      if (end < start) {
        throw new BadRequestException('dateEnd must be after dateStart');
      }

      return this.prisma.providerBreak.create({
        data: {
          providerId,
          dateStart: start,
          dateEnd: end,
          reason: dto.reason,
          isRecurring: false,
        },
      });
    }
  }

  async deleteBreak(
    breakId: string,
    providerId: string,
    context: TenantContext,
  ) {
    await this.assertProviderOwnership(providerId, context);

    const breakRecord = await this.prisma.providerBreak.findFirst({
      where: { id: breakId, providerId },
    });

    if (!breakRecord) {
      throw new NotFoundException('Break not found');
    }

    return this.prisma.providerBreak.delete({
      where: { id: breakId },
    });
  }
}
