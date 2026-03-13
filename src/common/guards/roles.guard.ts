import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { Request } from 'express';
import { CurrentUserPayload } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // if not reuired roles, allow access
    if (!requiredRoles || requiredRoles.length === 0) return true;

    // get user from requests
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as CurrentUserPayload;

    if (!user) return false;

    // check if user have role as required
    const hasRole = requiredRoles.some((role) => user.role === role);

    return hasRole;
  }
}
