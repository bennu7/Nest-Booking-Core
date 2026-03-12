/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma';

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  async isDatabaseReady() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (_) {
      return false;
    }
  }
}
