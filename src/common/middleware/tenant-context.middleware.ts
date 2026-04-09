import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

import type { CurrentUserPayload } from '../decorators/current-user.decorator';

/**
 * Runs after JwtAuthGuard (interceptors run after guards). Copies JWT user tenant into
 * `request.tenantId` so handlers and {@link TenantId} stay consistent without repeating `user.tenantId`.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      user?: CurrentUserPayload;
      tenantId?: string | null;
    }>();
    if (request.user && 'tenantId' in request.user) {
      request.tenantId = request.user.tenantId ?? null;
    }
    return next.handle();
  }
}
