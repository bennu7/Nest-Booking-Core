import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from 'src/prisma';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CreateTenantDto } from '../tenant/dto/create-tenant.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { ToggleUserStatusDto } from './dto/toggle-user-status.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto) {
    const checkEmail = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
      select: {
        email: true,
      },
    });

    if (checkEmail) {
      throw new BadRequestException('Email already registered!');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hashedPassword,
        fullName: dto.fullName,
        phone: dto.phone,
        role: dto.role,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...result } = user;

    return result;
  }

  async login(
    dto: LoginDto,
    metadata: { ipAddress?: string; userAgent?: string },
  ) {
    const user = dto.tenantId
      ? await this.prisma.user.findUnique({
          where: {
            tenantId_email: {
              tenantId: dto.tenantId,
              email: dto.email,
            },
          },
        })
      : await this.prisma.user.findFirst({
          where: {
            email: dto.email,
            tenantId: null,
          },
        });

    if (!user) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    if (!user.isActive) {
      const reason = user.disabledReason ?? 'No reason provided';
      throw new UnauthorizedException(
        `Account has been deactivated. Reason: ${reason}`,
      );
    }

    if (user.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { isActive: true, disabledReason: true },
      });

      if (!tenant?.isActive) {
        const reason = tenant?.disabledReason ?? 'No reason provided';
        throw new UnauthorizedException(
          `Tenant has been deactivated. Reason: ${reason}`,
        );
      }
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash ?? '',
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = await this._generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await this._tokenHash({
      userId: user.id,
      refreshToken: token.refreshToken,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return token;
  }

  async setupTenant(userId: string, dto: CreateTenantDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        tenantId: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.tenantId) {
      throw new BadRequestException('User already has a tenant');
    }

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

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        tenantId: tenant.id,
        role: 'ADMIN',
      },
    });

    const userResult = {
      ...user,
      tenantId: tenant.id,
      role: 'ADMIN' as const,
    };

    return { tenant, user: userResult };
  }

  async refreshToken(refreshToken: string) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const findRefreshToken = await this.prisma.refreshToken.findUnique({
      where: {
        tokenHash,
      },
      select: {
        userId: true,
        expiresAt: true,
      },
    });

    if (!findRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (findRefreshToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: findRefreshToken.userId,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const newToken = await this._generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // ? 1 person can only have 1 refresh token at a time
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await this._tokenHash({
      userId: user.id,
      refreshToken: newToken.refreshToken,
    });

    return newToken;
  }

  async logout(refreshToken: string) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const findRefreshToken = await this.prisma.refreshToken.findUnique({
      where: {
        tokenHash,
      },
      select: {
        userId: true,
      },
    });

    if (!findRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.delete({
      where: {
        tokenHash,
      },
    });
  }

  async toggleUserStatus(
    userId: string,
    dto: ToggleUserStatusDto,
    disabledBy?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: dto.isActive,
        disabledReason: dto.isActive ? null : (dto.reason ?? null),
        disabledAt: dto.isActive ? null : new Date(),
        disabledBy: dto.isActive ? null : (disabledBy ?? null),
      },
    });
  }

  private async _generateTokens({
    userId,
    email,
    role,
  }: {
    userId: string;
    email: string;
    role: string;
  }) {
    const payload: JwtPayload = {
      sub: userId,
      email,
      role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN'),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_SECRET_REFRESH'),
      expiresIn: this.configService.get('JWT_SECRET_REFRESH_EXPIRES_IN'),
    });

    return { accessToken, refreshToken };
  }

  // generate token hash and store in database
  private async _tokenHash({
    userId,
    refreshToken,
    userAgent,
    ipAddress,
  }: {
    userId: string;
    refreshToken: string;
    userAgent?: string;
    ipAddress?: string;
  }) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    const valueExpiresIn =
      this.configService.get('JWT_SECRET_REFRESH_EXPIRES_IN') ?? 7;
    const expiresAt = this._parseExpiresToDate(valueExpiresIn);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });
  }

  // parse expiresIn to Date object
  private _parseExpiresToDate(expiresIn: string | number): Date {
    const now = new Date();

    if (typeof expiresIn === 'number') {
      now.setDate(now.getDate() + expiresIn);
      return now;
    }

    const match = /^(\d+)(d)?$/.exec(expiresIn);

    if (match) {
      const value = parseInt(match[1], 10);

      now.setDate(now.getDate() + value);
      return now;
    }

    throw new Error(`Invalid expires format: ${expiresIn}`);
  }
}
