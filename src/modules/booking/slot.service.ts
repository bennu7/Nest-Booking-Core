import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@generated/enums';

import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';
import { PrismaService } from 'src/prisma';

import { CreateSlotHoldDto } from './dto';

const HOLD_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class SlotService {
  constructor(private readonly prisma: PrismaService) {}

  async createHold(user: CurrentUserPayload, dto: CreateSlotHoldDto) {
    if (user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenException('Only customers can create slot holds');
    }

    if (!user.tenantId) {
      throw new BadRequestException('Tenant context is required');
    }

    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    if (start >= end) {
      throw new BadRequestException('startTime must be before endTime');
    }

    if (start.getTime() < Date.now()) {
      throw new BadRequestException('startTime must be in the future');
    }

    const service = await this.prisma.service.findFirst({
      where: {
        id: dto.serviceId,
        providerId: dto.providerId,
        isActive: true,
        provider: { tenantId: user.tenantId },
      },
      select: { id: true },
    });

    if (!service) {
      throw new BadRequestException(
        'Service not found or inactive for this tenant',
      );
    }

    const expiresAt = new Date(Date.now() + HOLD_TTL_MS);

    return this.prisma.slotHold.create({
      data: {
        tenantId: user.tenantId,
        providerId: dto.providerId,
        customerId: user.id,
        serviceId: dto.serviceId,
        startTime: start,
        endTime: end,
        expiresAt,
      },
    });
  }

  async deleteExpiredHolds(tenantId: string) {
    const result = await this.prisma.slotHold.deleteMany({
      where: {
        tenantId,
        expiresAt: { lt: new Date() },
        isConverted: false,
      },
    });
    return { deleted: result.count };
  }
}
