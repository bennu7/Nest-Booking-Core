import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from 'src/prisma';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  /** Omitted on legacy tokens; omitted value must match DB after load. */
  tenantId?: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new InternalServerErrorException(
        'JWT_SECRET environment variable not set',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account has been deactivated');
    }

    if ('tenantId' in payload) {
      const payloadTenant = payload.tenantId ?? null;
      const userTenant = user.tenantId ?? null;
      if (payloadTenant !== userTenant) {
        throw new UnauthorizedException('Invalid session context');
      }
    }

    if (user.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { isActive: true },
      });
      if (!tenant?.isActive) {
        throw new UnauthorizedException('Tenant has been deactivated');
      }
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId ?? null,
    };
  }
}
