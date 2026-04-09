import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export interface CurrentUserPayload {
  id: string;
  email: string;
  role: string;
  /** Null for platform users (e.g. SUPER_ADMIN without tenant). */
  tenantId: string | null;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: CurrentUserPayload }>();

    if (!request.user)
      throw new UnauthorizedException('User not authenticated');

    return request.user;
  },
);
