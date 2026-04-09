import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Resolved tenant id for the request: `req.tenantId` (set by TenantContextInterceptor) or JWT user.
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<{
      tenantId?: string | null;
      user?: { tenantId?: string | null };
    }>();
    if (request.tenantId !== undefined) {
      return request.tenantId ?? null;
    }
    return request.user?.tenantId ?? null;
  },
);
