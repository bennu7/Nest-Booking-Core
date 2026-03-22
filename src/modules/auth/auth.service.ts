import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUSer = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: dto.tenantId,
          email: dto.email,
        },
      },
    });

    console.log('existingUSer ==>> ', existingUSer);
    if (existingUSer) {
      throw new BadRequestException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hashedPassword,
        fullName: dto.fullName,
        phone: dto.phone,
        role: dto.role,
        tenantId: dto.tenantId,
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
    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: dto.tenantId,
          email: dto.email,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email or password is incorrect');
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

  async refreshToken(refreshToken: string) {
    const findRefreshToken = await this.prisma.refreshToken.findUnique({
      where: {
        tokenHash: refreshToken,
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

    await this._tokenHash({
      userId: user.id,
      refreshToken: newToken.refreshToken,
    });

    return newToken;
  }

  async logout(refreshToken: string) {
    const findRefreshToken = await this.prisma.refreshToken.findUnique({
      where: {
        tokenHash: refreshToken,
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
        tokenHash: refreshToken,
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
    const paylod = {
      userId,
      email,
      role,
    };

    const accessToken = await this.jwtService.signAsync(paylod, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN'),
    });

    const refreshToken = await this.jwtService.signAsync(paylod, {
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
    const hashedToken = await bcrypt.hash(refreshToken, 10);
    const valueExpiresIn =
      this.configService.get('JWT_SECRET_REFRESH_EXPIRES_IN') ?? 7;
    const expiresAt = this._parseExpiresToDate(valueExpiresIn);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashedToken,
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
